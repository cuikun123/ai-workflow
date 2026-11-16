import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {syncFixture,snapshot,iteration,specPath,ref,record,req} from '../helpers/spec-sync.mjs';
import {parseWorkflowDocument,renderWorkflowRecord} from '../../src/workflow-docs.mjs';
import {applyWorkflowTransition,planWorkflowOperation} from '../../src/workflow-journal.mjs';
import {inspectSpecifications} from '../../src/spec-deltas.mjs';
const conflict=fn=>assert.throws(fn,e=>['CONFLICT','STATE_INVALID','INCOMPLETE'].includes(e.code));
test('spec sync: BOM and unrelated bytes survive replacement and final requirement removal',async()=>{
  for(const mode of ['MODIFIED','REMOVED']){
    const f=await syncFixture({mode,bom:true,crlf:true,onlyRequirement:mode==='REMOVED'});
    applyWorkflowTransition(f.root,f.syncRequest());assert.ok(f.read(specPath).startsWith('\ufeff'));
    const expected=mode==='MODIFIED'?f.before.replaceAll('60','120'):f.before.slice(0,f.before.indexOf('### Requirement:'));
    assert.equal(f.read(specPath),expected);const checked=inspectSpecifications(f.root);assert.equal(checked.valid,true,JSON.stringify(checked.issues));
  }
});

test('spec sync: preview plans only the accepted first task and writes nothing',async()=>{
  const f=await syncFixture({nextTask:true}),before=snapshot(f.root,true),plan=planWorkflowOperation(f.root,f.syncRequest());
  const spec=plan.files.find(x=>x.path===specPath);assert.match(spec.after.toString(),/limit MUST be 120/);assert.match(spec.after.toString(),/limit MUST be 10/);assert.doesNotMatch(spec.after.toString(),/limit MUST be 20/);
  assert.deepEqual(snapshot(f.root,true),before);assert.equal(f.current().revision,0);assert.equal(plan.afterState.revision,1);assert.equal(plan.sync_ref.path,iteration+'/verification.md');
});
test('spec sync: applied receipt and state agree, duplicate request does not write again',async()=>{
  const f=await syncFixture({nextTask:true}),request=f.syncRequest(),result=applyWorkflowTransition(f.root,request);
  assert.equal(result.action,'applied');assert.ok(result.sync_ref);assert.equal(f.current().phase,'closeout');assert.equal(f.current().revision,1);
  const inspection=inspectSpecifications(f.root,{taskRef:ref('T1','tasks')});assert.equal(inspection.valid,true,JSON.stringify(inspection.issues));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='STALE_DELTA_BASE'&&x.record_id==='D2'),'The unaccepted second task must rebase its changed file');
  const before=snapshot(f.root,true);assert.equal(applyWorkflowTransition(f.root,request).action,'already_applied');assert.deepEqual(snapshot(f.root,true),before);
  const tasks=parseWorkflowDocument(f.read(iteration+'/tasks.md'),iteration+'/tasks.md');assert.equal(tasks.records.get('T2').data.progress.status,'not_started');
});
test('spec sync: awaiting acceptance and externally changed specs remain untouched',async()=>{
  for(const accepted of [false,true]){const f=await syncFixture({accepted});if(accepted)f.write(specPath,f.before+'\nA later human edit.\n');const before=snapshot(f.root,true);conflict(()=>applyWorkflowTransition(f.root,f.syncRequest()));assert.deepEqual(snapshot(f.root,true),before);}
});
test('spec sync: added files and removed last requirements preserve unrelated content',async()=>{
  for(const mode of ['ADDED','REMOVED']){const f=await syncFixture({mode,onlyRequirement:mode==='REMOVED'}),before=f.read(specPath);applyWorkflowTransition(f.root,f.syncRequest());if(mode==='ADDED'){assert.equal(f.read(specPath),before);assert.match(f.read(f.path),/CAP-003/);}else{assert.ok(!f.read(specPath).includes('### Requirement:'));assert.ok(f.read(specPath).includes('## Purpose'));}assert.equal(inspectSpecifications(f.root).valid,true,JSON.stringify(inspectSpecifications(f.root).issues));}
});
test('spec sync: no-business-change receipt is required for completion too',async()=>{
  const f=await syncFixture({mode:'NONE'}),before=f.read(specPath),synced=applyWorkflowTransition(f.root,f.syncRequest());
  assert.equal(f.read(specPath),before);const receipts=parseWorkflowDocument(f.read(iteration+'/verification.md'),iteration+'/verification.md');
  assert.equal(receipts.records.get(synced.sync_ref.record_id).data.result,'not_needed');
  const close=record('CL1','closeout',{result:'completed',specs:'not_needed',git:'not_applicable',reason:'Explicit fixture has no Git operation',reference:'fixture:closeout',artifacts:f.artifacts,sync_ref:synced.sync_ref});
  f.apply('record',{record:close});f.apply('complete',{closeout_ref:ref('CL1')});assert.equal(f.current().status,'completed');
});
test('spec sync: callers cannot supply synchronization receipts or claim completion without a committed sync',async()=>{
  const f=await syncFixture(),plan=planWorkflowOperation(f.root,f.syncRequest());
  const receipt=parseWorkflowDocument(plan.files.find(x=>x.path===iteration+'/verification.md').after.toString(),iteration+'/verification.md').records.get(plan.sync_ref.record_id);
  const before=snapshot(f.root,true);conflict(()=>f.apply('record',{record:receipt}));assert.deepEqual(snapshot(f.root,true),before);
  for(const file of plan.files){fs.mkdirSync(join(f.root,file.path,'..'),{recursive:true});fs.writeFileSync(join(f.root,file.path),file.after);}
  const close=record('CL1','closeout',{result:'completed',specs:'synced',git:'not_applicable',reason:'Synthetic forged plan application',reference:'fixture:fake',artifacts:f.artifacts,sync_ref:plan.sync_ref});
  f.apply('record',{record:close});const forged=snapshot(f.root,true);conflict(()=>f.apply('complete',{closeout_ref:ref('CL1')}));assert.deepEqual(snapshot(f.root,true),forged);
});
test('spec sync: duplicate requests detect later edits while closeout remains unfinished',async()=>{
  const f=await syncFixture(),request=f.syncRequest();applyWorkflowTransition(f.root,request);f.write(specPath,f.read(specPath)+'\nA later human edit.\n');const before=snapshot(f.root,true);conflict(()=>applyWorkflowTransition(f.root,request));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec sync: unrelated sections and CRLF bytes survive a requirement replacement',async()=>{
  const f=await syncFixture({crlf:true});applyWorkflowTransition(f.root,f.syncRequest());assert.equal(f.read(specPath),f.before.replace(f.delta.data.operations[0].after_markdown.replaceAll('120','60'),f.replacement));
});
