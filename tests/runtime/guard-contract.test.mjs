import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {validateWorkflowRecord,parseWorkflowDocument,replaceWorkflowRecord,definitionDigest} from '../../src/workflow-docs.mjs';
import {planWorkflowTransition} from '../../src/workflow-transitions.mjs';
import {loadWorkflowView,positionFromState,inspectWorkflowState} from '../../src/workflow-status.mjs';
import {verificationIssues} from '../../src/verification-policy.mjs';
import {workflowFixture,current,record,driver,definition,ref,artifact,hash} from '../helpers/workflow.mjs';
import {snapshot} from '../helpers/installation.mjs';


const requestModule=await import('../../src/guard-request.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const prerequisites=await import('../../src/workflow-prerequisites.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const digest='a'.repeat(64),commit='b'.repeat(40);
const policy=()=>({
 workspace:{worktree_root:'D:/fixture/worktree',git_common_dir:'D:/fixture/repo/.git',task_branch:'task/fixture',main_branch:'main'},
 write_paths:[{path:'src',recursive:true}],closeout_paths:[{path:'docs/guide.md',recursive:false}],
 commands:[{executable:'D:/fixture/node.exe',executable_sha256:digest,argv:['--check','src/app.js'],cwd:'.'}]
});

test('shared confirmations distinguish operation targets and normalize action ordering',()=>{
 const f=workflowFixture(),d=driver(planWorkflowTransition,f);d.prepare();
 const grant=(id,result,operationScope,supersedes=[])=>({...record(f,id,'confirmation',{purpose:'operation_authorization',result,artifacts:[artifact(f)],supersedes,operation_scope:operationScope}),record_version:2});
 const first=scope();first.actions=['git.stage','git.push'];
 d.add(grant('target-a','approved',first));
 const other=scope();other.git.remote_url='https://example.invalid/other.git';
 d.add(grant('target-b','rejected',other));
 const view=loadWorkflowView(f.root),inspect=inspector('inspectConfirmations'),before=snapshot(f.root,true);
 assert.deepEqual(inspect(view,{purpose:'operation_authorization',refs:[ref(f,'target-a')]}).issues,[]);
 assert.deepEqual(snapshot(f.root,true),before);
 const reversed=structuredClone(first);reversed.actions.reverse();
 d.add(grant('target-a-reordered','approved',reversed,[ref(f,'target-a')]));
 assert.deepEqual(inspect(loadWorkflowView(f.root),{purpose:'operation_authorization',refs:[ref(f,'target-a-reordered')]}).issues,[]);
});
test('guard request rejects two changes to the same portable file identity',()=>{
 const parse=parser();
 for(const second of ['src/app.js','SRC/app.js']){
  const r=request({kind:'file.mutate',changes:[{path:'src/app.js',before_sha256:null,after:null},{path:second,before_sha256:null,after:{encoding:'utf8',text:'different'}}]});
  refuses(()=>parse(JSON.stringify(r)));
 }
});
test('guard closeout declarations do not grant protected paths under case aliases',()=>{
 const f=workflowFixture(),p=policy();p.closeout_paths=[{path:'DOCS/workflow/state.yaml',recursive:false}];
 refuses(()=>validateWorkflowRecord(v2Task(f,{guard_policy:p}),f.iteration+'/tasks.md'));
});
function v2Task(f,extra={}){return {...record(f,'T1','task',{title:'Synthetic guarded result',phase:'execute',depends_on:[],requirements:[],delta_refs:[],scenario_refs:[],spec_change_reason:'Synthetic contract fixture, not real business scope',...extra}),record_version:2};}
const scope=()=>({actions:['git.push'],binding:'task',git:{git_common_dir:'D:/fixture/repo/.git',worktree_root:'D:/fixture/worktree',source_branch:'task/fixture',remote_name:'origin',remote_url:'https://example.invalid/repo.git',target_branch:'task/fixture'}});
function request(operation={kind:'file.mutate',changes:[{path:'src/app.js',before_sha256:null,after:{encoding:'utf8',text:'export const value=1;\n'}}]},task=null){
 return {schema_version:1,operation,task_ref:task,expected:{revision:1},authorization_refs:[]};
}
function parser(){assert.equal(typeof requestModule.parseGuardRequest,'function','Shared strict request parser has not been implemented');return requestModule.parseGuardRequest;}
function inspector(name){assert.equal(typeof prerequisites[name],'function',name+' has not been implemented');return prerequisites[name];}
const refuses=fn=>assert.throws(fn,e=>['STATE_INVALID','USAGE','CONFLICT'].includes(e.code));

test('guard contract accepts a task-scoped execution declaration without altering its content',()=>{
 const f=workflowFixture(),r=v2Task(f,{guard_policy:policy()}),saved=structuredClone(r);
 assert.doesNotThrow(()=>validateWorkflowRecord(r,f.iteration+'/tasks.md'));
 assert.deepEqual(r,saved);
});
test('guard contract rejects scope escapes, task/main aliasing and malformed executable identity',()=>{
 for(const mutate of [
  p=>p.write_paths[0].path='src/../outside',p=>p.workspace.task_branch='main',
  p=>p.workspace.task_branch='task/../other',p=>p.commands[0].executable_sha256='invalid',
  p=>p.commands[0].cwd='../outside',p=>p.workspace.extra=true,
  p=>p.closeout_paths[0].path='docs/workflow/state.yaml',
  p=>p.closeout_paths[0].path='docs/project/specs/feature.md'
 ]){const f=workflowFixture(),p=policy();mutate(p);refuses(()=>validateWorkflowRecord(v2Task(f,{guard_policy:p}),f.iteration+'/tasks.md'));}
});
test('guard contract binds operation scope only to operation authorization and pins candidate grants',()=>{
 const f=workflowFixture(),r={...record(f,'grant','confirmation',{purpose:'operation_authorization',result:'approved',artifacts:[definition(f,f.iteration+'/tasks.md')],supersedes:[],operation_scope:scope()}),record_version:2};
 assert.doesNotThrow(()=>validateWorkflowRecord(r,f.iteration+'/verification.md'));
 const candidate=structuredClone(r);candidate.data.operation_scope.binding='candidate';refuses(()=>validateWorkflowRecord(candidate,f.iteration+'/verification.md'));
 candidate.data.operation_scope.candidate_commit=commit;assert.doesNotThrow(()=>validateWorkflowRecord(candidate,f.iteration+'/verification.md'));
 const wrong=structuredClone(r);wrong.data.purpose='plan';refuses(()=>validateWorkflowRecord(wrong,f.iteration+'/verification.md'));
 const unknown=structuredClone(r);unknown.data.operation_scope.actions.push('grant.everything');refuses(()=>validateWorkflowRecord(unknown,f.iteration+'/verification.md'));
});
test('guard contract records final integration context separately from product checks',()=>{
 const f=workflowFixture(),r={...record(f,'integration','check',{result:'passed',check_type:'observation',command:null,exit_code:null,test_count:null,evidence:[artifact(f,'result.json')],artifacts:[artifact(f)],covers:[],method:'Synthetic final integration observation',expected:'Synthetic matching pair',actual:'Synthetic matching pair',operation_context:{kind:'git.integration',git_common_dir:'D:/fixture/repo/.git',remote_url:'https://example.invalid/repo.git',target_branch:'main',base_commit:'c'.repeat(40),candidate_commit:commit,pr:'https://example.invalid/pull/1'}}),record_version:2};
 assert.doesNotThrow(()=>validateWorkflowRecord(r,f.iteration+'/verification.md'));
 const t=v2Task(f,{execution_mode:'light',execution_reason:'Synthetic check policy',verification_policy:{required_check_types:['observation'],required_scenario_refs:[],review_mode:'independent'}});
 const issues=verificationIssues(t,[r],[]);
 assert(issues.some(i=>i.code==='INVALID_REQUIRED_CHECK'),'Git integration context cannot satisfy product check requirements');
});
test('guard contract preserves old records but fixed old schema rejects new declarations',()=>{
 const f=workflowFixture(),plain=v2Task(f);
 assert.doesNotThrow(()=>validateWorkflowRecord(plain,f.iteration+'/tasks.md'));
 const old=JSON.parse(fs.readFileSync(new URL('../fixtures/workflow-record-before-guard.schema.json',import.meta.url),'utf8'));
 const validate=new Ajv2020({strict:true,strictTypes:false}).compile(old);
 assert.equal(validate(plain),true);
 assert.equal(validate(v2Task(f,{guard_policy:policy()})),false);
});
test('guard request parses supported operations and retains literal arguments and file contents',()=>{
 const parse=parser();
 for(const operation of [
  {kind:'file.mutate',changes:[{path:'src/app.js',before_sha256:null,after:{encoding:'utf8',text:'literal $value; unicode \u4e2d\u6587\n'}}]},
  {kind:'command.run',executable:'D:/fixture/node.exe',argv:['--check','src/app.js'],cwd:'.'},
  {kind:'workflow.query',command:'status',argv:['--json']},
  {kind:'workflow.apply',request:{operation_version:3,request_id:'fixture-register',expected_revision:1,action:'record',data:{}},input_sha256:digest},
  {kind:'git.stage',paths:['src/app.js'],cwd:'.'},
  {kind:'git.commit',paths:['src/app.js'],cwd:'.',index_sha256:digest},
  {kind:'git.push',remote_name:'origin',remote_url:'https://example.invalid/repo.git',target_branch:'task/fixture',candidate_commit:commit,intent:'candidate',cwd:'.'},
  {kind:'git.integrate',remote_url:'https://example.invalid/repo.git',target_branch:'main',pr:'https://example.invalid/pull/1',candidate_commit:commit,base_commit:'c'.repeat(40),integration_check_ref:{path:'docs/iterations/fixture/verification.md',record_id:'integration'},cwd:'.'}
 ]){const r=request(operation);assert.deepEqual(parse(JSON.stringify(r)),r);}
});
test('guard request rejects duplicate keys, unsafe paths, unknown fields and shell strings',()=>{
 const parse=parser(),valid=request();
 for(const text of [
  JSON.stringify(valid).replace('"schema_version":1','"schema_version":1,"schema_version":1'),
  JSON.stringify({...valid,allow:true}),
  JSON.stringify(request({kind:'file.mutate',changes:[{path:'../outside.js',before_sha256:null,after:null}]})),
  JSON.stringify(request({kind:'file.mutate',changes:[{path:'src\\app.js',before_sha256:null,after:null}]})),
  JSON.stringify(request({kind:'command.run',command:'git push origin main',cwd:'.'})),
  JSON.stringify({...valid,expected:{revision:9007199254740992}}),
  JSON.stringify(request({kind:'unknown.execute',cwd:'.'}))
 ])refuses(()=>parse(text));
});
test('guard request enforces UTF-8 byte limits for the whole envelope and each file',()=>{
 const parse=parser(),r=request();r.operation.changes[0].after.text='\u4e2d'.repeat(3*1024*1024);
 refuses(()=>parse(JSON.stringify(r)));
 refuses(()=>parse(' '.repeat(16*1024*1024+1)));
 const tooMany=request({kind:'file.mutate',changes:Array.from({length:101},(_,i)=>({path:'src/file'+i+'.js',before_sha256:null,after:null}))});
 refuses(()=>parse(JSON.stringify(tooMany)));
});
test('guard result schema never represents deny or unknown as executable permission',()=>{
 const file=new URL('../../schemas/guard-result.schema.json',import.meta.url);
 assert(fs.existsSync(file),'Shared guard result schema has not been implemented');
 const schema=JSON.parse(fs.readFileSync(file,'utf8')),records=JSON.parse(fs.readFileSync(new URL('../../schemas/workflow-record-v2.schema.json',import.meta.url),'utf8'));
 const ajv=new Ajv2020({strict:true,strictTypes:false});ajv.addSchema(records);const validate=ajv.compile(schema);
 const base={schema_version:1,decision:'deny',allowed:false,request_sha256:digest,observed:{},read_set:[],reasons:[{code:'TASK_MISSING',message:'No declared task',path:null,record_ref:null,next_action:'Prepare the task'}],verification:{source_authenticity_verified:false,checks_execution_verified:false,review_independence_verified:false}};
 assert.equal(validate(base),true);assert.equal(validate({...base,allowed:true}),false);
 assert.equal(validate({...base,decision:'unknown',allowed:true}),false);
 assert.equal(validate({...base,decision:'allow',allowed:true,reasons:[]}),true);
});
test('shared prerequisite inspection keeps missing confirmations observable without writing',()=>{
 const f=workflowFixture(),d=driver(planWorkflowTransition,f);d.prepare();
 const view=loadWorkflowView(f.root),task=view.getTask(f.iteration,'T1'),position=positionFromState(view.state,task),before=snapshot(f.root,true);
 const inspect=inspector('inspectTaskPrerequisites');
 const good=inspect(view,{task,position,context:null});
 assert.deepEqual(good.issues,[]);
 const bad=inspect(view,{task,position:{...position,confirmation_refs:[]},context:null});
 assert(bad.issues.length>0);assert.deepEqual(snapshot(f.root,true),before);
});
test('shared candidate inspection distinguishes product readiness from actual user acceptance',()=>{
 const f=workflowFixture(),d=driver(planWorkflowTransition,f);d.awaiting();
 let view=loadWorkflowView(f.root),task=view.getTask(f.iteration,'T1'),position=positionFromState(view.state,task),before=snapshot(f.root,true);
 const inspect=inspector('inspectCandidatePrerequisites');
 assert.deepEqual(inspect(view,{task,position,requireAcceptance:false}).issues,[]);
 assert(inspect(view,{task,position,requireAcceptance:true}).issues.length>0);
 assert.deepEqual(snapshot(f.root,true),before);
 d.add(record(f,'accepted','confirmation',{purpose:'task_acceptance',result:'approved',artifacts:[artifact(f)],supersedes:[]}));
 d.apply('confirm',{confirmation_refs:[ref(f,'accepted')]});
 view=loadWorkflowView(f.root);task=view.getTask(f.iteration,'T1');position=positionFromState(view.state,task);
 assert.deepEqual(inspect(view,{task,position,requireAcceptance:true}).issues,[]);
});
test('guard-only policy revisions invalidate old plan confirmation while keeping task progress',()=>{
 const f=workflowFixture(),d=driver(planWorkflowTransition,f);d.add(v2Task(f,{guard_policy:policy()}));const confirmations=d.approvals();d.apply('prepare',{iteration:f.iteration,task:'T1',confirmations});d.apply('start');
 const file=f.iteration+'/tasks.md',doc=parseWorkflowDocument(fs.readFileSync(path.join(f.root,file),'utf8'),file),beforeProgress=structuredClone(doc.records.get('T1').data.progress);
 d.apply('task_revise',{iteration:f.iteration,task:'T1',expected_definition_sha256:definitionDigest(doc),reason:'Synthetic scope revision',declaration:{title:'Synthetic guarded result',depends_on:[],requirements:[],delta_refs:[],scenario_refs:[],spec_change_reason:'Synthetic scope',guard_policy:{...policy(),write_paths:[{path:'src/app.js',recursive:false}]}}});
 const next=parseWorkflowDocument(fs.readFileSync(path.join(f.root,file),'utf8'),file).records.get('T1');
 assert.deepEqual(next.data.progress,beforeProgress);
 assert.equal(inspectWorkflowState(f.root).policy_confirmation_current,false);
 refuses(()=>d.apply('verify'));
});

test('guard object validation enforces the envelope budget and rejects non-JSON payloads',()=>{
 const validate=requestModule.validateGuardRequest;
 assert.equal(typeof validate,'function');
 const large=request({kind:'file.mutate',changes:Array.from({length:3},(_,i)=>({path:'src/large'+i+'.js',before_sha256:null,after:{encoding:'utf8',text:'x'.repeat(6*1024*1024)}}))});
 refuses(()=>validate(large));
 const cyclic=request({kind:'workflow.apply',request:{operation_version:3,request_id:'cycle',expected_revision:1,action:'record',data:{}},input_sha256:digest});
 cyclic.operation.request.data.self=cyclic;
 refuses(()=>validate(cyclic));
 const nonJson=request({kind:'workflow.apply',request:{operation_version:3,request_id:'function',expected_revision:1,action:'record',data:{callback:()=>true}},input_sha256:digest});
 refuses(()=>validate(nonJson));
 const valid=request(),saved=structuredClone(valid);validate(valid);assert.deepEqual(valid,saved);
});

test('shared confirmations cannot supersede a different task approval object',()=>{
 const f=workflowFixture(),d=driver(planWorkflowTransition,f);
 d.add(record(f,'T1','task',{title:'Synthetic task',phase:'execute',depends_on:[],requirements:[]}));
 const confirmations=d.approvals(),artifacts=[definition(f,f.iteration+'/tasks.md')];
 d.add(record(f,'task-rejection','confirmation',{purpose:'plan',result:'rejected',artifacts,supersedes:[]},'T1'));
 d.add(record(f,'iteration-approval','confirmation',{purpose:'plan',result:'approved',artifacts,supersedes:[ref(f,'task-rejection')]},null));
 const view=loadWorkflowView(f.root),projected={...view,state:{...view.state,current_task:'T1'}},before=snapshot(f.root,true);
 const result=inspector('inspectConfirmations')(projected,{purpose:'plan',refs:[ref(f,'iteration-approval')]});
 assert(result.issues.length>0);
 refuses(()=>d.apply('prepare',{iteration:f.iteration,task:'T1',confirmations:[...confirmations.filter(r=>r.record_id!=='approved-plan'),ref(f,'iteration-approval')]}));
 assert.deepEqual(snapshot(f.root,true),before);
});
test('guard command declarations and requests preserve empty argument values',()=>{
 const f=workflowFixture(),p=policy();p.commands[0].argv=['--label',''];
 assert.doesNotThrow(()=>validateWorkflowRecord(v2Task(f,{guard_policy:p}),f.iteration+'/tasks.md'));
 const r=request({kind:'command.run',executable:'D:/fixture/node.exe',argv:['--label',''],cwd:'.'});
 assert.deepEqual(parser()(JSON.stringify(r)),r);
 assert.deepEqual(requestModule.validateGuardRequest(r),r);
});
test('guard UTF-8 text rejects isolated surrogate code units while preserving valid pairs',()=>{
 for(const text of ['\ud800','\udc00','prefix\ud800suffix']){
  const r=request();r.operation.changes[0].after.text=text;
  refuses(()=>parser()(JSON.stringify(r)));
  refuses(()=>requestModule.validateGuardRequest(r));
 }
 const valid=request();valid.operation.changes[0].after.text='unicode \ud83d\ude00 \u4e2d\u6587';
 const actual=parser()(JSON.stringify(valid));assert.deepEqual(actual,valid);
 assert.equal(Buffer.from(actual.operation.changes[0].after.text,'utf8').toString('utf8'),valid.operation.changes[0].after.text);
 const f=workflowFixture(),p=policy();p.commands[0].argv=['--label','\ud800'];
 refuses(()=>validateWorkflowRecord(v2Task(f,{guard_policy:p}),f.iteration+'/tasks.md'));
});
