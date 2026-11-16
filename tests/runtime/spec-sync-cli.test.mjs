import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {syncFixture,snapshot,iteration,specPath} from '../helpers/spec-sync.mjs';

const run=(f,args)=>spawnSync(process.execPath,[join(f.root,'.ai-workflow/bin/iterlane.mjs'),...args,'--json'],{cwd:f.root,encoding:'utf8',windowsHide:true,timeout:60000});
const args=(f)=>['spec','sync','--iteration',iteration,'--task','T1','--request-id','cli-sync','--expected-revision',String(f.current().revision)];
test('spec sync CLI: the actual installed entry previews, synchronizes and deduplicates',async()=>{
  const f=await syncFixture({nextTask:true}),input=args(f),before=snapshot(f.root,true),preview=run(f,[...input,'--preview']);
  assert.equal(preview.status,0,preview.stdout+preview.stderr);assert.equal(JSON.parse(preview.stdout).data.action,'preview');assert.deepEqual(snapshot(f.root,true),before);
  const applied=run(f,input);assert.equal(applied.status,0,applied.stdout+applied.stderr);const result=JSON.parse(applied.stdout).data;assert.ok(result.sync_ref);assert.equal(result.revision,1);assert.match(f.read(specPath),/MUST be 120/);assert.match(f.read(specPath),/MUST be 10/);
  const changed=Object.keys(snapshot(f.root,true)).filter(path=>before[path]!==snapshot(f.root,true)[path]&&!path.startsWith('.ai-workflow/.local/'));
  const planned=JSON.parse(preview.stdout).data.files;assert.ok(Array.isArray(planned),'Preview must expose all planned file writes');assert.deepEqual(planned.map(x=>x.path).sort(),changed.sort());
  assert.ok(planned.some(x=>x.path==='.gitattributes'));assert.ok(planned.some(x=>x.path==='.ai-workflow/manifest.json'));
  const saved=snapshot(f.root,true),duplicate=run(f,input);assert.equal(duplicate.status,0,duplicate.stdout+duplicate.stderr);assert.deepEqual(JSON.parse(duplicate.stdout).data.sync_ref,result.sync_ref);assert.deepEqual(snapshot(f.root,true),saved);
  const reused=run(f,args(f));assert.equal(reused.status,7,reused.stdout+reused.stderr);assert.deepEqual(snapshot(f.root,true),saved);
});
test('spec sync CLI: unaccepted content and malformed revision are refused without writes',async()=>{
  const f=await syncFixture({accepted:false}),before=snapshot(f.root,true);
  for(const input of [args(f),[...args(f),'--preview'],args(f).map(x=>x==='0'?'9007199254740992':x)]){const result=run(f,input);assert.ok([2,7].includes(result.status),result.stdout+result.stderr);assert.deepEqual(snapshot(f.root,true),before);}
});
test('spec sync CLI: v2 refresh keeps the accepted task and refuses changed specification baselines',async()=>{
  const f=await syncFixture({mode:'NONE'}),input=['recover','--refresh','--request-id','refresh-v2','--expected-revision','0'];const before=snapshot(f.root,true),preview=run(f,[...input,'--preview']);assert.equal(preview.status,0,preview.stdout+preview.stderr);assert.deepEqual(snapshot(f.root,true),before);
  const result=run(f,input);assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(f.current().phase,'closeout');
  f.write(specPath,f.before+'\nA later human change.\n');const saved=snapshot(f.root,true),blocked=run(f,['recover','--refresh','--request-id','refresh-changed','--expected-revision','1']);assert.equal(blocked.status,7,blocked.stdout+blocked.stderr);assert.deepEqual(snapshot(f.root,true),saved);
});
