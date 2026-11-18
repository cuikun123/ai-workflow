import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {project,resourcePackage,snapshot} from '../helpers/installation.mjs';
import {initializeProject} from '../../src/installation.mjs';
import {inspectProjectContext} from '../../src/foundation-context.mjs';
import {applyWorkflowTransition,planWorkflowOperation,recoverWorkflowTransition} from '../../src/workflow-journal.mjs';
import {inspectWorkflowState,emptyPosition} from '../../src/workflow-status.mjs';
import {appendWorkflowRecord,parseWorkflowDocument,definitionDigest,replaceWorkflowRecord} from '../../src/workflow-docs.mjs';
import {sha256} from '../../src/package.mjs';
import {validateStateYaml} from '../../src/state.mjs';
import {runCli} from '../../src/cli.mjs';
import {inspectArtifacts} from '../../src/artifact-inspect.mjs';

const iteration='docs/iterations/000-foundation',tasks=iteration+'/tasks.md',verification=iteration+'/verification.md',engineering='docs/project/foundation/engineering.md';
const ref=id=>({path:verification,record_id:id});
const read=(root,path)=>fs.readFileSync(join(root,path),'utf8');
const current=root=>validateStateYaml(read(root,'docs/workflow/state.yaml'));
const doc=(root,path)=>parseWorkflowDocument(read(root,path),path);
const definition=(root,path)=>({kind:'definition',path,sha256:definitionDigest(doc(root,path))});
const record=(id,kind,data,task='T1',version=1)=>({record_version:version,id,kind,iteration,task,source:{role:kind==='confirmation'?'user':kind==='check'?'tool':'assistant',reference:'fixture:'+id,text:'Synthetic test precondition only; no real approval, execution or review'},data});
let base;
before(async()=>{const pkg=await resourcePackage();base=project();initializeProject({packageRoot:pkg,projectRoot:base});
  for(const name of ['scope','design'])fs.writeFileSync(join(base,iteration+'/'+name+'.md'),'# '+name+'\nSynthetic authorized input.\n');
  const progress={...emptyPosition('execute'),status:'ready',confirmation_refs:['scope','design','plan'].map(ref)};
  let text='# Tasks\n';for(const id of ['T1','T2'])text=appendWorkflowRecord(text,record(id,'task',{title:'Synthetic '+id,phase:'execute',depends_on:[],requirements:[],progress:id==='T1'?progress:emptyPosition('execute')},id),tasks);fs.writeFileSync(join(base,tasks),text);
  let evidence='# Verification\n';for(const purpose of ['scope','design','plan'])evidence=appendWorkflowRecord(evidence,record(purpose,'confirmation',{purpose,result:'approved',artifacts:[definition(base,iteration+'/'+(purpose==='plan'?'tasks':purpose)+'.md')],supersedes:[]},null),verification);fs.writeFileSync(join(base,verification),evidence);
  const s=current(base);Object.assign(s,{current_task:'T1',phase:'execute',status:'ready',confirmation_refs:progress.confirmation_refs});s.basis=s.basis.map(e=>({path:e.path,sha256:sha256(fs.readFileSync(join(base,e.path)))}));fs.writeFileSync(join(base,'docs/workflow/state.yaml'),JSON.stringify(s));
  assert.equal(inspectWorkflowState(base).valid,true);
});
const fixture=()=>{const root=project();fs.cpSync(base,root,{recursive:true,filter:p=>!relative(base,p).replaceAll('\\','/').startsWith('.ai-workflow/.local')});return root;};
const request=(root,action,data={},id=action)=>({operation_version:3,request_id:id,expected_revision:current(root).revision,action,data});
const apply=(root,action,data={},id=action)=>applyWorkflowTransition(root,request(root,action,data,id));
const binding=(root,id='bind-T1')=>request(root,'context_bind',{iteration,task:current(root).current_task,expected_snapshot:inspectProjectContext(root).snapshot_sha256,impact:'unaffected',reason:'Existing authorized plan remains applicable to these constraints.'},id);
const bind=root=>applyWorkflowTransition(root,binding(root));
const diagnostic=(fn,code)=>assert.throws(fn,e=>e.code==='CONFLICT'&&e.details?.some(i=>i.code===code));
function v2Fixture(){
  const root=fixture(),d=doc(root,tasks),task=d.records.get('T1');task.record_version=2;Object.assign(task.data,{delta_refs:[],scenario_refs:[],spec_change_reason:'Synthetic nonbusiness input',execution_mode:'full',execution_reason:'Explicit original fixture policy',verification_policy:{required_check_types:['test_suite'],required_scenario_refs:[],review_mode:'independent'}});fs.writeFileSync(join(root,tasks),replaceWorkflowRecord(d.text,task,tasks));
  const evidence=doc(root,verification),plan=evidence.records.get('plan');plan.data.artifacts=[definition(root,tasks)];fs.writeFileSync(join(root,verification),replaceWorkflowRecord(evidence.text,plan,verification));const s=current(root);s.basis=s.basis.map(e=>({path:e.path,sha256:sha256(fs.readFileSync(join(root,e.path)))}));s.basis.push({path:'docs/project/specs/README.md',sha256:sha256(fs.readFileSync(join(root,'docs/project/specs/README.md')))});fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));return root;
}
function acceptedTask(root){
  fs.writeFileSync(join(root,'candidate.txt'),'Synthetic delivered candidate\n');fs.writeFileSync(join(root,'evidence.txt'),'Synthetic test evidence\n');
  const artifacts=[{kind:'file',path:'candidate.txt',sha256:sha256(fs.readFileSync(join(root,'candidate.txt')))}];
  bind(root);apply(root,'start');apply(root,'verify');
  apply(root,'record',{record:record('C1','check',{result:'passed',command:'Synthetic fixture declaration; not a real business test',exit_code:0,test_count:1,evidence:[{kind:'file',path:'evidence.txt',sha256:sha256(fs.readFileSync(join(root,'evidence.txt')))}],artifacts})},'record-C1');
  apply(root,'record',{record:record('R1','review',{result:'passed',context_id:'fixture:synthetic-independent-review',must_fix_open:0,artifacts})},'record-R1');
  apply(root,'await',{waiting_for:'task_acceptance',check_refs:[ref('C1')],review_refs:[ref('R1')]});
  const waiting=snapshot(root,true);assert.throws(()=>apply(root,'start',{},'continue-is-not-acceptance'));assert.deepEqual(snapshot(root,true),waiting);
  apply(root,'record',{record:record('A1','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]})},'record-A1');apply(root,'confirm',{confirmation_refs:[ref('A1')]});return artifacts;
}

test('context binding: operation v3 accepts legacy business records while legacy writes are refused',()=>{
  const root=fixture(),input=request(root,'record',{record:record('B1','blocker',{reason:'Synthetic obstacle',condition:'Synthetic resolution'})});
  assert.equal(applyWorkflowTransition(root,input).revision,1);
  for(const version of [1,2]){const before=snapshot(root,true);diagnostic(()=>applyWorkflowTransition(root,{...request(root,'refresh',{},'old-'+version),operation_version:version}),'UNSUPPORTED_OPERATION_VERSION');assert.deepEqual(snapshot(root,true),before);}
});

test('context binding: inspect and fresh snapshot alone cannot start an unbound task',()=>{
  const root=fixture();inspectProjectContext(root);const before=snapshot(root,true);diagnostic(()=>apply(root,'start'),'CONTEXT_BINDING_REQUIRED');assert.deepEqual(snapshot(root,true),before);
});

test('context binding: preview has zero writes and committed binding preserves position and stable task definition',()=>{
  const root=fixture(),input=binding(root),before=snapshot(root,true),definitionBefore=definitionDigest(doc(root,tasks)),s=current(root),plan=planWorkflowOperation(root,input);
  assert.equal(plan.request.operation_version,3);assert.deepEqual(snapshot(root,true),before);assert.equal(plan.afterState.status,s.status);assert.equal(plan.afterState.waiting_for,s.waiting_for);
  const result=applyWorkflowTransition(root,input),check=[...doc(root,verification).records.values()].find(r=>r.kind==='check'&&r.data.method==='iterlane.foundation-context/v1');
  assert.equal(result.revision,s.revision+1);assert.equal(check.record_version,2);assert.equal(check.data.check_type,'observation');assert.equal(check.data.expected,input.data.expected_snapshot);assert.equal(check.data.actual,input.data.expected_snapshot);assert.equal(check.data.command,null);assert.equal(check.data.test_count,null);assert.deepEqual(check.data.covers,[]);
  assert.ok(check.data.artifacts.some(a=>a.kind==='definition'&&a.path===tasks&&a.sha256===definitionBefore));assert.equal(definitionDigest(doc(root,tasks)),definitionBefore);assert.match(read(root,verification),/Existing authorized plan remains applicable/u);
  const manifestPath='.ai-workflow/resources/skills/_shared/manifest.json';assert.ok(check.data.artifacts.some(a=>a.kind==='file'&&a.path===manifestPath&&a.sha256===sha256(fs.readFileSync(join(root,manifestPath)))));
  const after=snapshot(root,true);assert.equal(applyWorkflowTransition(root,input).action,'already_applied');assert.deepEqual(snapshot(root,true),after);assert.equal(apply(root,'start').revision,2);assert.equal(current(root).status,'running');
});

test('context binding: stale digest, revision, subject and completed work are refused before writes',()=>{
  for(const edit of [r=>{r.data.expected_snapshot='a'.repeat(64);},r=>{r.expected_revision++;},r=>{r.data.task='T2';},r=>{r.data.iteration='docs/iterations/other';},r=>{r.data.impact='guess';},r=>{r.data.reason='';}]){const root=fixture(),input=binding(root);edit(input);const before=snapshot(root,true);assert.throws(()=>applyWorkflowTransition(root,input));assert.deepEqual(snapshot(root,true),before);}
});

test('context binding: a normal observation record cannot impersonate a committed context bind',()=>{
  const root=fixture(),plan=planWorkflowOperation(root,binding(root)),file=plan.files.find(f=>f.path===verification),check=[...parseWorkflowDocument(file.after.toString('utf8'),verification).records.values()].find(r=>r.kind==='check');
  apply(root,'record',{record:check},'ordinary-forgery');const before=snapshot(root,true);diagnostic(()=>apply(root,'start'),'CONTEXT_BINDING_REQUIRED');assert.deepEqual(snapshot(root,true),before);
});

test('context binding: updated session context cannot replace a stale current task binding',()=>{
  const root=fixture();bind(root);apply(root,'start');fs.writeFileSync(join(root,engineering),'# Red line\nNever expose secrets.\n');inspectProjectContext(root);
  const before=snapshot(root,true);diagnostic(()=>apply(root,'verify'),'STALE_CONTEXT_BINDING');assert.deepEqual(snapshot(root,true),before);
  applyWorkflowTransition(root,binding(root,'bind-updated'));apply(root,'verify');assert.equal(current(root).phase,'verify');assert.equal(inspectWorkflowState(root).foundation_current,true);
});

test('context binding: binding does not adopt unrelated stale business documents',()=>{
  const root=fixture();fs.appendFileSync(join(root,verification),'Unmanaged new note\n');const before=snapshot(root,true);diagnostic(()=>bind(root),'CONTEXT_BINDING_BASIS_STALE');assert.deepEqual(snapshot(root,true),before);
  apply(root,'refresh');bind(root);assert.equal(current(root).status,'ready');
});

test('context binding: task_revise keeps identity, phase, progress and other record bytes',()=>{
  const root=fixture();bind(root);const original=doc(root,tasks),span=original.spans.get('T2'),other=original.text.slice(span.start,span.end),progress=original.records.get('T1').data.progress;
  apply(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:definitionDigest(original),reason:'Clarify the same authorized work.',declaration:{title:'Clarified synthetic T1',depends_on:[],requirements:[]}});
  const next=doc(root,tasks);assert.equal(next.records.get('T1').record_version,1);assert.equal(next.records.get('T1').data.phase,'execute');assert.deepEqual(next.records.get('T1').data.progress,progress);const s=next.spans.get('T2');assert.equal(next.text.slice(s.start,s.end),other);
  const before=snapshot(root,true);assert.throws(()=>apply(root,'start'));assert.deepEqual(snapshot(root,true),before);
});

test('context binding: task_revise rejects progress, phase, historical subjects and dependency cycles',()=>{
  for(const edit of [r=>{r.data.declaration.progress=emptyPosition('execute');},r=>{r.data.declaration.phase='release';},r=>{r.data.task='T2';},r=>{r.data.expected_definition_sha256='a'.repeat(64);},r=>{r.data.declaration.depends_on=[{path:tasks,record_id:'T1'}];}]){const root=fixture(),input=request(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:definitionDigest(doc(root,tasks)),reason:'Synthetic revision',declaration:{title:'New title',depends_on:[],requirements:[]}});edit(input);const before=snapshot(root,true);assert.throws(()=>applyWorkflowTransition(root,input));assert.deepEqual(snapshot(root,true),before);}
});

test('context binding: every new journal carries the unchanged spec shape plus exact foundation members',()=>{
  const root=fixture();bind(root);const dir=join(root,'.ai-workflow/.local/workflow-operations'),file=join(dir,fs.readdirSync(dir)[0],'journal.json'),j=JSON.parse(fs.readFileSync(file));
  assert.equal(j.journal_version,3);assert.equal(j.inventories.length,2);assert.deepEqual(j.foundation_inventory.paths,inspectProjectContext(root).foundation.map(e=>e.path));assert.equal(j.files.at(-1).path,'docs/workflow/state.yaml');
  const manifestPath='.ai-workflow/resources/skills/_shared/manifest.json';assert.ok(j.reads.some(e=>e.path===manifestPath&&e.sha256===sha256(fs.readFileSync(join(root,manifestPath)))));
});

test('context binding: removed bound extension can be explicitly rebound without restoring or inventing it',()=>{
  const root=fixture(),extra='docs/project/foundation/extra.md';fs.writeFileSync(join(root,extra),'# Extra\n');bind(root);fs.rmSync(join(root,extra));
  applyWorkflowTransition(root,binding(root,'bind-after-removal'));assert.equal(current(root).basis.some(e=>e.path===extra),false);assert.equal(inspectWorkflowState(root).foundation_current,true);apply(root,'start');
});

test('context binding: refresh cannot renew an old binding after a new foundation member',()=>{
  const root=fixture();bind(root);fs.writeFileSync(join(root,'docs/project/foundation/new.md'),'# New constraint\n');apply(root,'refresh');assert.equal(inspectWorkflowState(root).foundation_current,true);
  const before=snapshot(root,true);diagnostic(()=>apply(root,'start'),'STALE_CONTEXT_BINDING');assert.deepEqual(snapshot(root,true),before);
});

test('context binding CLI: bind preview is read only, explicit apply returns the task receipt',async()=>{
  const root=fixture(),args=['context','bind','--iteration',iteration,'--task','T1','--expected-snapshot',inspectProjectContext(root).snapshot_sha256,'--expected-revision','0','--request-id','cli-bind','--impact','unaffected','--reason','Existing approval still applies.','--json'];
  const invoke=async flags=>{let output='';const code=await runCli(flags,{projectRoot:root,write:s=>{output+=s;}});return {code,result:JSON.parse(output)};};
  const before=snapshot(root,true),preview=await invoke([...args,'--preview']);assert.equal(preview.code,0,JSON.stringify(preview.result));assert.equal(preview.result.data.action,'preview');assert.deepEqual(snapshot(root,true),before);
  const applied=await invoke(args);assert.equal(applied.code,0,JSON.stringify(applied.result));assert.equal(applied.result.data.binding_ref.path,verification);assert.equal(current(root).revision,1);
});

test('context binding: same session T1 closes, changed foundation cannot start T2 until its own fresh bind',()=>{
  const root=fixture(),artifacts=acceptedTask(root);apply(root,'record',{record:record('CL1','closeout',{result:'completed',specs:'not_needed',git:'not_applicable',reason:'Synthetic closeout; no Git operation',reference:'fixture:CL1',artifacts})},'record-CL1');apply(root,'closeout');apply(root,'complete',{closeout_ref:ref('CL1')});
  const completed=doc(root,tasks).records.get('T1').data.progress;assert.equal(completed.status,'completed');assert.throws(()=>applyWorkflowTransition(root,binding(root,'bind-completed')));
  fs.writeFileSync(join(root,engineering),'# Latest engineering constraints\n');apply(root,'prepare',{iteration,task:'T2',confirmations:['scope','design','plan'].map(ref)},'prepare-T2');
  inspectProjectContext(root);const before=snapshot(root,true);diagnostic(()=>apply(root,'start',{},'unbound-T2'),'CONTEXT_BINDING_REQUIRED');assert.deepEqual(snapshot(root,true),before);
  applyWorkflowTransition(root,binding(root,'bind-T2'));apply(root,'start',{},'start-T2');assert.equal(current(root).current_task,'T2');assert.equal(current(root).status,'running');assert.deepEqual(doc(root,tasks).records.get('T1').data.progress,completed);
});

test('context binding: reason text containing HTML comments cannot hide the binding record',()=>{
  const root=fixture(),input=binding(root);input.data.reason='Explain the literal <!-- unfinished marker';applyWorkflowTransition(root,input);
  assert.ok([...doc(root,verification).records.values()].some(r=>r.kind==='check'&&r.data.method==='iterlane.foundation-context/v1'));apply(root,'start');
});

test('context binding: replaying a stale bind request does not pretend to renew it',()=>{
  const root=fixture(),input=binding(root);applyWorkflowTransition(root,input);fs.writeFileSync(join(root,engineering),'# Changed after commit\n');const before=snapshot(root,true);assert.throws(()=>applyWorkflowTransition(root,input));assert.deepEqual(snapshot(root,true),before);
});

test('context binding: revised closeout task cannot bind its new definition with an old plan approval',()=>{
  const root=fixture();acceptedTask(root);apply(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:definitionDigest(doc(root,tasks)),reason:'Synthetic authorized definition revision',declaration:{title:'Revised accepted task description',depends_on:[],requirements:[]}});
  const acceptance=doc(root,verification).records.get('A1'),before=snapshot(root,true);assert.throws(()=>applyWorkflowTransition(root,binding(root,'rebind-revised-closeout')));assert.deepEqual(snapshot(root,true),before);assert.equal(acceptance.data.result,'approved');
});

test('context binding recovery: missing immutable read dependency cannot adopt new project rules',()=>{
  const root=fixture(),input=request(root,'record',{record:record('B1','blocker',{reason:'Synthetic blocker',condition:'Synthetic resolution'})});let fired=false;
  const io={...fs,renameSync(from,to){if(!fired&&to===join(root,verification)){fired=true;throw Object.assign(new Error('Injected write interruption'),{code:'EIO'});}return fs.renameSync(from,to);}};
  assert.throws(()=>applyWorkflowTransition(root,input,{io}),e=>e.code==='EIO');const folder=join(root,'.ai-workflow/.local/workflow-operations'),file=join(folder,fs.readdirSync(folder)[0],'journal.json'),j=JSON.parse(fs.readFileSync(file));j.reads=j.reads.filter(e=>e.path!=='AGENTS.md');fs.writeFileSync(file,JSON.stringify(j));fs.appendFileSync(join(root,'AGENTS.md'),'\nChanged public project rule\n');
  const before=snapshot(root,true);assert.throws(()=>recoverWorkflowTransition(root,'resume',current(root).revision));assert.deepEqual(snapshot(root,true),before);
});

for(const stage of ['prepared','applying','temporary',verification,'.gitattributes','.ai-workflow/manifest.json','docs/workflow/state.yaml'])test('context binding recovery: interruption at '+stage+' resumes once and undo preserves the old position',()=>{
  for(const mode of ['resume','undo']){const root=fixture();fs.writeFileSync(join(root,'docs/project/foundation/extra.md'),'# Before-binding member\n');const input=binding(root),old=current(root);let fired=false;
    const io={...fs,renameSync(from,to){const journal=to.endsWith('journal.json')?JSON.parse(fs.readFileSync(from)):null;const hit=to===join(root,stage)||journal&&(stage==='temporary'?journal.temporary!==null:journal.phase===stage);
      fs.renameSync(from,to);if(!fired&&hit){fired=true;throw Object.assign(new Error('Injected '+stage),{code:'EIO'});}}};
    assert.throws(()=>applyWorkflowTransition(root,input,{io}),e=>e.code==='EIO');assert.equal(fired,true);
    const after=current(root),result=recoverWorkflowTransition(root,mode,after.revision);assert.equal(result.action,mode==='resume'?'resumed':'undone');assert.ok(current(root).revision>=after.revision);assert.equal(current(root).current_task,old.current_task);assert.equal(current(root).status,old.status);assert.deepEqual(current(root).confirmation_refs,old.confirmation_refs);
    if(mode==='resume'){assert.equal(current(root).revision,old.revision+1);apply(root,'start');}
    else{assert.ok(current(root).revision>old.revision);assert.equal([...doc(root,verification).records.values()].some(r=>r.kind==='check'&&r.data.method==='iterlane.foundation-context/v1'),false);}
  }
});

for(const change of ['content','added-member','removed-member'])test('context binding recovery: '+change+' after interruption refuses resume and undo without writing',()=>{
  const root=fixture(),extra='docs/project/foundation/extra.md';fs.writeFileSync(join(root,extra),'# Original extra\n');const input=binding(root);let fired=false;
  const io={...fs,renameSync(from,to){if(!fired&&to===join(root,verification)){fired=true;throw Object.assign(new Error('Injected interruption'),{code:'EIO'});}return fs.renameSync(from,to);}};assert.throws(()=>applyWorkflowTransition(root,input,{io}),e=>e.code==='EIO');
  if(change==='content')fs.writeFileSync(join(root,engineering),'# External changed rule\n');else if(change==='added-member')fs.writeFileSync(join(root,'docs/project/foundation/external.md'),'External member\n');else fs.rmSync(join(root,extra));
  for(const mode of ['resume','undo']){const before=snapshot(root,true);assert.throws(()=>recoverWorkflowTransition(root,mode,current(root).revision));assert.deepEqual(snapshot(root,true),before);}
});

test('context binding recovery: a member inserted during commit cannot return a successful fresh binding',()=>{
  const root=fixture(),input=binding(root),extra=join(root,'docs/project/foundation/external.md');let fired=false;
  const io={...fs,renameSync(from,to){const j=to.endsWith('journal.json')?JSON.parse(fs.readFileSync(from)):null;fs.renameSync(from,to);if(!fired&&j?.phase==='committed'){fired=true;fs.writeFileSync(extra,'External change at commit\n');}}};
  assert.throws(()=>applyWorkflowTransition(root,input,{io}));assert.equal(fs.readFileSync(extra,'utf8'),'External change at commit\n');
  const dir=join(root,'.ai-workflow/.local/workflow-operations'),file=join(dir,fs.readdirSync(dir)[0],'journal.json');assert.equal(JSON.parse(fs.readFileSync(file)).phase,'blocked');
  const before=snapshot(root,true);assert.throws(()=>recoverWorkflowTransition(root,'resume',current(root).revision));assert.deepEqual(snapshot(root,true),before);
  fs.rmSync(extra);assert.equal(recoverWorkflowTransition(root,'resume',current(root).revision).action,'resumed');
});

test('context binding: uppercase Markdown remains byte-stable in a real Git clone',()=>{
  const root=fixture(),path='docs/project/foundation/privacy.MD';fs.writeFileSync(join(root,path),'# Privacy\nNative LF input.\n');bind(root);
  const git=(cwd,args)=>{const r=spawnSync('git',['-C',cwd,'-c','user.name=Synthetic validation','-c','user.email=fixture@example.invalid','-c','core.autocrlf=true',...args],{encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(r.status,0,r.stderr);};
  git(root,['init','-q']);git(root,['add','-A']);git(root,['commit','-qm','Synthetic line-ending fixture']);const destination=join(project(),'clone');git(root,['clone','-q',root,destination]);
  assert.deepEqual(fs.readFileSync(join(destination,path)),fs.readFileSync(join(root,path)));assert.equal(inspectWorkflowState(destination).foundation_current,true);
});

test('context binding: an existing unfinished HTML comment cannot conceal a successful receipt',()=>{
  const root=fixture();fs.appendFileSync(join(root,verification),'\n<!-- unfinished business comment\n');const state=current(root);state.basis.find(e=>e.path===verification).sha256=sha256(fs.readFileSync(join(root,verification)));fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(state));
  const before=snapshot(root,true);assert.throws(()=>bind(root));assert.deepEqual(snapshot(root,true),before);
});

test('context binding: a v2 policy revision requires current plan confirmation and a new binding',()=>{
  const root=fixture(),old=doc(root,tasks),t=old.records.get('T1');t.record_version=2;Object.assign(t.data,{delta_refs:[],scenario_refs:[],spec_change_reason:'Synthetic nonbusiness input',execution_mode:'full',execution_reason:'Explicit original fixture policy',verification_policy:{required_check_types:['test_suite'],required_scenario_refs:[],review_mode:'independent'}});fs.writeFileSync(join(root,tasks),replaceWorkflowRecord(old.text,t,tasks));
  let v=doc(root,verification);const p=v.records.get('plan');p.data.artifacts=[definition(root,tasks)];fs.writeFileSync(join(root,verification),replaceWorkflowRecord(v.text,p,verification));let s=current(root);s.basis=s.basis.map(e=>({path:e.path,sha256:sha256(fs.readFileSync(join(root,e.path)))}));s.basis.push({path:'docs/project/specs/README.md',sha256:sha256(fs.readFileSync(join(root,'docs/project/specs/README.md')))});fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));bind(root);
  const {phase,progress,...declaration}=t.data;declaration.verification_policy={required_check_types:['command'],required_scenario_refs:[],review_mode:'independent'};
  apply(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:definitionDigest(doc(root,tasks)),reason:'Synthetic reconfirmed verification policy',declaration});assert.ok(inspectWorkflowState(root).issues.some(e=>e.code==='STALE_PLAN_CONFIRMATION'));
  apply(root,'record',{record:record('P2','confirmation',{purpose:'plan',result:'approved',artifacts:[definition(root,tasks)],supersedes:[]},null,2)},'record-P2');assert.throws(()=>applyWorkflowTransition(root,binding(root,'not-selected-plan')));
  apply(root,'await',{waiting_for:'plan_confirmation'});apply(root,'confirm',{confirmation_refs:[ref('P2')],next_phase:'execute'});applyWorkflowTransition(root,binding(root,'bind-revised-policy'));apply(root,'start');assert.equal(current(root).status,'running');assert.deepEqual(doc(root,tasks).records.get('T1').data.verification_policy.required_check_types,['command']);
});

test('context binding: task_revise preserves a BOM, CRLF body and all other task records',()=>{
  const root=fixture();fs.writeFileSync(join(root,tasks),'\ufeff'+read(root,tasks).replaceAll('\n','\r\n'));
  const original=doc(root,tasks),otherSpan=original.spans.get('T2'),other=original.text.slice(otherSpan.start,otherSpan.end),prefix=original.text.slice(0,original.spans.get('T1').start);
  const actualDefinition=inspectArtifacts(root,[tasks],{kind:'definition'}).artifacts[0];const evidence=doc(root,verification),plan=evidence.records.get('plan');plan.data.artifacts=[actualDefinition];fs.writeFileSync(join(root,verification),replaceWorkflowRecord(evidence.text,plan,verification));
  const state=current(root);state.basis=state.basis.map(e=>({path:e.path,sha256:sha256(fs.readFileSync(join(root,e.path)))}));fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(state));
  apply(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:actualDefinition.sha256,reason:'Synthetic authorized title clarification',declaration:{title:'Clarified synthetic T1',depends_on:[],requirements:[]}});
  const next=doc(root,tasks);assert.equal(next.text.slice(0,next.spans.get('T1').start),prefix);const span=next.spans.get('T2');assert.equal(next.text.slice(span.start,span.end),other);
});


for(const state of ['paused','blocked','task_acceptance'])test('context binding: plan repairs preserve '+state+' before rebind and normal resume',()=>{
  const root=v2Fixture();bind(root);apply(root,'start');fs.writeFileSync(join(root,'candidate.txt'),'Synthetic candidate');const artifacts=[{kind:'file',path:'candidate.txt',sha256:sha256(fs.readFileSync(join(root,'candidate.txt')))},definition(root,tasks),definition(root,iteration+'/scope.md')];
  if(state==='paused'){apply(root,'record',{record:record('pause','confirmation',{purpose:'pause',result:'approved',artifacts,supersedes:[]},'T1',2)},'record-pause');apply(root,'pause',{confirmation_ref:ref('pause'),reason:'Synthetic explicit pause'});}
  else if(state==='blocked'){apply(root,'record',{record:record('B1','blocker',{reason:'Synthetic blocker',condition:'Explicit fixture resolution'},'T1',2)},'record-blocker');apply(root,'block',{blocker_refs:[ref('B1')],reason:'Synthetic block'});}
  else{apply(root,'verify');apply(root,'record',{record:record('C1','check',{result:'passed',command:'Synthetic fixture declaration',exit_code:0,test_count:1,covers:[],evidence:[artifacts[0]],artifacts},'T1',2)},'record-C1');apply(root,'record',{record:record('R1','review',{result:'passed',context_id:'fixture:independent',mode:'independent',must_fix_open:0,covers:[],artifacts},'T1',2)},'record-R1');apply(root,'await',{waiting_for:'task_acceptance',check_refs:[ref('C1')],review_refs:[ref('R1')]});}
  const {phase,progress,...declaration}=doc(root,tasks).records.get('T1').data;declaration.title='Clarified authorized task';apply(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:definitionDigest(doc(root,tasks)),reason:'Synthetic actual reconfirmation prerequisite',declaration});
  apply(root,'record',{record:record('P2','confirmation',{purpose:'plan',result:'approved',artifacts:[definition(root,tasks)],supersedes:[]},null,2)},'record-P2');const before=current(root);
  apply(root,'confirm',{confirmation_refs:[ref('P2')]},'confirm-repaired-plan');const repaired=current(root);for(const key of ['current_task','phase','status','waiting_for','blocker_refs','checkpoint_ref'])assert.deepEqual(repaired[key],before[key],key);assert.ok(repaired.confirmation_refs.some(e=>e.record_id==='P2'));
  applyWorkflowTransition(root,binding(root,'bind-repaired-plan'));assert.equal(current(root).status,before.status);
  if(state==='task_acceptance'){assert.equal(current(root).waiting_for,'task_acceptance');apply(root,'verify',{},'reverify-current-candidate');assert.deepEqual(doc(root,tasks).records.get('T1').data.progress.check_refs,[]);}
  else{if(state==='blocked')apply(root,'record',{record:record('resolution','resolution',{result:'resolved',blockers:[ref('B1')],evidence:[artifacts[0]]},'T1',2)},'record-resolution');apply(root,'resume',state==='blocked'?{resolution_ref:ref('resolution')}:{},'resume-after-repair');assert.equal(current(root).status,'running');assert.equal(inspectWorkflowState(root).policy_confirmation_current,true);}
});

test('context binding: native binding observation is refused as the only business check at await',()=>{
  const root=v2Fixture(),task=doc(root,tasks).records.get('T1');Object.assign(task.data,{execution_mode:'direct',execution_reason:'Synthetic nonbusiness task',verification_policy:{required_check_types:['observation'],required_scenario_refs:[],review_mode:'simplified'}});fs.writeFileSync(join(root,tasks),replaceWorkflowRecord(doc(root,tasks).text,task,tasks));const v=doc(root,verification),p=v.records.get('plan');p.data.artifacts=[definition(root,tasks)];fs.writeFileSync(join(root,verification),replaceWorkflowRecord(v.text,p,verification));const s=current(root);s.basis=s.basis.map(e=>({path:e.path,sha256:sha256(fs.readFileSync(join(root,e.path)))}));fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));
  const bound=bind(root);apply(root,'start');apply(root,'verify');const check=doc(root,verification).records.get(bound.binding_ref.record_id);apply(root,'record',{record:record('R1','review',{result:'passed',context_id:'fixture:main-review',mode:'simplified',must_fix_open:0,covers:[],artifacts:check.data.artifacts},'T1',2)},'record-R1');
  const before=snapshot(root,true);assert.throws(()=>apply(root,'await',{waiting_for:'task_acceptance',check_refs:[bound.binding_ref],review_refs:[ref('R1')]}));assert.deepEqual(snapshot(root,true),before);
});

test('context binding: paused revised closeout can resume verification only with current operation authorization',()=>{
  const root=v2Fixture();bind(root);apply(root,'start');apply(root,'verify');fs.writeFileSync(join(root,'candidate.txt'),'Synthetic accepted candidate');const artifacts=[{kind:'file',path:'candidate.txt',sha256:sha256(fs.readFileSync(join(root,'candidate.txt')))},definition(root,tasks),definition(root,iteration+'/scope.md')];
  apply(root,'record',{record:record('C1','check',{result:'passed',command:'Synthetic fixture check',exit_code:0,test_count:1,covers:[],artifacts,evidence:[artifacts[0]]},'T1',2)},'record-C1');apply(root,'record',{record:record('R1','review',{result:'passed',context_id:'fixture:review',mode:'independent',must_fix_open:0,covers:[],artifacts},'T1',2)},'record-R1');apply(root,'await',{waiting_for:'task_acceptance',check_refs:[ref('C1')],review_refs:[ref('R1')]});
  apply(root,'record',{record:record('A1','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]},'T1',2)},'record-A1');apply(root,'confirm',{confirmation_refs:[ref('A1')]});apply(root,'record',{record:record('pause','confirmation',{purpose:'pause',result:'approved',artifacts,supersedes:[]},'T1',2)},'record-pause');apply(root,'pause',{confirmation_ref:ref('pause'),reason:'Explicit synthetic pause'});
  const {phase,progress,...declaration}=doc(root,tasks).records.get('T1').data;declaration.title='Clarify the accepted task';apply(root,'task_revise',{iteration,task:'T1',expected_definition_sha256:definitionDigest(doc(root,tasks)),reason:'Synthetic authorized revision',declaration});apply(root,'record',{record:record('P2','confirmation',{purpose:'plan',result:'approved',artifacts:[definition(root,tasks)],supersedes:[]},null,2)},'record-P2');apply(root,'confirm',{confirmation_refs:[ref('P2')]},'confirm-P2');applyWorkflowTransition(root,binding(root,'bind-revised-closeout'));
  const paused=snapshot(root,true);assert.throws(()=>apply(root,'resume',{},'resume-stale-closeout'));assert.deepEqual(snapshot(root,true),paused);
  const unchanged=snapshot(root,true);assert.throws(()=>apply(root,'resume',{verification_authorization_ref:ref('P2')},'plan-is-not-reverification-authority'));assert.deepEqual(snapshot(root,true),unchanged);
  apply(root,'record',{record:record('authorize-reverify','confirmation',{purpose:'operation_authorization',result:'approved',artifacts:[artifacts[0],definition(root,tasks)],supersedes:[]},'T1',2)},'record-reverify');
  apply(root,'resume',{verification_authorization_ref:ref('authorize-reverify')},'resume-reverification');assert.equal(current(root).phase,'verify');assert.equal(current(root).status,'running');assert.deepEqual(doc(root,tasks).records.get('T1').data.progress.check_refs,[]);assert.equal(doc(root,verification).records.get('A1').data.result,'approved');
});
