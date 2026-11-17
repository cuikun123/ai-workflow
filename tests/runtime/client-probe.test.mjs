import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {resourcePackage,project,snapshot} from '../helpers/installation.mjs';import {initializeProject} from '../../src/installation.mjs';
const fixture=resolve('tests/fixtures/client-probe.mjs');
const run=(root,mode='ok',extra=[])=>spawnSync(process.execPath,[join(root,'.ai-workflow/bin/iterlane.mjs'),'doctor','--client','--client-cli',fixture,...extra,'--json'],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,ITERLANE_PROBE_FIXTURE_MODE:mode},timeout:15000});
test('client probe: a real child status command is required and project files stay unchanged',async()=>{
 const pkg=await resourcePackage(),root=project();initializeProject({packageRoot:pkg,projectRoot:root});const before=snapshot(root,true),r=run(root);assert.equal(r.status,0,r.stdout+r.stderr);const client=JSON.parse(r.stdout).data.client;assert.equal(client.status,'connected');assert.equal(client.execution_observed,true);assert.equal(client.checked_skills,11);assert.equal(client.source_authenticity_verified,false);assert.deepEqual(snapshot(root,true),before);
 const unknown=run(root,'usage-secret');assert.equal(unknown.status,0);assert(!unknown.stdout.includes('PROBE_PRIVATE_SECRET'));assert.deepEqual(JSON.parse(unknown.stdout).data.client.reported_usage,{input_tokens:100,cached_input_tokens:0,output_tokens:20});
});
test('client probe: verbal success, authentication and timeout are failures without leaking credentials',async()=>{
 const pkg=await resourcePackage(),root=project();initializeProject({packageRoot:pkg,projectRoot:root});const before=snapshot(root,true);
 for(const [mode,wanted,args]of [['fake','protocol',[]],['auth','authentication',[]],['timeout','timeout',['--timeout-ms','1000']]]){const r=run(root,mode,args);assert.notEqual(r.status,0,r.stdout);const body=JSON.parse(r.stdout);assert.equal(body.error.details[0].client.failure,wanted);assert(!r.stdout.includes('PROBE_PRIVATE_SECRET'));assert.deepEqual(snapshot(root,true),before);}
});
test('client probe: a damaged local installation blocks the external client before it can run',async()=>{
 const pkg=await resourcePackage(),root=project();initializeProject({packageRoot:pkg,projectRoot:root});fs.writeFileSync(join(root,'.agents/skills/workflow-guide/SKILL.md'),'damaged');const before=snapshot(root,true),r=run(root);assert.notEqual(r.status,0);const body=JSON.parse(r.stdout);assert.equal(body.error.details[0].client.status,'not_probed');assert.deepEqual(snapshot(root,true),before);
});
