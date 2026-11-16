import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {syncFixture,snapshot,specPath} from '../helpers/spec-sync.mjs';
import {applyWorkflowTransition,recoverWorkflowTransition} from '../../src/workflow-journal.mjs';
import {readWorkflowLogs} from '../../src/workflow-log.mjs';

async function interrupted(mode='MODIFIED'){
  const f=await syncFixture({mode});let fired=false;
  assert.throws(()=>applyWorkflowTransition(f.root,f.syncRequest(),{io:{...fs,renameSync(from,to){if(!fired&&to===join(f.root,'docs/workflow/state.yaml')){fired=true;throw Object.assign(Error('Explicit interrupted sync fixture'),{code:'EIO'});}return fs.renameSync(from,to);}}}));
  assert.equal(fired,true);const log=readWorkflowLogs(f.root).find(x=>x.data.phase==='blocked');assert.ok(log);return {...f,log};
}
test('spec sync recovery: interrupted sync resumes and binds the same receipt',async()=>{
  const f=await interrupted(),revision=f.current().revision,before=snapshot(f.root,true);
  recoverWorkflowTransition(f.root,'resume',revision,{operationId:f.log.data.operation_id,preview:true});assert.deepEqual(snapshot(f.root,true),before);
  const result=recoverWorkflowTransition(f.root,'resume',revision,{operationId:f.log.data.operation_id});assert.equal(result.action,'resumed');assert.match(f.read(specPath),/limit MUST be 120/);assert.equal(f.current().phase,'closeout');
});
test('spec sync recovery: finite undo removes only a verifiable newly created spec',async()=>{
  const f=await interrupted('ADDED');assert.ok(fs.existsSync(join(f.root,f.path)));
  recoverWorkflowTransition(f.root,'undo',f.current().revision,{operationId:f.log.data.operation_id});assert.ok(!fs.existsSync(join(f.root,f.path)));assert.equal(f.current().phase,'closeout');assert.equal(f.current().revision,1);
  assert.throws(()=>applyWorkflowTransition(f.root,f.syncRequest('sync-T1')));
});
test('spec sync recovery: later edits and new inventory members block recovery without overwrites',async()=>{
  for(const extra of [false,true]){
    const f=await interrupted();if(extra)f.write('docs/project/specs/human.md','# A later human document\n');else f.write(specPath,f.read(specPath)+'\nA later human edit.\n');
    const before=snapshot(f.root,true);for(const mode of ['resume','undo'])assert.throws(()=>recoverWorkflowTransition(f.root,mode,f.current().revision,{operationId:f.log.data.operation_id}));assert.deepEqual(snapshot(f.root,true),before);
  }
});
test('spec sync recovery: externally deleted applied additions are not recreated',async()=>{
  const f=await interrupted('ADDED');assert.equal(f.log.data.files.find(x=>x.path===f.path).status,'applied');fs.unlinkSync(join(f.root,f.path));const before=snapshot(f.root,true);for(const mode of ['resume','undo'])assert.throws(()=>recoverWorkflowTransition(f.root,mode,f.current().revision,{operationId:f.log.data.operation_id}));assert.deepEqual(snapshot(f.root,true),before);assert.ok(!fs.existsSync(join(f.root,f.path)));
});
