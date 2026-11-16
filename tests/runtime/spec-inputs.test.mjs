import test from 'node:test';import assert from 'node:assert/strict';import * as fs from 'node:fs';import {join} from 'node:path';
import {fixture,specPath,iteration,task,block,record,hash} from '../helpers/specs.mjs';
import {inspectSpecifications} from '../../src/spec-deltas.mjs';import {checkArtifact} from '../../src/workflow-artifacts.mjs';
import {snapshot} from '../helpers/installation.mjs';
test('spec inputs: checked preimages and definitions are usable by the existing artifact validator without writes',()=>{
  const f=fixture();f.write(iteration+'/tasks.md',block(task()));const before=snapshot(f.root,true),result=inspectSpecifications(f.root);assert.equal(result.valid,true,JSON.stringify(result.issues));
  assert.ok(Array.isArray(result.specifications),'The checker must supply exact file preimages');assert.ok(Array.isArray(result.requirements),'The checker must supply requirement preimages');assert.ok(Array.isArray(result.definitions),'The checker must supply definition digests');
  const definition=result.definitions.find(x=>x.path===iteration+'/tasks.md');assert.ok(definition);assert.equal(checkArtifact(f.root,{kind:'definition',...definition}).valid,true);
  const requirement=result.requirements.find(x=>x.id==='CAP-001');assert.ok(requirement.sha256);assert.ok(requirement.scenario_ids.includes('S01'));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec inputs: BOM file preimages can directly establish a valid delta',()=>{
  const f=fixture();f.write(specPath,'\ufeff'+fs.readFileSync(join(f.root,specPath),'utf8'));
  const initial=inspectSpecifications(f.root);assert.equal(initial.valid,true,JSON.stringify(initial.issues));
  const base=initial.specifications.find(x=>x.path===specPath),req=initial.requirements.find(x=>x.id==='CAP-001');
  assert.equal(base.sha256,hash(fs.readFileSync(join(f.root,specPath))));
  const after=fs.readFileSync(join(f.root,specPath),'utf8').split('### Requirement:')[1];
  const delta=record('D1','spec_delta',{base:[base],new_spec_headers:[],operations:[{operation_id:'O1',action:'MODIFIED',path:specPath,requirement_id:req.id,before_sha256:req.sha256,after_markdown:'### Requirement:'+after,removed_scenarios:[],reason:'Synthetic BOM replacement'}]});
  f.write(iteration+'/scope.md',block(delta));f.write(iteration+'/tasks.md',block(task({delta_refs:[{path:iteration+'/scope.md',record_id:'D1'}]})));
  const before=snapshot(f.root,true),checked=inspectSpecifications(f.root);assert.equal(checked.valid,true,JSON.stringify(checked.issues));assert.deepEqual(snapshot(f.root,true),before);
});
test('spec inputs: unrelated prose changes alter the file digest but keep the requirement digest',()=>{
  const f=fixture(),a=inspectSpecifications(f.root);assert.ok(Array.isArray(a.specifications));assert.ok(Array.isArray(a.requirements));
  const text=fs.readFileSync(join(f.root,specPath),'utf8');fs.writeFileSync(join(f.root,specPath),text.replace('A fictitious capability.','A fictitious capability with a note.'));
  const b=inspectSpecifications(f.root);assert.equal(b.valid,true,JSON.stringify(b.issues));assert.notEqual(a.specifications.find(x=>x.path===specPath).sha256,b.specifications.find(x=>x.path===specPath).sha256);assert.equal(a.requirements.find(x=>x.id==='CAP-001').sha256,b.requirements.find(x=>x.id==='CAP-001').sha256);
});
