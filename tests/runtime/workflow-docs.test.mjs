import test from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../../src/workflow-docs.mjs');
const task = () => ({ record_version: 1, id: 'T1', kind: 'task', iteration: 'docs/iterations/001-work', task: 'T1', source: { role: 'assistant', reference: 'fixture:plan', text: 'Explicit fictitious test input' }, data: { title: 'A tested task', phase: 'execute', depends_on: [], requirements: ['CAP-001'] } });
const block = record => `<!-- iterlane:record ${record.id} -->\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n<!-- /iterlane:record ${record.id} -->\n`;
const path = 'docs/iterations/001-work/tasks.md';

test('workflow Markdown: inline backticks and commented headings cannot hide or invent real requirements',async()=>{
  const {parseWorkflowDocument}=await load();
  const text='```npm test```\n### Requirement: CAP-001 Actual\n<!--\n### Requirement: FAKE-001 Example\n-->\n';
  assert.deepEqual(parseWorkflowDocument(text,'docs/project/specs/sample.md').requirements,['CAP-001']);
});

test('workflow records: real records have stable IDs while fenced examples remain ordinary prose', async () => {
  const { parseWorkflowDocument } = await load();
  const text = '# Task plan\r\n\r\n````markdown\n'+block(task())+'````\n\n'+block(task());
  const doc = parseWorkflowDocument(text, path);
  assert.equal(doc.records.size, 1);assert.equal(doc.records.get('T1').data.title, 'A tested task');
  assert.ok(doc.body.startsWith('# Task plan\r\n'));assert.ok(doc.body.includes('````markdown'));
});

test('workflow records: malformed, duplicate, case-alias and wrong-file IDs are rejected', async () => {
  const { parseWorkflowDocument } = await load();
  for (const text of [block(task())+block(task()), block(task())+block({...task(),id:'t1',task:'t1'}), block(task()).replace('/iterlane:record T1','/iterlane:record other'), '<!-- iterlane:record T1 -->\n', block(task()).replace('"id": "T1",','"id": "T1", "id": "T2",')]) {
    assert.throws(()=>parseWorkflowDocument(text,path),e=>e.code==='STATE_INVALID');
  }
  assert.throws(()=>parseWorkflowDocument(block(task()),'docs/project/overview.md'),e=>e.code==='STATE_INVALID');
});

test('workflow records: bad roles, unsafe references, unknown properties and oversized text are rejected', async () => {
  const { parseWorkflowDocument } = await load();
  const base = { record_version:1,id:'approval',kind:'confirmation',iteration:'docs/iterations/001-work',task:'T1',source:{role:'user',reference:'fixture:user',text:'Synthetic approval, never actual user acceptance'},data:{purpose:'task_acceptance',result:'approved',artifacts:[{kind:'file',path:'server.mjs',sha256:'a'.repeat(64)}],supersedes:[]} };
  const file = 'docs/iterations/001-work/verification.md';
  for(const value of [{...base,source:{...base.source,role:'assistant'}},{...base,data:{...base.data,approved:true}},{...base,data:{...base.data,artifacts:[{kind:'file',path:'../secret',sha256:'a'.repeat(64)}]}},{...base,source:{...base.source,text:'x'.repeat(20000)}}])assert.throws(()=>parseWorkflowDocument(block(value),file),e=>e.code==='STATE_INVALID');
});

test('workflow definitions: runtime records and progress do not reapprove a changed task definition', async () => {
  const { parseWorkflowDocument, definitionDigest } = await load();
  const initial = parseWorkflowDocument('# Plan\n\n'+block(task()),path);
  const position = {phase:'execute',status:'running',waiting_for:null,checkpoint_ref:null,confirmation_refs:[],blocker_refs:[],check_refs:[],review_refs:[],closeout_ref:null};
  const progressed = parseWorkflowDocument('# Plan\n\n'+block({...task(),data:{...task().data,progress:position}}),path);
  const changed = parseWorkflowDocument('# Plan\n\n'+block({...task(),data:{...task().data,title:'A different deliverable'}}),path);
  assert.equal(definitionDigest(initial),definitionDigest(progressed));assert.notEqual(definitionDigest(initial),definitionDigest(changed));
  assert.notEqual(definitionDigest(initial),definitionDigest(parseWorkflowDocument('# Another plan\n\n'+block(task()),path)));
});

test('workflow documents: empty initial docs are valid and headings/links in examples are ignored', async () => {
  const { parseWorkflowDocument } = await load();
  assert.equal(parseWorkflowDocument('',path).records.size,0);
  const text='### Requirement: CAP-001 A real requirement\n[Scope](../001-work/scope.md)\n```markdown\n### Requirement: CAP-002 Example only\n[Fake](missing.md)\n```\n';
  const doc=parseWorkflowDocument(text,'docs/project/specs/sample.md');
  assert.deepEqual(doc.requirements,['CAP-001']);assert.deepEqual(doc.links.map(x=>x.target),['../001-work/scope.md']);
});

test('workflow document updates preserve outside Unicode/CRLF and refuse an existing ID', async () => {
  const { appendWorkflowRecord, replaceWorkflowRecord, parseWorkflowDocument } = await load();
  const original='\ufeffExisting user prose 中文\r\n';
  const appended=appendWorkflowRecord(original,task(),path);assert.ok(appended.startsWith(original));
  const changed={...task(),data:{...task().data,title:'Changed title'}};
  const replaced=replaceWorkflowRecord(appended,changed,path);assert.ok(replaced.startsWith(original));assert.equal(parseWorkflowDocument(replaced,path).records.get('T1').data.title,'Changed title');
  assert.throws(()=>appendWorkflowRecord(appended,task(),path),e=>e.code==='CONFLICT');
});
