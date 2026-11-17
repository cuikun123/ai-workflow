import fs from 'node:fs';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {eventEvidence} from '../codex-client/events.mjs';import {collectStateCommands} from '../codex-client/state-events.mjs';import {readProjectFile} from '../../src/project-paths.mjs';
export function hasUsabilitySession(dir){
 if(!fs.existsSync(dir))return false;
 const stat=fs.lstatSync(dir);if(stat.isSymbolicLink()||!stat.isDirectory()||!fs.existsSync(join(dir,'run.json')))throw Error('INCOMPLETE_SESSION: saved partial evidence is preserved; no model retry. Use a new output directory for an explicitly requested rerun.');return true;
}
export function assertUsabilityFiles(run,project,paths){
 assert.equal(resolve(run.evidence.project),resolve(project));
 for(const path of paths){const saved=run.after.find(f=>f.path===path),bytes=readProjectFile(project,path);assert(saved&&bytes,'Missing saved business file: '+path);assert.equal(bytes.length,saved.bytes,'Business file size changed: '+path);assert.equal(createHash('sha256').update(bytes).digest('hex'),saved.sha256,'Business file content changed: '+path);}
}
export function readUsabilityRun(dir){
 const read=name=>JSON.parse(fs.readFileSync(join(dir,name),'utf8')),run=read('run.json'),execution=read('execution.json'),raw=fs.readFileSync(join(dir,'events.jsonl'),'utf8'),actual=eventEvidence(raw);
 assert.equal(createHash('sha256').update(raw).digest('hex'),execution.events_sha256);assert.equal(run.exitCode,execution.exitCode);assert.equal(run.timedOut,execution.timedOut);assert.equal(run.completed,execution.completed);
 for(const key of ['completed','errors','final'])assert.deepEqual(run[key],actual[key]);assert.deepEqual(run.commands,collectStateCommands(raw));assert.deepEqual(run.evidence,read('before.json'));assert.deepEqual(run.after,read('after.json'));
 run.events=raw.trim().split(/\r?\n/).map(JSON.parse);return run;
}
