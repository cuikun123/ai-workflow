import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {syncFixture,snapshot,iteration,specPath,ref,record,req} from '../helpers/spec-sync.mjs';
import {renderWorkflowRecord,parseWorkflowDocument,definitionDigest} from '../../src/workflow-docs.mjs';
import {emptyPosition,inspectWorkflowState} from '../../src/workflow-status.mjs';
import {planWorkflowOperation} from '../../src/workflow-journal.mjs';
import {digest,parseSpecification} from '../../src/spec-docs.mjs';

test('spec sync workflow: v2 prepare through acceptance, synchronization and completion',async()=>{
  const f=await syncFixture({accepted:false});f.task.data.progress=emptyPosition('execute');f.write(iteration+'/tasks.md','# Tasks\n'+renderWorkflowRecord(f.task));
  const initial={...f.current(),current_iteration:null,current_task:null,phase:null,status:'not_started',waiting_for:null,confirmation_refs:[],basis:[]};f.write('docs/workflow/state.yaml',JSON.stringify(initial));
  f.apply('prepare',{iteration,task:'T1',confirmations:['scope','design','plan'].map(k=>ref('approved-'+k))});f.apply('start');f.apply('verify');
  f.apply('await',{waiting_for:'task_acceptance',check_refs:[ref('C1')],review_refs:[ref('R1')]});
  const before=snapshot(f.root,true);assert.throws(()=>f.apply('spec_sync',{iteration,task:'T1'}));assert.deepEqual(snapshot(f.root,true),before);
  f.apply('record',{record:record('A1','confirmation',{purpose:'task_acceptance',result:'approved',artifacts:f.artifacts,supersedes:[]})});f.apply('confirm',{confirmation_refs:[ref('A1')]});
  const synchronized=f.apply('spec_sync',{iteration,task:'T1'});f.apply('record',{record:record('CL1','closeout',{result:'completed',specs:'synced',git:'not_applicable',reason:'Synthetic test; no Git operation',reference:'fixture:closeout',artifacts:f.artifacts,sync_ref:synchronized.sync_ref})});f.apply('complete',{closeout_ref:ref('CL1')});
  assert.equal(f.current().status,'completed');assert.equal(inspectWorkflowState(f.root).valid,true);assert.match(f.read(specPath),/MUST be 120/);
});
test('spec sync workflow: synchronization needs no migration of unrelated legacy specifications',async()=>{
  const f=await syncFixture();f.write('docs/project/specs/legacy.md','# Legacy\n### Requirement: Old unnumbered behavior\nKeep unchanged.\n');
  const plan=planWorkflowOperation(f.root,f.syncRequest());assert.ok(plan.sync_ref);assert.ok(!plan.files.some(x=>x.path.endsWith('legacy.md')));
});
test('spec sync workflow: full checks and independent review remain mandatory',async()=>{
  for(const edit of [r=>{if(r.kind==='check')r.data.test_count=0;},r=>{if(r.kind==='check')r.data.check_type='command';},r=>{if(r.kind==='review')r.data.mode='simplified';},r=>{if(r.kind==='confirmation'&&r.data.purpose==='task_acceptance')r.data.result='rejected';}]){
    const f=await syncFixture(),doc=parseWorkflowDocument(f.read(iteration+'/verification.md'),iteration+'/verification.md');for(const r of doc.records.values())edit(r);f.write(doc.path,'# Verification\n'+[...doc.records.values()].map(renderWorkflowRecord).join('\n'));
    const before=snapshot(f.root,true);assert.throws(()=>f.apply('spec_sync',{iteration,task:'T1'}));assert.deepEqual(snapshot(f.root,true),before);
  }
});
test('spec sync workflow: checks and acceptance bind candidate definitions as well as code',async()=>{
  const f=await syncFixture();const doc=parseWorkflowDocument(f.read(iteration+'/scope.md'),iteration+'/scope.md');doc.records.get('D1').data.operations[0].after_markdown=f.replacement.replaceAll('120','130');f.write(doc.path,'# Scope\n'+[...doc.records.values()].map(renderWorkflowRecord).join('\n'));
  const before=snapshot(f.root,true);assert.throws(()=>f.apply('spec_sync',{iteration,task:'T1'}));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: a new no-change request cannot adopt modified effective specifications',async()=>{
  const f=await syncFixture({mode:'NONE'});f.write(specPath,f.before+'\nA later human note.\n');const before=snapshot(f.root,true);assert.throws(()=>f.apply('spec_sync',{iteration,task:'T1'}));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: no-change synchronization refuses newly added effective specifications',async()=>{
  const f=await syncFixture({mode:'NONE'});f.write('docs/project/specs/later.md',f.before.replaceAll('CAP-001','CAP-009').replaceAll('CAP-002','CAP-010'));const before=snapshot(f.root,true);assert.throws(()=>f.apply('spec_sync',{iteration,task:'T1'}));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: registering records cannot silently adopt changed effective specifications',async()=>{
  const f=await syncFixture({mode:'NONE'});f.write(specPath,f.before+'\nA later human note.\n');const before=snapshot(f.root,true);assert.throws(()=>f.apply('record',{record:record('B1','blocker',{reason:'Synthetic record',condition:'Synthetic resolution'})}));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: code-only approval cannot authorize unbound delta definitions',async()=>{
  const f=await syncFixture(),doc=parseWorkflowDocument(f.read(iteration+'/verification.md'),iteration+'/verification.md');
  for(const r of doc.records.values())if(['check','review'].includes(r.kind)||r.kind==='confirmation'&&r.data.purpose==='task_acceptance')r.data.artifacts=f.artifacts.filter(a=>a.path==='candidate.txt');
  f.write(doc.path,'# Verification\n'+[...doc.records.values()].map(renderWorkflowRecord).join('\n'));const before=snapshot(f.root,true);assert.throws(()=>planWorkflowOperation(f.root,f.syncRequest()));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: v2 record accepts a delta but never caller-owned progress',async()=>{
  const f=await syncFixture({mode:'NONE'}),d=record('D2','spec_delta',{base:[{path:specPath,sha256:digest(f.before)}],new_spec_headers:[],operations:[{operation_id:'O2',action:'MODIFIED',path:specPath,requirement_id:'CAP-001',before_sha256:parseSpecification(f.before,specPath).sections.get('CAP-001').sha256,after_markdown:f.replacement,removed_scenarios:[],reason:'Synthetic unattached delta'}]},'T2');
  // A declared but unattached task/delta must be registered while no current v2 work is active.
  const state={...f.current(),current_iteration:null,current_task:null,phase:null,status:'not_started',waiting_for:null,confirmation_refs:[],basis:[]};f.write('docs/workflow/state.yaml',JSON.stringify(state));f.apply('record',{record:d});assert.ok(parseWorkflowDocument(f.read(iteration+'/scope.md'),iteration+'/scope.md').records.has('D2'));
  const before=snapshot(f.root,true);const t=structuredClone(f.task);t.id=t.task='T3';assert.throws(()=>f.apply('record',{record:t}));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: a retired empty file accepts a later requirement with a new ID',async()=>{
  const f=await syncFixture({mode:'REMOVED',onlyRequirement:true}),synced=f.apply('spec_sync',{iteration,task:'T1'});
  f.apply('record',{record:record('CL1','closeout',{result:'completed',specs:'synced',git:'not_applicable',reason:'Synthetic task closeout',reference:'fixture:closeout',artifacts:f.artifacts,sync_ref:synced.sync_ref})});f.apply('complete',{closeout_ref:ref('CL1')});
  const scene={requirement_id:'CAP-003',scenario_id:'S01'},t=record('T2','task',{title:'Add a new synthetic requirement',phase:'execute',depends_on:[ref('T1','tasks')],requirements:['CAP-003'],delta_refs:[ref('D2','scope')],scenario_refs:[scene],spec_change_reason:'New identity after the old one was retired'},'T2');f.apply('record',{record:t});
  const d=record('D2','spec_delta',{base:[{path:specPath,sha256:digest(f.read(specPath))}],new_spec_headers:[],operations:[{operation_id:'O2',action:'ADDED',path:specPath,requirement_id:'CAP-003',before_sha256:null,after_markdown:f.replacement.replaceAll('CAP-001','CAP-003'),removed_scenarios:[],reason:'Explicit later synthetic addition'}]},'T2');f.apply('record',{record:d});
  const definition=path=>({kind:'definition',path,sha256:definitionDigest(parseWorkflowDocument(f.read(path),path))}),artifacts=[f.artifacts[0],definition(iteration+'/scope.md'),definition(iteration+'/tasks.md')],approvals=[];
  for(const purpose of ['scope','design','plan']){const id='T2-'+purpose;f.apply('record',{record:record(id,'confirmation',{purpose,result:'approved',artifacts:[definition(iteration+'/'+(purpose==='plan'?'tasks':purpose)+'.md')],supersedes:[]},null)});approvals.push(ref(id));}
  f.apply('prepare',{iteration,task:'T2',confirmations:approvals});f.apply('start');f.apply('verify');
  f.apply('record',{record:record('C2','check',{result:'passed',command:'Explicit synthetic check, not actual execution',exit_code:0,test_count:1,evidence:[{kind:'file',path:'evidence.txt',sha256:digest(f.read('evidence.txt'))}],artifacts,covers:[scene]},'T2')});
  f.apply('record',{record:record('R2','review',{result:'passed',context_id:'fixture:T2-independent',must_fix_open:0,artifacts,covers:[scene],mode:'independent'},'T2')});f.apply('await',{waiting_for:'task_acceptance',check_refs:[ref('C2')],review_refs:[ref('R2')]});
  f.apply('record',{record:record('A2','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]},'T2')});f.apply('confirm',{confirmation_refs:[ref('A2')]});f.apply('spec_sync',{iteration,task:'T2'});assert.match(f.read(specPath),/CAP-003/);assert.ok(!f.read(specPath).includes('CAP-001'));
});
test('spec sync workflow: an oversized recovery plan is rejected before any write',async()=>{
  const f=await syncFixture(),targets=[];f.delta.data.base=[];f.delta.data.operations=[];f.task.data.requirements=[];f.task.data.scenario_refs=[];
  for(let index=0;index<34;index++){
    const id='CAP-'+(100+index),path='docs/project/specs/large-'+index+'.md',before='# Large synthetic fixture\n## Purpose\n'+('x'.repeat(800000))+'\n## Scope\nExplicit synthetic input.\n## Requirements\n'+req(id,60);f.write(path,before);targets.push(path);
    f.delta.data.base.push({path,sha256:digest(before)});f.delta.data.operations.push({operation_id:'O'+index,action:'MODIFIED',path,requirement_id:id,before_sha256:parseSpecification(before,path).sections.get(id).sha256,after_markdown:req(id,120),removed_scenarios:[],reason:'Synthetic bounded-plan test'});f.task.data.requirements.push(id);f.task.data.scenario_refs.push({requirement_id:id,scenario_id:'S01'});
  }
  f.write(iteration+'/scope.md','# Scope\n'+renderWorkflowRecord(f.delta));f.write(iteration+'/tasks.md','# Tasks\n'+renderWorkflowRecord(f.task));
  const artifacts=[f.artifacts[0],...['scope','tasks'].map(name=>{const path=iteration+'/'+name+'.md';return {kind:'definition',path,sha256:definitionDigest(parseWorkflowDocument(f.read(path),path))};})],verification=parseWorkflowDocument(f.read(iteration+'/verification.md'),iteration+'/verification.md');
  for(const r of verification.records.values())if(['check','review'].includes(r.kind)||r.kind==='confirmation'&&r.data.purpose==='task_acceptance'){r.data.artifacts=artifacts;if(r.data.covers)r.data.covers=f.task.data.scenario_refs;}
  f.write(verification.path,'# Verification\n'+[...verification.records.values()].map(renderWorkflowRecord).join('\n'));const state=f.current();state.basis=[...state.basis.map(x=>x.path),...targets].map(path=>({path,sha256:digest(f.read(path))}));f.write('docs/workflow/state.yaml',JSON.stringify(state));
  const before=snapshot(f.root,true);assert.throws(()=>planWorkflowOperation(f.root,f.syncRequest()),/log.*(?:budget|limit|large)/iu);assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync workflow: planned new directories must fit the existing inventory limit',async()=>{
  const f=await syncFixture({mode:'ADDED'});for(let index=0;index<996;index++)fs.mkdirSync(join(f.root,'docs/project/specs/empty-'+index));const before=snapshot(f.root,true);assert.throws(()=>planWorkflowOperation(f.root,f.syncRequest()),/director.*(?:limit|exceeds)/iu);assert.deepEqual(snapshot(f.root,true),before);
});
