import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {emptyPosition} from '../../src/workflow-status.mjs';
import {fixture,historicalFixture,task,check,record,block,specification,requirement,iteration,specPath,hash} from '../helpers/specs.mjs';
const load=()=>import('../../src/spec-deltas.mjs');
const taskPath=iteration+'/tasks.md',scopePath=iteration+'/scope.md',verificationPath=iteration+'/verification.md';
const delta=(before,after,removed=[])=>record('D1','spec_delta',{base:[{path:specPath,sha256:hash(specification(before))}],new_spec_headers:[],operations:[{operation_id:'O1',action:'MODIFIED',path:specPath,requirement_id:'CAP-001',before_sha256:hash(before),after_markdown:after,removed_scenarios:removed,reason:'Explicit fixture change'}]});

test('spec references: a task and check resolve requirement/scenario identities without writes',async()=>{
  const {inspectSpecifications}=await load(),f=fixture();f.write(taskPath,block(task()));f.write(verificationPath,block(check()));
  const before=fs.readFileSync(join(f.root,taskPath));const result=inspectSpecifications(f.root);
  assert.equal(result.valid,true,JSON.stringify(result.issues));assert.equal(result.requirement_count,1);assert.equal(result.scenario_count,1);
  assert.deepEqual(fs.readFileSync(join(f.root,taskPath)),before);assert.equal(result.acceptance_verified,false);
});
test('spec references: missing, wrong-case, wrong-owner and unlinked scenarios are reported',async()=>{
  const {inspectSpecifications}=await load();
  for(const t of [task({requirements:['MISSING']}),task({scenario_refs:[{requirement_id:'CAP-001',scenario_id:'s01'}]}),task({scenario_refs:[]})]){
    const f=fixture();f.write(taskPath,block(t));assert.equal(inspectSpecifications(f.root).valid,false);
  }
  const f=fixture();f.write(taskPath,block(task()));f.write(verificationPath,block({...check(),task:'MISSING'}));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='BAD_TASK_REFERENCE'));
});
test('spec delta: declared replacements preserve scenes unless removal is explicit',async()=>{
  const {inspectSpecifications}=await load(),before=requirement('CAP-001',['S01','S02']),after=requirement();
  const f=fixture(specification(before));f.write(taskPath,block(task({delta_refs:[{path:scopePath,record_id:'D1'}]})));f.write(scopePath,block(delta(before,after)));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='UNDECLARED_SCENARIO_REMOVAL'));
  f.write(scopePath,block(delta(before,after,['S02'])));assert.equal(inspectSpecifications(f.root).valid,true,JSON.stringify(inspectSpecifications(f.root).issues));
});
test('spec delta: old bases, unsafe paths, duplicate operation targets and invented additions fail',async()=>{
  const {inspectSpecifications}=await load(),before=requirement(),base=delta(before,before);
  for(const mutate of [
    r=>r.data.base[0].sha256='0'.repeat(64),
    r=>r.data.operations[0].path='../outside.md',
    r=>r.data.operations.push({...r.data.operations[0],operation_id:'O2'}),
    r=>{r.data.operations[0].action='ADDED';r.data.operations[0].before_sha256=null;}
  ]){const f=fixture();const d=structuredClone(base);mutate(d);f.write(taskPath,block(task({delta_refs:[{path:scopePath,record_id:'D1'}]})));f.write(scopePath,block(d));assert.equal(inspectSpecifications(f.root).valid,false);}
});
test('spec references: duplicate project IDs and unsafe filesystem entries cannot be skipped',async()=>{
  const {inspectSpecifications}=await load(),f=fixture();f.write('docs/project/specs/other.md',specification(requirement('cap-001')));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='DUPLICATE_REQUIREMENT'));
  const linked=fixture(),outside=fixture();
  fs.symlinkSync(join(outside.root,'docs/project/specs'),join(linked.root,'docs/project/specs/linked'),'junction');
  assert.ok(inspectSpecifications(linked.root).issues.some(x=>x.code==='INVALID_DOCUMENT_INVENTORY'));
});
test('spec delta: removed requirement and scene identities remain available for exit verification',async()=>{
  const {inspectSpecifications}=await load(),before=requirement('CAP-001',['S01','S02']);
  for(const action of ['REMOVED','MODIFIED']){
    const f=fixture(specification(before)),d=delta(before,action==='REMOVED'?null:requirement(),action==='REMOVED'?['S01','S02']:['S02']);d.data.operations[0].action=action;
    f.write(taskPath,block(task({delta_refs:[{path:scopePath,record_id:'D1'}],scenario_refs:[{requirement_id:'CAP-001',scenario_id:'S02'}]})));f.write(scopePath,block(d));f.write(verificationPath,block(check([{requirement_id:'CAP-001',scenario_id:'S02'}])));
    const result=inspectSpecifications(f.root);assert.equal(result.valid,true,JSON.stringify(result.issues));
  }
});
test('spec delta: new files require explicit headers and two drafts cannot reserve the same new ID',async()=>{
  const {inspectSpecifications}=await load(),f=fixture(),newPath='docs/project/specs/new.md';
  const d=record('D1','spec_delta',{base:[{path:newPath,sha256:null}],new_spec_headers:[{path:newPath,markdown:'# New\n## Purpose\nA new fixture.\n## Scope\nOne behavior.\n## Requirements\n'}],operations:[{operation_id:'O1',action:'ADDED',path:newPath,requirement_id:'CAP-002',before_sha256:null,after_markdown:requirement('CAP-002'),removed_scenarios:[],reason:'Synthetic addition'}]});
  const t=task({requirements:['CAP-002'],scenario_refs:[{requirement_id:'CAP-002',scenario_id:'S01'}],delta_refs:[{path:scopePath,record_id:'D1'}]});
  f.write(taskPath,block(t));f.write(scopePath,block(d));assert.equal(inspectSpecifications(f.root).valid,true,JSON.stringify(inspectSpecifications(f.root).issues));
  const d2=structuredClone(d);d2.id='D2';d2.task='T2';const t2=structuredClone(t);t2.id=t2.task='T2';t2.data.delta_refs=[{path:scopePath,record_id:'D2'}];
  f.write(taskPath,block(t)+block(t2));f.write(scopePath,block(d)+block(d2));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='DUPLICATE_DRAFT_ID'));
});
test('spec records: receipts cannot bypass missing approval/evidence/closeout references',async()=>{
  const {inspectSpecifications}=await load(),f=fixture(),before=requirement(),d=delta(before,before);
  const receipt=record('S1','spec_sync',{delta_refs:[{path:scopePath,record_id:'D1'}],acceptance_ref:{path:verificationPath,record_id:'MISSING-ACCEPTANCE'},check_refs:[{path:verificationPath,record_id:'MISSING-CHECK'}],review_refs:[{path:verificationPath,record_id:'MISSING-REVIEW'}],request_id:'r1',operation_id:'o1',targets:[{path:specPath,before_sha256:hash(specification()),after_sha256:hash(specification())}],operations:[{path:scopePath,record_id:'D1',operation_id:'O1'}],result:'synced'});
  f.write(taskPath,block(task({delta_refs:[{path:scopePath,record_id:'D1'}]})));f.write(scopePath,block(d));f.write(verificationPath,block(receipt));
  assert.equal(inspectSpecifications(f.root).valid,false);
});
test('spec references: acceptance-stage required scenes need referenced passing coverage',async()=>{
  const {inspectSpecifications}=await load(),f=fixture(),progress={...emptyPosition('accept'),status:'awaiting_user',waiting_for:'task_acceptance',check_refs:[{path:verificationPath,record_id:'C1'}],review_refs:[{path:verificationPath,record_id:'R1'}]};
  const review=record('R1','review',{result:'passed',context_id:'fixture:independent',must_fix_open:0,artifacts:check().data.artifacts,covers:[{requirement_id:'CAP-001',scenario_id:'S01'}],mode:'independent'});
  f.write(taskPath,block(task({progress})));f.write(verificationPath,block(check([]))+block(review));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='MISSING_SCENARIO_COVERAGE'));
  f.write(verificationPath,block(check())+block(review));assert.equal(inspectSpecifications(f.root).valid,true,JSON.stringify(inspectSpecifications(f.root).issues));
});
test('spec delta: operation requirements must be associated with their owning task',async()=>{
  const {inspectSpecifications}=await load(),before=requirement('CAP-002'),f=fixture(specification(requirement()+before)),d=delta(before,before);
  d.data.base[0].sha256=hash(specification(requirement()+before));d.data.operations[0].requirement_id='CAP-002';
  f.write(taskPath,block(task({delta_refs:[{path:scopePath,record_id:'D1'}]})));f.write(scopePath,block(d));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='UNLINKED_DELTA_REQUIREMENT'));
});
test('spec delta: replacement text cannot escape the declared requirement section',async()=>{
  const {inspectSpecifications}=await load(),f=fixture(),before=requirement(),d=delta(before,before+'\n## Extra scope\nAn undeclared behavior.\n');
  f.write(taskPath,block(task({delta_refs:[{path:scopePath,record_id:'D1'}]})));f.write(scopePath,block(d));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='INVALID_REPLACEMENT_SCOPE'));
});
test('spec history: recorded retired identities cannot be resurrected in effective specifications',async()=>{
  const {inspectSpecifications}=await load(),f=historicalFixture();
  assert.equal(inspectSpecifications(f.root).valid,true,JSON.stringify(inspectSpecifications(f.root).issues));
  f.write(specPath,specification(requirement('CAP-002')+requirement()));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='RETIRED_REQUIREMENT_REUSED'));
});
test('spec history: empty or stale receipt targets do not bypass the file base',async()=>{
  const {inspectSpecifications}=await load();
  const empty=historicalFixture();empty.receipt.data.targets=[];empty.writeReceipt(empty.receipt);
  assert.equal(inspectSpecifications(empty.root).valid,false);
  const stale=historicalFixture();stale.task.data.progress.status='ready';stale.write(taskPath,block(stale.task));stale.receipt.data.targets[0].after_sha256='0'.repeat(64);stale.writeReceipt(stale.receipt);
  assert.ok(inspectSpecifications(stale.root).issues.some(x=>x.code==='STALE_SYNC_TARGET'));
});
test('spec history: unfinished receipts must match actual requirement results, not just a file digest',async()=>{
  const {inspectSpecifications}=await load(),f=historicalFixture();
  f.task.data.progress.status='ready';f.write(taskPath,block(f.task));
  const d=record('D0','spec_delta',{base:[{path:specPath,sha256:f.receipt.data.targets[0].before_sha256}],new_spec_headers:[],operations:[{operation_id:'O0',action:'MODIFIED',path:specPath,requirement_id:'CAP-001',before_sha256:hash(requirement()+'\n'),after_markdown:requirement(),removed_scenarios:[],reason:'Synthetic incomplete synchronization'}]},'T0');
  f.write(scopePath,block(d));
  assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='STALE_SYNC_RESULT'));
});
test('spec history: completed changes still require declared requirement base digests',async()=>{
  const {inspectSpecifications}=await load();
  for(const action of ['REMOVED','MODIFIED']){
    const f=historicalFixture(),d=record('D0','spec_delta',{base:[{path:specPath,sha256:f.receipt.data.targets[0].before_sha256}],new_spec_headers:[],operations:[{operation_id:'O0',action,path:specPath,requirement_id:'CAP-001',before_sha256:null,after_markdown:action==='REMOVED'?null:requirement(),removed_scenarios:action==='REMOVED'?['S01']:[],reason:'Synthetic malformed history'}]},'T0');
    f.write(scopePath,block(d));assert.ok(inspectSpecifications(f.root).issues.some(x=>x.code==='MISSING_REQUIREMENT_BASE'));
  }
});
test('spec records: v2 definitions bind machine delta and references while v1 remains unchanged',async()=>{
  const {parseWorkflowDocument,definitionDigest}=await import('../../src/workflow-docs.mjs'),before=requirement(),d=delta(before,before);
  const a=parseWorkflowDocument(block(d),scopePath),changed=structuredClone(d);changed.data.operations[0].reason='A materially different fixture';
  assert.notEqual(definitionDigest(a),definitionDigest(parseWorkflowDocument(block(changed),scopePath)));
  const t=task(),first=definitionDigest(parseWorkflowDocument(block(t),taskPath));t.data.scenario_refs=[];
  assert.notEqual(first,definitionDigest(parseWorkflowDocument(block(t),taskPath)));
});
