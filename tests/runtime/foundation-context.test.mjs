import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join, relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import {project, resourcePackage, snapshot} from '../helpers/installation.mjs';
import {initializeProject} from '../../src/installation.mjs';
import {validateStateYaml} from '../../src/state.mjs';
import {inspectWorkflowState} from '../../src/workflow-status.mjs';
import {canonicalJson} from '../../src/workflow-docs.mjs';

const foundation='docs/project/foundation/';
const names=['README.md','engineering.md','experience.md','operations.md','quality.md','security.md'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let pkg, base;
before(async()=>{pkg=await resourcePackage();base=project();initializeProject({packageRoot:pkg,projectRoot:base});});
const fixture=()=>{const root=project();fs.cpSync(base,root,{recursive:true,filter:p=>!relative(base,p).replaceAll('\\','/').startsWith('.ai-workflow/.local')});return root;};
const run=(root,args)=>{const r=spawnSync(process.execPath,[join(pkg,'bin/iterlane.mjs'),'context',...args,'--project',root,'--json'],{encoding:'utf8',windowsHide:true,timeout:60000});return {status:r.status,result:JSON.parse(r.stdout)};};
const inspect=root=>{const r=run(root,['inspect']);assert.equal(r.status,0,JSON.stringify(r.result));return r.result.data;};
const state=root=>validateStateYaml(fs.readFileSync(join(root,'docs/workflow/state.yaml'),'utf8'));

test('context: initialization tracks all six empty foundations and the design without invented approval',()=>{
  const root=fixture(),s=state(root);
  for(const name of names)assert.ok(s.basis.some(e=>e.path===foundation+name),name);
  assert.ok(s.basis.some(e=>e.path==='docs/iterations/000-foundation/design.md'));
  assert.equal(s.current_task,null);assert.equal(s.status,'not_started');assert.deepEqual(s.confirmation_refs,[]);
});

test('context: inspect returns actual installed rules and a stable read-only snapshot',()=>{
  const root=fixture(),before=snapshot(root,true),a=inspect(root),b=inspect(root);
  assert.equal(a.context_version,1);assert.equal(a.project_root,fs.realpathSync.native(root));
  assert.equal(a.framework.version,'0.3.0-dev.12');assert.equal(a.framework.source_manifest_sha256,JSON.parse(fs.readFileSync(join(root,'.ai-workflow/manifest.json'),'utf8')).package.source_manifest_sha256);
  assert.deepEqual(a.foundation.map(e=>e.path),names.map(n=>foundation+n));assert.match(a.snapshot_sha256,/^[a-f0-9]{64}$/u);assert.equal(a.snapshot_sha256,b.snapshot_sha256);
  assert.equal(a.semantic_completeness_verified,false);
  for(const name of names)assert.equal(a.contents.find(c=>c.path===foundation+name).text,'');
  assert.equal(a.project_rules.sha256,sha(fs.readFileSync(join(root,'AGENTS.md'))));assert.deepEqual(snapshot(root,true),before);
});

test('context: manifest stays hashed and fully checked while its metadata prose is omitted',()=>{
  const root=fixture(),manifestPath='.ai-workflow/resources/skills/_shared/manifest.json',raw=fs.readFileSync(join(root,manifestPath)),before=snapshot(root,true),a=inspect(root);
  assert.equal(a.framework.files.length,7);assert.ok(a.framework.files.some(e=>e.path===manifestPath&&e.sha256===sha(raw)));
  assert.deepEqual(a.contents.map(e=>e.path).sort(),[...a.framework.files.map(e=>e.path).filter(p=>p!==manifestPath),'AGENTS.md',...a.foundation.map(e=>e.path)].sort());
  for(const e of a.contents)assert.equal(e.text,fs.readFileSync(join(root,e.path),'utf8'),e.path);
  const {snapshot_sha256,contents,semantic_completeness_verified,...identity}=a;assert.equal(snapshot_sha256,sha(Buffer.from(canonicalJson(identity))));
  const oldContents=[...contents,{path:manifestPath,text:raw.toString('utf8')}].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),oldOutput={...a,contents:oldContents};
  assert.equal(Buffer.byteLength(JSON.stringify(oldOutput))-Buffer.byteLength(JSON.stringify(a)),Buffer.byteLength(JSON.stringify({path:manifestPath,text:raw.toString('utf8')}))+1);
  assert.deepEqual(snapshot(root,true),before);
  fs.writeFileSync(join(root,manifestPath),Buffer.concat([raw,Buffer.from('\n')]));const changed=snapshot(root,true),r=run(root,['inspect']);assert.equal(r.status,4);assert.deepEqual(snapshot(root,true),changed);
  const guard=run(root,['guard','--expected-snapshot',a.snapshot_sha256]);assert.equal(guard.status,4);assert.equal(guard.result.data.freshness,'unknown');assert.deepEqual(snapshot(root,true),changed);
});

test('context: raw BOM and CRLF text survives and state revision does not change context identity',()=>{
  const root=fixture(),text='\ufeff# Engineering\r\nLocal constraints.\r\n';fs.writeFileSync(join(root,foundation+'engineering.md'),text);
  const a=inspect(root);assert.equal(a.contents.find(e=>e.path===foundation+'engineering.md').text,text);
  const s=state(root);s.revision++;s.updated_at='2026-11-17T12:00:00Z';fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));assert.equal(inspect(root).snapshot_sha256,a.snapshot_sha256);
});

test('context: changed foundation and project rules invalidate guard without rewriting progress',()=>{
  const root=fixture(),a=inspect(root);fs.writeFileSync(join(root,foundation+'engineering.md'),'# Rule\nNo secret logging.\n');
  const before=snapshot(root,true),guard=run(root,['guard','--expected-snapshot',a.snapshot_sha256]),status=inspectWorkflowState(root);
  assert.equal(guard.status,7);assert.equal(guard.result.data.freshness,'stale');assert.equal(status.basis_current,false);assert.equal(status.diagnostic,'stale');assert.ok(status.issues.some(e=>e.code==='STALE_FOUNDATION'));
  assert.deepEqual(snapshot(root,true),before);
  const b=inspect(root);fs.appendFileSync(join(root,'AGENTS.md'),'\nA user project rule.\n');assert.notEqual(inspect(root).snapshot_sha256,b.snapshot_sha256);
});

test('context: adding an unbound Markdown member is stale even when tracked bytes match',()=>{
  const root=fixture(),a=inspect(root);fs.mkdirSync(join(root,foundation+'data'));fs.writeFileSync(join(root,foundation+'data/privacy.MD'),'# Privacy\n');
  const before=snapshot(root,true),s=inspectWorkflowState(root);assert.equal(s.basis_current,false);assert.equal(s.diagnostic,'stale');assert.ok(s.issues.some(e=>e.code==='FOUNDATION_MEMBERSHIP_CHANGED'));
  assert.ok(inspect(root).foundation.some(e=>e.path===foundation+'data/privacy.MD'));assert.equal(run(root,['guard','--expected-snapshot',a.snapshot_sha256]).status,7);assert.deepEqual(snapshot(root,true),before);
});

test('context: removing a bound extension is a membership change, missing a base file is incomplete',()=>{
  const root=fixture(),path=foundation+'extra.md';fs.writeFileSync(join(root,path),'# Extra\n');const s=state(root);s.basis.push({path,sha256:sha(fs.readFileSync(join(root,path)))});fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));
  assert.equal(inspectWorkflowState(root).valid,true);fs.rmSync(join(root,path));const missing=inspectWorkflowState(root);assert.equal(missing.diagnostic,'stale');assert.ok(missing.issues.some(e=>e.code==='FOUNDATION_MEMBERSHIP_CHANGED'));
  fs.rmSync(join(root,foundation+'security.md'));const before=snapshot(root,true),guard=run(root,['guard','--expected-snapshot','a'.repeat(64)]);
  assert.equal(guard.status,8);assert.equal(guard.result.data.freshness,'unknown');assert.ok(guard.result.data.issues.some(e=>e.code==='MISSING_FOUNDATION'));assert.deepEqual(snapshot(root,true),before);
});

test('context: dropping foundation basis does not downgrade a new installation to untracked',()=>{
  const root=fixture(),s=state(root);s.basis=s.basis.filter(e=>!e.path.startsWith(foundation));fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));
  const result=inspectWorkflowState(root);assert.equal(result.valid,false);assert.equal(result.basis_current,false);assert.ok(result.issues.some(e=>e.code==='FOUNDATION_MEMBERSHIP_CHANGED'));
});

test('context: corrupted shared source is PACKAGE_INVALID instead of fresh context',()=>{
  const root=fixture();fs.appendFileSync(join(root,'.ai-workflow/resources/skills/_shared/references/work-contract.md'),'\nCorrupt source\n');const before=snapshot(root,true),r=run(root,['inspect']);
  assert.equal(r.status,4);assert.equal(r.result.error.code,'PACKAGE_INVALID');assert.deepEqual(snapshot(root,true),before);
});

test('context: malformed business UTF-8 is refused without returning fabricated text',()=>{
  const root=fixture();fs.writeFileSync(join(root,foundation+'engineering.md'),Buffer.from([0xff,0xfe]));const before=snapshot(root,true),r=run(root,['inspect']);assert.equal(r.status,7);assert.ok(r.result.error.details.some(e=>e.code==='INVALID_CONTEXT_UTF8'));assert.deepEqual(snapshot(root,true),before);
});

test('context: linked descendants cannot expose outside foundation content',()=>{
  const root=fixture(),outside=project();fs.writeFileSync(join(outside,'secret.md'),'Outside sentinel');fs.symlinkSync(outside,join(root,foundation+'linked'),process.platform==='win32'?'junction':'dir');
  const r=run(root,['inspect']);assert.equal(r.status,7);assert.doesNotMatch(JSON.stringify(r.result),/Outside sentinel/u);
});

test('context: case and Unicode aliases are refused rather than collapsed',()=>{
  for(const variant of ['case','unicode']){const root=fixture();if(variant==='case')fs.renameSync(join(root,foundation+'engineering.md'),join(root,foundation+'Engineering.md'));else{fs.writeFileSync(join(root,foundation+'é.md'),'one');fs.writeFileSync(join(root,foundation+'e\u0301.md'),'two');}
    assert.equal(run(root,['inspect']).status,7,variant);}
});

test('context: single-file and total byte limits never silently truncate constraints',()=>{
  for(const mode of ['file','total']){const root=fixture();if(mode==='file')fs.writeFileSync(join(root,foundation+'engineering.md'),Buffer.alloc(1024*1024+1,65));else for(const name of names.slice(0,4))fs.writeFileSync(join(root,foundation+name),Buffer.alloc(1024*1024,65));
    const r=run(root,['inspect']);assert.equal(r.status,7,mode);assert.ok(r.result.error.details.some(e=>e.code==='CONTEXT_TOO_LARGE'));}
});

test('context: 257 Markdown members exceed the declared 256 document limit',()=>{
  const root=fixture();fs.mkdirSync(join(root,foundation+'extra'));for(let n=0;n<251;n++)fs.writeFileSync(join(root,foundation+'extra/'+n+'.md'),'');const r=run(root,['inspect']);assert.equal(r.status,7);assert.ok(r.result.error.details.some(e=>e.code==='FOUNDATION_LIMIT'));
});

test('context: guard is fresh only for the current digest and unsupported bind stays unavailable in C2',()=>{
  const root=fixture(),a=inspect(root),before=snapshot(root,true),fresh=run(root,['guard','--expected-snapshot',a.snapshot_sha256]);assert.equal(fresh.status,0);assert.equal(fresh.result.data.freshness,'fresh');
  for(const args of [['guard'],['guard','--expected-snapshot','bad'],['inspect','--expected-snapshot','a'.repeat(64)],['bind']])assert.equal(run(root,args).status,2);
  assert.deepEqual(snapshot(root,true),before);
});

test('context: unrelated task changes do not falsely mark foundation bytes stale',()=>{
  const root=fixture();fs.appendFileSync(join(root,'docs/iterations/000-foundation/tasks.md'),'Task note\n');
  const result=inspectWorkflowState(root);assert.equal(result.basis_current,false);assert.equal(result.foundation_current,true);
});

test('context: a foundation mutation during ending resource verification is detected',async t=>{
  const root=fixture(),target=join(root,'.ai-workflow/manifest.json'),original=fs.readFileSync.bind(fs);let manifestReads=0;
  const patched=t.mock.method(fs,'readFileSync',function(file,...args){const bytes=original(file,...args);if(file===target&&++manifestReads===2)fs.writeFileSync(join(root,foundation+'engineering.md'),'Late external change\n');return bytes;});
  syncBuiltinESMExports();t.after(()=>{patched.mock.restore();syncBuiltinESMExports();});
  const {inspectProjectContext}=await import('../../src/foundation-context.mjs');
  assert.throws(()=>inspectProjectContext(root),error=>error.code==='CONFLICT'&&error.details.some(e=>e.code==='CONTEXT_CHANGED_DURING_READ'));
});

for(const change of ['member','earlier-content'])test('context: ending content reads detect late '+change,async t=>{
  const root=fixture(),target=join(root,foundation+'security.md'),original=fs.readFileSync.bind(fs);let reads=0;
  const patched=t.mock.method(fs,'readFileSync',function(file,...args){const bytes=original(file,...args);if(file===target&&++reads===2)fs.writeFileSync(join(root,foundation+(change==='member'?'late.md':'engineering.md')),'Late external change\n');return bytes;});
  syncBuiltinESMExports();t.after(()=>{patched.mock.restore();syncBuiltinESMExports();});
  const {guardProjectContext}=await import('../../src/foundation-context.mjs'),result=guardProjectContext(root,'a'.repeat(64));
  assert.equal(result.freshness,'unknown');assert.ok(result.issues.some(e=>e.code==='CONTEXT_CHANGED_DURING_READ'));
});

test('context: freeform foundation requirement headings do not create business specification records',()=>{
  const root=fixture(),text='### Requirement: CAP-001 Project red line\n';fs.writeFileSync(join(root,foundation+'engineering.md'),text);
  fs.writeFileSync(join(root,'docs/project/specs/example.md'),'### Requirement: CAP-001 Business behavior\n');
  const s=state(root);s.basis.find(e=>e.path===foundation+'engineering.md').sha256=sha(Buffer.from(text));fs.writeFileSync(join(root,'docs/workflow/state.yaml'),JSON.stringify(s));
  const before=snapshot(root,true),result=inspectWorkflowState(root);assert.equal(result.valid,true,JSON.stringify(result.issues));assert.deepEqual(snapshot(root,true),before);
});
