import test from 'node:test';
import assert from 'node:assert/strict';
import {specification,requirement,specPath,hash} from '../helpers/specs.mjs';
const load=()=>import('../../src/spec-docs.mjs');

test('spec parser: stable identities retain exact Unicode and CRLF source sections',async()=>{
  const {parseSpecification}=await load(),raw=requirement().replaceAll('\n','\r\n'),text=specification(raw).replace('Test fixture','\u4e2d\u6587');
  const doc=parseSpecification(text,specPath);
  assert.deepEqual(doc.issues,[]);assert.equal(doc.requirements.get('CAP-001').scenarios.get('S01').id,'S01');
  const section=doc.sections.get('CAP-001');assert.equal(text.slice(section.start,section.end),raw);assert.equal(section.sha256,hash(raw));
});
test('spec parser: fenced and commented examples cannot create requirements or scenarios',async()=>{
  const {parseSpecification}=await load(),example='\n````markdown\n'+requirement('FAKE-001')+'````\n<!--\n'+requirement('FAKE-002')+'-->\n';
  const doc=parseSpecification(specification(requirement()+example),specPath);
  assert.deepEqual([...doc.requirements.keys()],['CAP-001']);assert.deepEqual([...doc.requirements.get('CAP-001').scenarios.keys()],['S01']);assert.deepEqual(doc.issues,[]);
});
test('spec parser: malformed placement, aliases, missing IDs and scenario steps are errors',async()=>{
  const {parseSpecification}=await load();
  const cases=[
    [requirement()+requirement('cap-001'),'DUPLICATE_REQUIREMENT'],
    [requirement('CAP-001',['S01','s01']),'DUPLICATE_SCENARIO'],
    [requirement().replace('Scenario: S01 Example','Scenario: Unnumbered'),'MISSING_SCENARIO_ID'],
    [requirement().replace('- **THEN** the expected result is visible',''),'MISSING_SCENARIO_STEP'],
    ['#### Scenario: S01 Orphan\n- **WHEN** x\n- **THEN** y\n','ORPHAN_SCENARIO']
  ];
  for(const [body,code]of cases)assert.ok(parseSpecification(specification(body),specPath).issues.some(x=>x.code===code),code);
  const misplaced=requirement()+specification(requirement('OTHER-001'));assert.ok(parseSpecification(misplaced,specPath).issues.some(x=>x.code==='REQUIREMENT_OUTSIDE_SECTION'));
});
test('spec parser: legacy text is diagnosed without inventing identifiers',async()=>{
  const {parseSpecification}=await load(),text='### Requirement: Unnumbered\nThe existing text stays as authored.\n';
  const doc=parseSpecification(text,specPath,{legacy:true});
  assert.ok(doc.issues.some(x=>x.code==='LEGACY_SPEC'));assert.equal(doc.text,text);assert.equal(doc.requirements.size,0);
});
test('spec parser: bounded input, safe paths, unclosed fences and ATX headings are checked',async()=>{
  const {parseSpecification}=await load();
  for(const [text,path]of [[specification(),'../outside.md'],['x'.repeat(1024*1024+1),specPath],['\u0000',specPath]])assert.throws(()=>parseSpecification(text,path),e=>['STATE_INVALID','CONFLICT'].includes(e.code));
  assert.ok(parseSpecification(specification()+'\n```\n',specPath).issues.some(x=>x.code==='UNCLOSED_FENCE'));
  const closed=specification().replace('## Requirements','## Requirements ##').replace('Observable behavior','Observable behavior ###');
  assert.equal(parseSpecification(closed,specPath).issues.length,0);
});
