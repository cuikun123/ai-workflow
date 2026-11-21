import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import {project, resourcePackage, snapshot} from '../helpers/installation.mjs';
import {initializeProject} from '../../src/installation.mjs';
import {inspectProjectContext} from '../../src/foundation-context.mjs';
import {applyWorkflowTransition} from '../../src/workflow-journal.mjs';
import {planWorkflowTransition} from '../../src/workflow-transitions.mjs';
import {emptyPosition} from '../../src/workflow-status.mjs';
import {appendWorkflowRecord, parseWorkflowDocument, definitionDigest, replaceWorkflowRecord} from '../../src/workflow-docs.mjs';
import {sha256} from '../../src/package.mjs';
import {validateStateYaml} from '../../src/state.mjs';

const guard = await import('../../src/operation-guard.mjs').catch(e => {
  if(e.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw e;
});
const iteration = 'docs/iterations/000-foundation', tasks = iteration + '/tasks.md', verification = iteration + '/verification.md';
const portable = p => p.replaceAll('\\', '/');
const read = (root, p) => fs.readFileSync(path.join(root, p));
const state = root => validateStateYaml(read(root, 'docs/workflow/state.yaml').toString());
const doc = (root, p) => parseWorkflowDocument(read(root, p).toString(), p);
const ref = id => ({path:verification, record_id:id});
const definition = (root, p) => ({kind:'definition', path:p, sha256:definitionDigest(doc(root,p))});
const record = (id, kind, data, task='T1') => ({record_version:2, id, kind, iteration, task,
  source:{role:kind === 'confirmation' ? 'user' : kind === 'check' ? 'tool' : 'assistant', reference:'fixture:' + id,
    text:'Synthetic isolated test input; not a real approval, check or independent review'}, data});
let base, validateResult;
before(async () => {
  const pkg = await resourcePackage(); base = project();
  initializeProject({packageRoot:pkg, projectRoot:base});
  const ajv = new Ajv2020({strict:true, strictTypes:false});
  ajv.addSchema(JSON.parse(fs.readFileSync(new URL('../../schemas/workflow-record-v2.schema.json', import.meta.url))));
  validateResult = ajv.compile(JSON.parse(fs.readFileSync(new URL('../../schemas/guard-result.schema.json', import.meta.url))));
});
function git(root, args) {
  const r=spawnSync('git', ['-C',root,...args], {encoding:'utf8', windowsHide:true});
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function apply(root, action, data={}) {
  return applyWorkflowTransition(root, {operation_version:3, request_id:action + '-' + state(root).revision,
    expected_revision:state(root).revision, action, data});
}
function fixture({bound=true, running=true, selected=true, policy=true,commands}={}) {
  const root=project(); fs.cpSync(base,root,{recursive:true,filter:p=>!portable(path.relative(base,p)).startsWith('.ai-workflow/.local')});
  git(root,['init','-b','main']); git(root,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Synthetic fixture']);
  git(root,['switch','-c','task/fixture']);
  fs.writeFileSync(path.join(root,'server.mjs'),'export const value = 1;\n');
  fs.writeFileSync(path.join(root,'result.json'),'{"synthetic":true}\n');
  for(const name of ['scope','design']) fs.writeFileSync(path.join(root,iteration,name+'.md'),'# '+name+'\nSynthetic permitted input.\n');
  const progress={...emptyPosition('execute'),status:'ready',confirmation_refs:['scope','design','plan'].map(ref)};
  const declaration={title:'Synthetic guarded task',phase:'execute',depends_on:[],requirements:[],delta_refs:[],scenario_refs:[],
    spec_change_reason:'Synthetic nonbusiness fixture',execution_mode:'light',execution_reason:'Synthetic bounded fixture',
    verification_policy:{required_check_types:['command'],required_scenario_refs:[],review_mode:'independent'}};
  if(policy) declaration.guard_policy={workspace:{worktree_root:portable(root),git_common_dir:portable(path.join(root,'.git')),task_branch:'task/fixture',main_branch:'main'},
    write_paths:[{path:'server.mjs',recursive:false},{path:'src',recursive:true},{path:verification,recursive:false}],
    closeout_paths:[{path:'docs/guide.md',recursive:false},{path:verification,recursive:false}],
    commands:[{executable:portable(process.execPath),executable_sha256:sha256(fs.readFileSync(process.execPath)),argv:['--check','server.mjs'],cwd:'.'}]};
  if(commands) declaration.guard_policy.commands=commands(root);
  let text='# Tasks\n';
  for(const id of ['T1','T2']) text=appendWorkflowRecord(text,record(id,'task',{...declaration,progress:id==='T1'&&selected?progress:emptyPosition('execute')},id),tasks);
  fs.writeFileSync(path.join(root,tasks),text);
  let evidence='# Verification\n';
  for(const purpose of ['scope','design','plan']) evidence=appendWorkflowRecord(evidence,record(purpose,'confirmation',{
    purpose,result:'approved',artifacts:[definition(root,iteration+'/'+(purpose==='plan'?'tasks':purpose)+'.md')],supersedes:[]},null),verification);
  fs.writeFileSync(path.join(root,verification),evidence);
  const s=state(root);Object.assign(s,{current_task:selected?'T1':null,phase:selected?'execute':'clarify',status:selected?'ready':'not_started',confirmation_refs:selected?progress.confirmation_refs:[]});
  s.basis=s.basis.map(e=>({path:e.path,sha256:sha256(read(root,e.path))}));
  s.basis.push({path:'docs/project/specs/README.md',sha256:sha256(read(root,'docs/project/specs/README.md'))});
  fs.writeFileSync(path.join(root,'docs/workflow/state.yaml'),JSON.stringify(s));
  if(bound&&selected) apply(root,'context_bind',{iteration,task:'T1',expected_snapshot:inspectProjectContext(root).snapshot_sha256,impact:'unaffected',reason:'Synthetic fixture uses its declared constraints.'});
  if(running&&selected&&bound) apply(root,'start');
  return root;
}
function request(root,operation,task=true) {
  return {schema_version:1,operation,task_ref:task?{path:tasks,record_id:'T1'}:null,
    expected:task?{revision:state(root).revision,context_snapshot_sha256:inspectProjectContext(root).snapshot_sha256,
      task_definition_sha256:definitionDigest(doc(root,tasks))}:{revision:state(root).revision},authorization_refs:[]};
}
function change(root,p='server.mjs',text='export const value = 2;\n') {
  const absolute=path.join(root,p);return {path:p,before_sha256:fs.existsSync(absolute)?sha256(read(root,p)):null,after:text===null?null:{encoding:'utf8',text}};
}
const fileRequest=(root,changes=[change(root)],task=true)=>request(root,{kind:'file.mutate',changes},task);
function api(name) {assert.equal(typeof guard[name],'function',name+' has not been implemented');return guard[name];}
async function inspect(root,input,options={}) {
  const before=snapshot(root,true),r=await api('inspectOperation')(root,input,options);
  assert.deepEqual(snapshot(root,true),before,'The guard must never execute or write');
  assert.equal(validateResult(r),true,JSON.stringify(validateResult.errors));
  assert.equal(r.allowed,r.decision==='allow');return r;
}
function refused(r,decision='deny') {assert.equal(r.decision,decision,JSON.stringify(r.reasons));assert.equal(r.allowed,false);}
function simpleObserver(root,input,purpose) {
  return () => ({status:'observed',source_reference:'fixture:explicit-current-request',projectRoot:root,
    ...(purpose?{iteration,purpose}:{}),files:input.operation.changes.map(({path,before_sha256})=>({path,before_sha256}))});
}

test('file guard allows an active task with its current plan, binding and exact file scope',async()=>{
  const root=fixture(),r=await inspect(root,fileRequest(root));
  assert.equal(r.decision,'allow',JSON.stringify(r.reasons));assert.equal(r.observed.task_ref.record_id,'T1');
  assert(r.read_set.some(e=>e.path==='server.mjs'));assert(r.read_set.some(e=>e.path===tasks));
});
test('file guard refuses unselected tasks, another task and missing committed binding',async()=>{
  for(const options of [{selected:false},{bound:false}]) {
    const root=fixture(options);refused(await inspect(root,fileRequest(root)));
  }
  const root=fixture(),r=fileRequest(root);r.task_ref.record_id='T2';refused(await inspect(root,r));
});
test('file guard refuses a missing plan approval and an obsolete task definition',async()=>{
  const root=fixture(),d=doc(root,verification),plan=d.records.get('plan');plan.data.result='rejected';
  fs.writeFileSync(path.join(root,verification),replaceWorkflowRecord(d.text,plan,verification));
  refused(await inspect(root,fileRequest(root)));
  const other=fixture(),input=fileRequest(other);fs.appendFileSync(path.join(other,tasks),'Changed approved meaning.\n');
  refused(await inspect(other,input));
});
test('file guard allows verification repair but refuses ready and waiting-for-acceptance writes',async()=>{
  const root=fixture();apply(root,'verify');assert.equal((await inspect(root,fileRequest(root))).decision,'allow');
  const ready=fixture({running:false});refused(await inspect(ready,fileRequest(ready)));
  const waiting=fixture();apply(waiting,'verify');
  const artifacts=[{kind:'file',path:'server.mjs',sha256:sha256(read(waiting,'server.mjs'))},definition(waiting,tasks)];
  apply(waiting,'record',{record:record('C1','check',{result:'passed',check_type:'command',command:'Synthetic declaration',exit_code:0,test_count:null,
    covers:[],evidence:[{kind:'file',path:'result.json',sha256:sha256(read(waiting,'result.json'))}],artifacts})});
  apply(waiting,'record',{record:record('R1','review',{result:'passed',context_id:'fixture:independent',must_fix_open:0,mode:'independent',covers:[],artifacts})});
  apply(waiting,'await',{waiting_for:'task_acceptance',check_refs:[ref('C1')],review_refs:[ref('R1')]});
  refused(await inspect(waiting,fileRequest(waiting)));
  const repair={operation_version:3,request_id:'synthetic-feedback-repair',expected_revision:state(waiting).revision,action:'verify',data:{}};
  const wrap=()=>request(waiting,{kind:'workflow.apply',request:repair,input_sha256:sha256(Buffer.from(JSON.stringify(repair)))});
  refused(await inspect(waiting,wrap()));
  apply(waiting,'record',{record:record('repair-approved','confirmation',{purpose:'operation_authorization',result:'approved',
    artifacts:[definition(waiting,tasks)],supersedes:[],operation_scope:{actions:['task.repair'],binding:'task'}})});
  repair.expected_revision=state(waiting).revision;repair.data.authorization_ref=ref('repair-approved');
  const permitted=wrap();permitted.authorization_refs=[ref('repair-approved')];
  assert.equal((await inspect(waiting,permitted)).decision,'allow');
});
test('old declarations are readable but do not infer file permission from prose',async()=>{
  const root=fixture({policy:false});refused(await inspect(root,fileRequest(root)),'unknown');
});
test('file guard compares every move endpoint, before image and portable filesystem identity',async()=>{
  const root=fixture();
  const valid=[change(root,'server.mjs',null),change(root,'src/moved.mjs','export const value = 1;\n')];
  assert.equal((await inspect(root,fileRequest(root,valid))).decision,'allow');
  refused(await inspect(root,fileRequest(root,[valid[0],change(root,'outside.mjs','moved')])));
  const stale=fileRequest(root);stale.operation.changes[0].before_sha256=null;refused(await inspect(root,stale));
  refused(await inspect(root,fileRequest(root,[change(root,'SERVER.mjs','alias')])));
  fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.symlinkSync(root,path.join(root,'src','linked'),'junction');
  // snapshot deliberately excludes symlink targets; it compares the regular inputs.
  refused(await inspect(root,fileRequest(root,[{path:'src/linked/server.mjs',before_sha256:sha256(read(root,'server.mjs')),after:{encoding:'utf8',text:'bad'}}])));
});
test('direct state, framework and machine record modifications cannot use an ordinary file permission',async()=>{
  const root=fixture();
  for(const p of ['docs/workflow/state.yaml','.ai-workflow/manifest.json','AGENTS.md','docs/project/foundation/engineering.md','docs/project/specs/README.md'])
    refused(await inspect(root,fileRequest(root,[change(root,p,'Replacement')])));
  const unchanged=read(root,verification).toString();
  assert.equal((await inspect(root,fileRequest(root,[change(root,verification,unchanged+'\nOrdinary progress explanation.\n')]))).decision,'allow');
  refused(await inspect(root,fileRequest(root,[change(root,verification,unchanged.replace('Synthetic','Forged'))])));
  const opaque=fileRequest(root,[change(root,verification)]);opaque.operation.changes[0].after={encoding:'opaque',sha256:'a'.repeat(64),size_bytes:10};
  refused(await inspect(root,opaque),'unknown');
});
test('command guard matches executable bytes, literal argv and the actual task directory without running it',async()=>{
  const root=fixture(),input=request(root,{kind:'command.run',executable:portable(process.execPath),argv:['--check','server.mjs'],cwd:'.'});
  assert.equal((await inspect(root,input)).decision,'allow');
  input.operation.argv=['--check','outside.mjs'];refused(await inspect(root,input),'unknown');
  input.operation.argv=['--check','server.mjs'];input.operation.cwd='src';fs.mkdirSync(path.join(root,'src'));
  refused(await inspect(root,input),'unknown');
});
test('revalidation rechecks current files and rejects changed parameters or a forged previous allow',async()=>{
  const root=fixture(),input=fileRequest(root),old=await inspect(root,input),before=snapshot(root,true);
  const good=await api('revalidateOperation')(root,input,old);assert.equal(good.decision,'allow');assert.deepEqual(snapshot(root,true),before);
  refused(await api('revalidateOperation')(root,input,{...old,read_set:[]}));assert.deepEqual(snapshot(root,true),before);
  const changed=structuredClone(input);changed.operation.changes[0].after.text='Different request';
  refused(await api('revalidateOperation')(root,changed,old));
  fs.writeFileSync(path.join(root,'server.mjs'),'An external edit\n');
  refused(await api('revalidateOperation')(root,input,old));
});

test('host-observed independent prose needs no task and cannot gain implementation or protected-file permission',async()=>{
  const root=fixture({selected:false}),input=fileRequest(root,[change(root,'docs/guide.md','# A guide\n')],false);
  refused(await inspect(root,input),'unknown');
  assert.equal((await inspect(root,input,{independentRequestObserver:simpleObserver(root,input)})).decision,'allow');
  assert.equal(state(root).current_task,null);
  const code=fileRequest(root,[change(root)],false);
  refused(await inspect(root,code,{independentRequestObserver:simpleObserver(root,code)}));
  const missing=()=>({status:'unknown'});refused(await inspect(root,input,{independentRequestObserver:missing}),'unknown');
  const broken=()=>{throw Error('Host unavailable');};refused(await inspect(root,input,{independentRequestObserver:broken}),'unknown');
  const wrong=()=>({...simpleObserver(root,input)(),projectRoot:project()});
  refused(await inspect(root,input,{independentRequestObserver:wrong}));
});
test('planning preparation allows only current unselected iteration prose and preserves all machine records',async()=>{
  const root=fixture({selected:false}),input=fileRequest(root,[change(root,iteration+'/scope.md','# Scope\nRevised synthetic planning prose.\n')],false);
  assert.equal((await inspect(root,input,{preparationRequestObserver:simpleObserver(root,input,'planning')})).decision,'allow');
  const another=fileRequest(root,[change(root,'docs/iterations/other/tasks.md','# New planning\n')],false);
  refused(await inspect(root,another,{preparationRequestObserver:simpleObserver(root,another,'planning')}));
  const declared=fileRequest(root,[change(root,tasks,read(root,tasks).toString().replace('Synthetic guarded task','Altered task'))],false);
  refused(await inspect(root,declared,{preparationRequestObserver:simpleObserver(root,declared,'planning')}));
  const active=fixture(),edit=fileRequest(active,[change(active,iteration+'/design.md','# Changed definition\n')],false);
  refused(await inspect(active,edit,{preparationRequestObserver:simpleObserver(active,edit,'planning')}));
});
test('workflow input preparation permits a supported JSON object without starting a task or executing the object',async()=>{
  const root=fixture({selected:false}),semantic={operation_version:3,request_id:'synthetic-input',expected_revision:state(root).revision,action:'start',data:{}};
  const input=fileRequest(root,[change(root,'.ai-workflow/.local/inputs/start.json',JSON.stringify(semantic))],false);
  assert.equal((await inspect(root,input,{preparationRequestObserver:simpleObserver(root,input,'workflow_input')})).decision,'allow');
  assert.equal(state(root).status,'not_started');
  const bad=fileRequest(root,[change(root,'.ai-workflow/.local/inputs/start.json','{"shell":"git push"}')],false);
  refused(await inspect(root,bad,{preparationRequestObserver:simpleObserver(root,bad,'workflow_input')}));
  const script=fileRequest(root,[change(root,'.ai-workflow/.local/inputs/start.mjs','console.log("bad")')],false);
  refused(await inspect(root,script,{preparationRequestObserver:simpleObserver(root,script,'workflow_input')}));
});
test('semantic apply uses the existing planner instead of treating parsed request data as execution permission',async()=>{
  const root=fixture({selected:false}),semantic={operation_version:3,request_id:'synthetic-register',expected_revision:state(root).revision,action:'record',
    data:{record:record('B1','blocker',{reason:'Synthetic obstacle',condition:'Synthetic resolution'},null)}};
  const wrap=s=>request(root,{kind:'workflow.apply',request:s,input_sha256:sha256(Buffer.from(JSON.stringify(s)))},false);
  assert.equal((await inspect(root,wrap(semantic))).decision,'allow');
  const invalid={...semantic,request_id:'bad',data:{shell:'git push'}};refused(await inspect(root,wrap(invalid)));
  const unbound={...semantic,request_id:'cannot-start',action:'start',data:{}};refused(await inspect(root,wrap(unbound)));
});
test('read-only diagnostic query stays available when business state is broken and refuses unsafe query arguments',async()=>{
  const root=fixture({selected:false});fs.writeFileSync(path.join(root,'docs/workflow/state.yaml'),'broken: state');
  const q=(command,argv)=>({schema_version:1,operation:{kind:'workflow.query',command,argv},task_ref:null,expected:{},authorization_refs:[]});
  assert.equal((await inspect(root,q('status',['--json']))).decision,'allow');
  refused(await inspect(root,q('doctor',['--client'])),'unknown');
  refused(await inspect(root,q('status',['--project','D:/other'])),'unknown');
  refused(await inspect(root,q('artifacts.inspect',['--path','../outside'])));
});
test('guard refuses observer-time fact changes and malformed requests without writing files',async()=>{
  const root=fixture({selected:false}),input=fileRequest(root,[change(root,'docs/guide.md','# Guide\n')],false),before=snapshot(root,true);
  await assert.rejects(()=>api('inspectOperation')(root,{...input,allow:true}),e=>e.code==='USAGE');
  assert.deepEqual(snapshot(root,true),before);
  const observer=()=>{const r=simpleObserver(root,input)();fs.writeFileSync(path.join(root,'docs/workflow/state.yaml'),JSON.stringify({...state(root),revision:99}));return r;};
  const result=await api('inspectOperation')(root,input,{independentRequestObserver:observer});refused(result);
  assert(result.reasons.some(r=>r.code==='GUARD_FACT_CHANGED'));
});

test('declaring Node preload or a framework entrypoint as an engineering command does not bypass stricter classification',async()=>{
  const root=fixture({commands:()=>[{executable:portable(process.execPath),executable_sha256:sha256(fs.readFileSync(process.execPath)),argv:['-r','./untrusted.mjs','server.mjs'],cwd:'.'}]});
  const input=request(root,{kind:'command.run',executable:portable(process.execPath),argv:['-r','./untrusted.mjs','server.mjs'],cwd:'.'});
  refused(await inspect(root,input),'unknown');
  input.operation.argv=['.ai-workflow/bin/iterlane.mjs','transition','--input','malicious.json'];
  refused(await inspect(root,input),'unknown');
});
test('file protection notices a root path alias and a same-name branch belonging to a different declared worktree',async()=>{
  const root=fixture(),input=fileRequest(root),alias=root.replace(path.basename(root),path.basename(root).toUpperCase());
  const result=await api('inspectOperation')(alias,input);refused(result);
  git(root,['switch','-c','task/other']);refused(await inspect(root,input));
});
test('read-only iteration queries cannot follow a linked directory even when reported as diagnostics',async()=>{
  const root=fixture({selected:false});fs.symlinkSync(root,path.join(root,'docs/iterations/linked'),'junction');
  const input={schema_version:1,operation:{kind:'workflow.query',command:'spec.check',argv:['--iteration','docs/iterations/linked','--task','T1']},task_ref:null,expected:{},authorization_refs:[]};
  refused(await inspect(root,input));
});

test('changing a real declared executable invalidates the original command permission',async()=>{
  if(process.platform!=='win32') return;
  const directory=project(),exe=path.join(directory,'where.exe');
  fs.copyFileSync(path.join(process.env.SystemRoot,'System32','where.exe'),exe);
  const digest=sha256(fs.readFileSync(exe));
  const root=fixture({commands:()=>[{executable:portable(exe),executable_sha256:digest,argv:['/?'],cwd:'.'}]});
  const input=request(root,{kind:'command.run',executable:portable(exe),argv:['/?'],cwd:'.'});
  assert.equal((await inspect(root,input)).decision,'allow');
  fs.appendFileSync(exe,'Synthetic executable-content change');
  refused(await inspect(root,input));
});
test('ordinary document closeout requires accepted current evidence and refuses business changes',async()=>{
  const root=fixture();apply(root,'verify');
  const artifacts=[{kind:'file',path:'server.mjs',sha256:sha256(read(root,'server.mjs'))},definition(root,tasks)];
  apply(root,'record',{record:record('C1','check',{result:'passed',check_type:'command',command:'Synthetic fixture only',exit_code:0,test_count:null,
    covers:[],evidence:[{kind:'file',path:'result.json',sha256:sha256(read(root,'result.json'))}],artifacts})});
  apply(root,'record',{record:record('R1','review',{result:'passed',context_id:'fixture:review',must_fix_open:0,mode:'independent',covers:[],artifacts})});
  apply(root,'await',{waiting_for:'task_acceptance',check_refs:[ref('C1')],review_refs:[ref('R1')]});
  apply(root,'record',{record:record('A1','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]})});
  apply(root,'confirm',{confirmation_refs:[ref('A1')]});
  assert.equal((await inspect(root,fileRequest(root,[change(root,'docs/guide.md','# Delivered guide\n')]))).decision,'allow');
  refused(await inspect(root,fileRequest(root)));
  fs.writeFileSync(path.join(root,'server.mjs'),'Changed accepted product\n');
  refused(await inspect(root,fileRequest(root,[change(root,'docs/guide.md','# Old acceptance\n')])));
});
test('a linked project root cannot report a protected inspection as an ordinary unknown',async()=>{
  const root=fixture({selected:false}),alias=path.join(project(),'linked');fs.symlinkSync(root,alias,'junction');
  const input=fileRequest(root,[change(root,'docs/guide.md','# Guide\n')],false);
  refused(await api('inspectOperation')(alias,input,{independentRequestObserver:simpleObserver(root,input)}));
});

test('renaming the actual Node binary cannot turn inline interpreter code into an engineering command',async()=>{
  const directory=project(),exe=path.join(directory,process.platform==='win32'?'engineering.exe':'engineering');
  fs.copyFileSync(process.execPath,exe);
  const root=fixture({commands:()=>[{executable:portable(exe),executable_sha256:sha256(fs.readFileSync(exe)),argv:['--eval','console.log("synthetic")'],cwd:'.'}]});
  const input=request(root,{kind:'command.run',executable:portable(exe),argv:['--eval','console.log("synthetic")'],cwd:'.'});
  refused(await inspect(root,input),'unknown');
});
test('a hard link to protected collaboration rules cannot be edited through independent prose permission',async()=>{
  const root=fixture({selected:false}),p='docs/guide.md';fs.linkSync(path.join(root,'AGENTS.md'),path.join(root,p));
  const input=fileRequest(root,[change(root,p,read(root,p).toString()+'\nAltered rules through alias.\n')],false);
  refused(await inspect(root,input,{independentRequestObserver:simpleObserver(root,input)}));
});
test('task-free semantic operations do not silently ignore supplied context or task expectations',async()=>{
  const root=fixture({selected:false}),semantic={operation_version:3,request_id:'expected-context',expected_revision:state(root).revision,action:'record',
    data:{record:record('B2','blocker',{reason:'Synthetic obstacle',condition:'Synthetic resolution'},null)}};
  const input=request(root,{kind:'workflow.apply',request:semantic,input_sha256:sha256(Buffer.from(JSON.stringify(semantic)))},false);
  input.expected.context_snapshot_sha256='e'.repeat(64);refused(await inspect(root,input));
  input.expected.context_snapshot_sha256=inspectProjectContext(root).snapshot_sha256;
  input.expected.task_definition_sha256='d'.repeat(64);refused(await inspect(root,input),'unknown');
});
test('ordinary Markdown prose supports full text larger than the managed workflow document limit',async()=>{
  const root=fixture({selected:false}),input=fileRequest(root,[change(root,'docs/guide.md','# Guide\n'+'x'.repeat(8*1024*1024-8))],false);
  assert.equal((await inspect(root,input,{independentRequestObserver:simpleObserver(root,input)})).decision,'allow');
});
test('renaming the actual shell binary cannot bypass the shell prohibition',async()=>{
  if(process.platform!=='win32')return;
  const directory=project(),exe=path.join(directory,'engineering-shell.exe');
  fs.copyFileSync(path.join(process.env.SystemRoot,'System32','cmd.exe'),exe);
  const root=fixture({commands:()=>[{executable:portable(exe),executable_sha256:sha256(fs.readFileSync(exe)),argv:['/c','echo synthetic'],cwd:'.'}]});
  refused(await inspect(root,request(root,{kind:'command.run',executable:portable(exe),argv:['/c','echo synthetic'],cwd:'.'})),'unknown');
});
test('other installed shell variants cannot gain permission by declaring an unrecognized executable',async()=>{
  if(process.platform!=='win32')return;
  const directory=project(),commands=[];
  for(const [relative,argv] of [['SysWOW64/cmd.exe',['/c','echo synthetic']],['SysWOW64/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command','Write-Output synthetic']]]) {
    const source=path.join(process.env.SystemRoot,relative);if(!fs.existsSync(source))continue;
    const exe=path.join(directory,'engineering-'+commands.length+'.exe');fs.copyFileSync(source,exe);
    commands.push({executable:portable(exe),executable_sha256:sha256(fs.readFileSync(exe)),argv,cwd:'.'});
  }
  if(!commands.length)return;
  for(const name of ['node.exe','where.exe']) {
    const exe=path.join(directory,name);fs.copyFileSync(commands[0].executable,exe);
    commands.push({executable:portable(exe),executable_sha256:sha256(fs.readFileSync(exe)),argv:['/c','echo synthetic'],cwd:'.'});
  }
  const root=fixture({commands:()=>commands}),results=[];
  for(const {executable,argv,cwd} of commands)results.push((await inspect(root,request(root,{kind:'command.run',executable,argv,cwd}))).decision);
  assert.deepEqual(results,commands.map(()=>'unknown'));
});
