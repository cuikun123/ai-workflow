import test from 'node:test';import assert from 'node:assert/strict';import * as fs from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {project,snapshot} from '../helpers/installation.mjs';
import {appendWorkflowRecord} from '../../src/workflow-docs.mjs';
const load=()=>import('../../src/workflow-status.mjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){const root=project(),iteration='docs/iterations/001-work';fs.mkdirSync(join(root,iteration),{recursive:true});fs.mkdirSync(join(root,'docs/workflow'),{recursive:true});fs.mkdirSync(join(root,'docs/project/specs'),{recursive:true});for(const p of ['docs/project/overview.md',...['scope','design','tasks','verification'].map(n=>iteration+'/'+n+'.md')])fs.writeFileSync(join(root,p),'');const state={schema_version:1,revision:0,current_iteration:iteration,current_task:null,phase:'clarify',status:'not_started',waiting_for:null,checkpoint_ref:null,confirmation_refs:[],blocker_refs:[],basis:[{path:iteration+'/tasks.md',sha256:hash(Buffer.alloc(0))}],updated_at:'2026-11-14T00:00:00Z'};fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(state));return {root,iteration,state};}
const task=(iteration,id='T1')=>({record_version:1,id,kind:'task',iteration,task:id,source:{role:'assistant',reference:'fixture:plan',text:'Fictitious test only'},data:{title:id,phase:'execute',depends_on:[],requirements:[]}});

test('workflow status: initial empty documents are valid and reading cannot write progress',async()=>{
  const {inspectWorkflowState}=await load(),{root}=fixture(),before=snapshot(root,true),result=inspectWorkflowState(root);
  assert.equal(result.valid,true);assert.equal(result.state.status,'not_started');assert.equal(result.basis_current,true);assert.equal(result.acceptance_verified,false);assert.deepEqual(snapshot(root,true),before);
});
test('workflow status: missing task IDs and mismatched progress cannot be inferred from prose',async()=>{
  const {inspectWorkflowState}=await load(),{root,state,iteration}=fixture();state.current_task='T1';state.phase='execute';state.status='running';state.basis=[];fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(state));fs.writeFileSync(join(root,iteration+'/tasks.md'),'T1: done, approved, continue\n');
  assert.equal(inspectWorkflowState(root).valid,false);
  fs.writeFileSync(join(root,iteration+'/tasks.md'),appendWorkflowRecord('',task(iteration),iteration+'/tasks.md'));assert.equal(inspectWorkflowState(root).valid,false);
});
test('workflow status: changed basis is stale rather than silently rewritten',async()=>{
  const {inspectWorkflowState}=await load(),{root,iteration}=fixture();fs.writeFileSync(join(root,iteration+'/tasks.md'),'Human note\n');const before=snapshot(root,true),result=inspectWorkflowState(root);
  assert.equal(result.basis_current,false);assert.equal(result.diagnostic,'stale');assert.deepEqual(snapshot(root,true),before);
});
test('workflow status: an unrelated v2 declaration cannot strengthen existing v1 spec requirements',async()=>{
  const {inspectWorkflowState}=await load(),f=fixture();
  fs.writeFileSync(join(f.root,'docs/project/specs/legacy.md'),'### Requirement: CAP-001 Existing behavior\n#### Scenario: Existing unnamed case\n- **WHEN** x\n- **THEN** y\n');
  assert.equal(inspectWorkflowState(f.root).valid,true);
  const t=task(f.iteration,'T2');t.record_version=2;Object.assign(t.data,{delta_refs:[],scenario_refs:[],spec_change_reason:'Synthetic unrelated declaration'});
  fs.writeFileSync(join(f.root,f.iteration+'/tasks.md'),appendWorkflowRecord('',t,f.iteration+'/tasks.md'));
  f.state.basis=[];fs.writeFileSync(join(f.root,'docs/workflow/state.yaml'),JSON.stringify(f.state));
  assert.equal(inspectWorkflowState(f.root).valid,true);
});
test('workflow document checks: duplicate requirements and missing local links are errors, examples are skipped',async()=>{
  const {inspectWorkflowState}=await load(),{root}=fixture();fs.writeFileSync(join(root,'docs/project/specs/a.md'),'### Requirement: CAP-001 A\n');fs.writeFileSync(join(root,'docs/project/specs/b.md'),'### Requirement: CAP-001 B\n[Missing](missing.md)\n');
  const result=inspectWorkflowState(root);assert.equal(result.valid,false);assert.ok(result.issues.some(x=>x.code==='DUPLICATE_REQUIREMENT'));assert.ok(result.issues.some(x=>x.code==='BROKEN_LINK'));
});
test('workflow record references: unknown IDs and wrong-kind references stop current progress',async()=>{
  const {inspectWorkflowState}=await load(),{root,state,iteration}=fixture();state.confirmation_refs=[{path:iteration+'/verification.md',record_id:'not-there'}];fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(state));const result=inspectWorkflowState(root);assert.equal(result.valid,false);assert.ok(result.issues.some(x=>x.code==='BAD_RECORD_REFERENCE'));
});

test('workflow document checks: missing, self-cyclic and mutually cyclic task dependencies are diagnosed',async()=>{
  const {inspectWorkflowState}=await load();for(const variant of ['missing','self','cycle']){const {root,state,iteration}=fixture(),path=iteration+'/tasks.md',a=task(iteration),b=task(iteration,'T2');a.data.depends_on=[{path,record_id:variant==='missing'?'missing':variant==='self'?'T1':'T2'}];b.data.depends_on=[{path,record_id:'T1'}];let text=appendWorkflowRecord('',a,path);if(variant==='cycle')text=appendWorkflowRecord(text,b,path);fs.writeFileSync(join(root,path),text);state.basis=[];fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(state));const before=snapshot(root,true),result=inspectWorkflowState(root);assert.equal(result.valid,false,variant);assert.ok(result.issues.some(x=>variant==='missing'?x.code==='BAD_RECORD_REFERENCE':x.code==='CYCLIC_REFERENCE'));assert.deepEqual(snapshot(root,true),before);}
});

test('workflow document checks: supersedes and resolution references require existing records of the right kind',async()=>{
  const {inspectWorkflowState}=await load(),{record,artifact}=await import('../helpers/workflow.mjs');for(const kind of ['confirmation','resolution']){const f=fixture(),path=f.iteration+'/verification.md',data=kind==='confirmation'?{purpose:'pause',result:'approved',artifacts:[{kind:'file',path:'server.mjs',sha256:'a'.repeat(64)}],supersedes:[{path,record_id:'missing'}]}:{result:'resolved',blockers:[{path,record_id:'missing'}],evidence:[{kind:'file',path:'result.json',sha256:'a'.repeat(64)}]};fs.writeFileSync(join(f.root,path),appendWorkflowRecord('',record(f,'bad',kind,data,null),path));const result=inspectWorkflowState(f.root);assert.equal(result.valid,false,kind);assert.ok(result.issues.some(x=>x.code==='BAD_RECORD_REFERENCE'));}
});
