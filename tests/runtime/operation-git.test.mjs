import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {project,snapshot} from '../helpers/installation.mjs';
import {guardFixture,git,request,record,ref,definition,tasks,verification,iteration,read,state,apply,portable} from '../helpers/guard.mjs';
import {planWorkflowTransition} from '../../src/workflow-transitions.mjs';
import {applyPlan} from '../helpers/workflow.mjs';
import {inspectOperation,revalidateOperation} from '../../src/operation-guard.mjs';
import {sha256} from '../../src/package.mjs';
import {inspectProjectContext} from '../../src/foundation-context.mjs';
import {syncFixture,iteration as syncIteration,record as syncRecord,ref as syncRef} from '../helpers/spec-sync.mjs';

const module=await import('../../src/git-read.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const contextModule=await import('../../src/operation-git.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function add(root,value) {applyPlan(planWorkflowTransition(root,{operation_version:3,request_id:'fixture-'+state(root).revision,expected_revision:state(root).revision,action:'record',data:{record:value}}));}
function save(root) {git(root,['add','--','.']);git(root,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic isolated candidate']);return git(root,['rev-parse','HEAD']);}
async function fixture(options={}) {
 const root=await guardFixture(options),remote=project();git(remote,['init','--bare','-b','main']);git(root,['remote','add','origin',portable(remote)]);
 for(const [id,actions,target] of [['grant',['git.stage','git.commit','git.push'],'task/fixture'],['integrate-grant',['git.integrate'],'main']])
  add(root,record(id,'confirmation',{purpose:'operation_authorization',result:'approved',artifacts:[definition(root,tasks)],supersedes:[],operation_scope:{actions,binding:'task',git:{git_common_dir:portable(path.join(root,'.git')),worktree_root:portable(root),source_branch:'task/fixture',remote_name:'origin',remote_url:portable(remote),target_branch:target}}}));
 save(root);git(root,['branch','-f','main','HEAD']);
 fs.writeFileSync(path.join(root,'server.mjs'),'export const value = 2;\n');save(root);
 return {root,remote:portable(remote)};
}
function req(f,operation,grant='grant') {const r=request(f.root,operation);r.authorization_refs=[ref(grant)];return r;}
async function check(f,r,options={}) {const before=snapshot(f.root,true),remoteBefore=snapshot(f.remote,true),result=await inspectOperation(f.root,r,options);assert.deepEqual(snapshot(f.root,true),before);assert.deepEqual(snapshot(f.remote,true),remoteBefore);return result;}
function deny(r,decision='deny'){assert.equal(r.decision,decision,JSON.stringify(r.reasons));assert.equal(r.allowed,false);}
async function readiness(f,{accepted=false}={}) {
 apply(f.root,'verify');const artifacts=[{kind:'git',commit:git(f.root,['rev-parse','HEAD']),scope:['server.mjs']},definition(f.root,tasks)];
 apply(f.root,'record',{record:record('product-check','check',{result:'passed',check_type:'command',command:'Synthetic fixture declaration',exit_code:0,test_count:null,covers:[],evidence:[{kind:'file',path:'result.json',sha256:sha256(read(f.root,'result.json'))}],artifacts})});
 apply(f.root,'record',{record:record('product-review','review',{result:'passed',context_id:'fixture:independent-review',must_fix_open:0,mode:'independent',covers:[],artifacts})});
 apply(f.root,'await',{waiting_for:'task_acceptance',check_refs:[ref('product-check')],review_refs:[ref('product-review')]});
 if(accepted){apply(f.root,'record',{record:record('acceptance','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]})});apply(f.root,'confirm',{confirmation_refs:[ref('acceptance')]});apply(f.root,'spec_sync',{iteration,task:'T1'});}
 save(f.root);return artifacts;
}

test('read-only Git boundary rejects writes and preserves the actual repository',()=>{
 assert.equal(typeof module.readGit,'function','Shared read-only Git boundary is missing');
 const root=project();git(root,['init','-b','main']);git(root,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Synthetic']);
 const before=snapshot(root,true);assert.equal(module.readGit(root,['rev-parse','--verify','HEAD']).status,0);
 assert.throws(()=>module.readGit(root,['status','--porcelain=v1','-z','--untracked-files=all']),e=>e.code==='USAGE');
 assert.throws(()=>module.readGit(root,['commit','-m','Must never execute']),e=>e.code==='USAGE');assert.deepEqual(snapshot(root,true),before);
});
test('Git preflight rejects external filters before any read command can invoke them',async()=>{
 const f=await fixture(),script=path.join(f.root,'filter.cjs'),marker=path.join(f.root,'filter-ran');
 fs.writeFileSync(script,"const fs=require('node:fs');fs.writeFileSync("+JSON.stringify(marker)+",'executed');process.stdout.write(fs.readFileSync(0));");
 git(f.root,['config','filter.fixture.clean','"'+process.execPath.replaceAll('\\','/')+'" "'+script.replaceAll('\\','/')+'"']);
 fs.writeFileSync(path.join(f.root,'.gitattributes'),'server.mjs filter=fixture\\n');
 const before=snapshot(f.root,true);
 assert.throws(()=>contextModule.inspectGitOperationContext(f.root),e=>e.code==='INCOMPLETE'||e.code==='CONFLICT');
 assert.equal(fs.existsSync(marker),false,'No Git read during preflight may invoke the configured filter');
 assert.deepEqual(snapshot(f.root,true),before);
});
test('accepted specification sync permits saving its exact journaled output',async()=>{
 const workspace=root=>({worktree_root:portable(root),git_common_dir:portable(path.join(root,'.git')),task_branch:'task/fixture',main_branch:'main'});
 const f=await syncFixture({guardPolicy:root=>({workspace:workspace(root),write_paths:[{path:'candidate.txt',recursive:false},{path:'docs/project/specs',recursive:true}],closeout_paths:[],commands:[]})});
 const remote=project();git(remote,['init','--bare','-b','main']);f.remote=portable(remote);
 git(f.root,['init','-b','main']);git(f.root,['remote','add','origin',f.remote]);save(f.root);git(f.root,['switch','-c','task/fixture']);
 const taskPath=syncIteration+'/tasks.md',auth=syncRef('save-grant');
 f.apply('record',{record:syncRecord('save-grant','confirmation',{purpose:'operation_authorization',result:'approved',artifacts:[definition(f.root,taskPath)],supersedes:[],operation_scope:{actions:['git.stage','git.commit'],binding:'task',git:{git_common_dir:workspace(f.root).git_common_dir,worktree_root:workspace(f.root).worktree_root,source_branch:'task/fixture',target_branch:'task/fixture',remote_name:'origin',remote_url:f.remote}}})});
 save(f.root);f.apply('spec_sync',{iteration:syncIteration,task:'T1'});
 const req=operation=>({...request(f.root,operation,false),task_ref:syncRef('T1','tasks'),expected:{revision:state(f.root).revision,context_snapshot_sha256:inspectProjectContext(f.root).snapshot_sha256,task_definition_sha256:definition(f.root,taskPath).sha256},authorization_refs:[auth]});
 const paths=git(f.root,['diff','--name-only','HEAD']).split(/\r?\n/u);
 assert(paths.includes(f.path));
 const stage=await check(f,req({kind:'git.stage',paths,cwd:'.'}));assert.equal(stage.decision,'allow',JSON.stringify(stage.reasons));
 git(f.root,['add','--',...paths]);
 const index_sha256=contextModule.inspectGitOperationContext(f.root).index_sha256;
 const commit=await check(f,req({kind:'git.commit',paths,index_sha256,cwd:'.'}));assert.equal(commit.decision,'allow',JSON.stringify(commit.reasons));
});
test('Git context ignores environment redirection and returns the real index and references',async()=>{
 assert.equal(typeof contextModule.inspectGitOperationContext,'function','Actual Git context inspector is missing');
 const f=await fixture(),other=project(),saved=process.env.GIT_DIR;process.env.GIT_DIR=path.join(other,'.git');
 try{const before=snapshot(f.root,true),c=contextModule.inspectGitOperationContext(f.root);assert.equal(c.worktree_root,portable(f.root));assert.match(c.index_sha256,/^[a-f0-9]{64}$/);assert.deepEqual(snapshot(f.root,true),before);}finally{if(saved===undefined)delete process.env.GIT_DIR;else process.env.GIT_DIR=saved;}
});
test('active task staging and development commit require exact owned paths, authorization and index',async()=>{
 const f=await fixture();fs.writeFileSync(path.join(f.root,'server.mjs'),'export const value=3;\n');
 const stage=req(f,{kind:'git.stage',paths:['server.mjs'],cwd:'.'});assert.equal((await check(f,stage)).decision,'allow');
 const noGrant=structuredClone(stage);noGrant.authorization_refs=[];deny(await check(f,noGrant));
 const wrong=structuredClone(stage);wrong.operation.paths=['AGENTS.md'];deny(await check(f,wrong));
 git(f.root,['add','--','server.mjs']);const c=contextModule.inspectGitOperationContext(f.root);
 const commit=req(f,{kind:'git.commit',paths:['server.mjs'],cwd:'.',index_sha256:c.index_sha256});assert.equal((await check(f,commit)).decision,'allow');
 const old=await check(f,commit);git(f.root,['add','--','result.json']);fs.writeFileSync(path.join(f.root,'src-extra.txt'),'Unowned file\n');git(f.root,['add','--','src-extra.txt']);
 deny(await check(f,commit));deny(await revalidateOperation(f.root,commit,old));
});
test('development commit refuses staged bytes that differ from the current approved worktree image',async()=>{
 const f=await fixture();fs.writeFileSync(path.join(f.root,'server.mjs'),'export const value=2;\\n');git(f.root,['add','--','server.mjs']);
 const c=contextModule.inspectGitOperationContext(f.root),commit=req(f,{kind:'git.commit',paths:['server.mjs'],cwd:'.',index_sha256:c.index_sha256});
 fs.writeFileSync(path.join(f.root,'server.mjs'),'export const value=3;\\n');
 deny(await check(f,commit));
});
test('normal candidate push requires review and actual target; direct main push is always refused',async()=>{
 const f=await fixture(),operation=()=>({kind:'git.push',remote_name:'origin',remote_url:f.remote,target_branch:'task/fixture',candidate_commit:git(f.root,['rev-parse','HEAD']),intent:'candidate',cwd:'.'});
 deny(await check(f,req(f,operation())));
 await readiness(f);assert.equal((await check(f,req(f,operation()))).decision,'allow');
 const main=operation();main.target_branch='main';deny(await check(f,req(f,main)));
 const changed=operation();changed.remote_url=portable(project());deny(await check(f,req(f,changed)));
 const stale=operation();stale.candidate_commit=git(f.root,['rev-parse','main']);deny(await check(f,req(f,stale)));
 fs.mkdirSync(path.join(f.root,'src'));fs.writeFileSync(path.join(f.root,'src/unreviewed.txt'),'Synthetic unreviewed addition\n');save(f.root);
 deny(await check(f,req(f,operation())));
});
test('integration needs acceptance, specification closeout, a matching dual-commit check and host platform facts',async()=>{
 const f=await fixture();await readiness(f,{accepted:true});
 const base=git(f.root,['rev-parse','main']),pr='https://example.invalid/pull/1';
 const operation=()=>({kind:'git.integrate',remote_url:f.remote,target_branch:'main',pr,base_commit:base,candidate_commit:git(f.root,['rev-parse','HEAD']),integration_check_ref:ref('integration-check'),cwd:'.'});
 const noPlatform=req(f,operation(),'integrate-grant');deny(await check(f,noPlatform),'unknown');
 // The observation is a marked synthetic platform precondition, never a real PR.
 const observer=input=>({status:'observed',remote_url:input.remote_url,target_branch:input.target_branch,base_commit:input.base_commit,candidate_commit:input.candidate_commit,pr:input.pr,state:'open'});
 deny(await check(f,noPlatform,{platformObserver:observer}));
 const candidate=git(f.root,['rev-parse','HEAD']);
 apply(f.root,'record',{record:record('integration-check','check',{result:'passed',check_type:'observation',command:null,exit_code:null,test_count:null,method:'Synthetic final integration check',expected:'Matching current pair',actual:'Matching current pair',covers:[],evidence:[{kind:'file',path:'result.json',sha256:sha256(read(f.root,'result.json'))}],artifacts:[{kind:'git',commit:candidate,scope:['server.mjs']},definition(f.root,tasks)],operation_context:{kind:'git.integration',git_common_dir:portable(path.join(f.root,'.git')),remote_url:f.remote,target_branch:'main',base_commit:base,candidate_commit:candidate,pr}})});
 const ready=req(f,operation(),'integrate-grant');assert.equal((await check(f,ready,{platformObserver:observer})).decision,'allow');
 const wrong=input=>({...observer(input),candidate_commit:base});deny(await check(f,ready,{platformObserver:wrong}));
 const failed=()=>{throw Error('Synthetic platform unavailable');};deny(await check(f,ready,{platformObserver:failed}),'unknown');
});
test('Git inspection reads a real linked worktree and its actual common directory',async()=>{
 const f=await fixture(),linked=project();fs.rmSync(linked,{recursive:true,force:true});
 git(f.root,['worktree','add','-b','task/linked',portable(linked)]);
 assert.equal(fs.statSync(path.join(linked,'.git')).isFile(),true,'A linked worktree stores .git as a file, not a directory');
 const before=snapshot(linked,true),context=contextModule.inspectGitOperationContext(linked);
 assert.equal(context.worktree_root,portable(linked));
 assert.equal(context.git_common_dir,portable(path.join(f.root,'.git')));
 assert.equal(context.branch,'task/linked');
 assert.deepEqual(snapshot(linked,true),before);
});
test('repository text conversion attributes do not disable Git inspection',async()=>{
 const f=await fixture();
 fs.writeFileSync(path.join(f.root,'.gitattributes'),'* text=auto\n*.mjs text eol=lf\n*.md text eol=lf\n');
 const before=snapshot(f.root,true),context=contextModule.inspectGitOperationContext(f.root);
 assert.equal(context.branch,'task/fixture');
 assert.match(context.index_sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(snapshot(f.root,true),before,'Reading Git facts must not write to the repository');
});
test('worktree line-ending conversion is normalized before comparing saved content',async()=>{
 const f=await fixture();
 fs.writeFileSync(path.join(f.root,'.gitattributes'),'* text=auto\n*.mjs text eol=lf\n');
 fs.writeFileSync(path.join(f.root,'server.mjs'),'export const value = 2;\r\n');
 git(f.root,['config','core.autocrlf','true']);
 const blob=git(f.root,['ls-files','--stage','server.mjs']).split(/\s+/u)[1];
 const normalized=module.readGit(f.root,['hash-object','--path=server.mjs','--','server.mjs']);
 assert.equal(normalized.status,0);
 assert.equal(normalized.stdout.trim(),blob,'Converted worktree bytes must normalize to the recorded blob');
 const raw=module.readGit(f.root,['hash-object','--no-filters','--path=server.mjs','--','server.mjs']).stdout.trim();
 assert.notEqual(raw,blob,'Raw bytes alone would misreport the converted file as changed');
});
test('common external filter attributes stay unsupported',async()=>{
 const root=await guardFixture();
 fs.writeFileSync(path.join(root,'.gitattributes'),'*.bin filter=lfs diff=lfs merge=lfs -text\n');
 const before=snapshot(root,true);
 assert.throws(()=>contextModule.inspectGitOperationContext(root),e=>e.code==='INCOMPLETE');
 assert.deepEqual(snapshot(root,true),before);
});
test('definition text cannot be saved around the logged semantic records',async()=>{
 const f=await fixture();
 fs.writeFileSync(path.join(f.root,iteration+'/scope.md'),'# scope\nUnapproved rewrite outside the semantic flow.\n');
 deny(await check(f,req(f,{kind:'git.stage',paths:[iteration+'/scope.md'],cwd:'.'})));
});
