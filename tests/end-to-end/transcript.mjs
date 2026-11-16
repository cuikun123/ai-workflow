import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {eventEvidence} from '../codex-client/events.mjs';import {collectStateCommands} from '../codex-client/state-events.mjs';import {snapshot} from '../codex-client/evidence.mjs';
export function reconstructRun(directory) {
  const cache=JSON.parse(fs.readFileSync(path.join(directory,'run.json'),'utf8')),raw=fs.readFileSync(path.join(directory,'events.jsonl'),'utf8'),before=JSON.parse(fs.readFileSync(path.join(directory,'before.json'),'utf8'));
  assert.deepEqual(cache.evidence,before,'Cached before evidence differs from independent snapshot');
  const actual={...eventEvidence(raw),commands:collectStateCommands(raw)};
  for(const key of ['completed','errors','final','commands'])assert.deepEqual(cache[key],actual[key],'Cached '+key+' differs from original events');
  const afterFile=path.join(directory,'after.json'),after=fs.existsSync(afterFile)?JSON.parse(fs.readFileSync(afterFile,'utf8')):cache.after;
  assert.ok(Array.isArray(after),'Missing after snapshot');if(fs.existsSync(afterFile))assert.deepEqual(cache.after,after,'Cached after differs from independent snapshot');
  const old=before.files.map(({text,...value})=>value),unchanged=JSON.stringify(old)===JSON.stringify(after);assert.equal(cache.unchanged,unchanged,'Inconsistent unchanged flag');
  if(unchanged)assert.deepEqual(snapshot(before.project),after,'Read-only project differs from observed after snapshot');
  const executionFile=path.join(directory,'execution.json');if(fs.existsSync(executionFile)){const execution=JSON.parse(fs.readFileSync(executionFile,'utf8'));for(const key of ['exitCode','timedOut','completed'])assert.equal(cache[key],execution[key],'Inconsistent execution '+key);assert.equal(execution.events_sha256,createHash('sha256').update(raw).digest('hex'),'Original event digest differs');}
  return {...cache,...actual,evidence:before,after,unchanged,raw_events_reconstructed:true,legacy_after_snapshot:!fs.existsSync(afterFile)};
}
