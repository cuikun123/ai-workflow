import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
test('usability saved evidence: real commands are recovered and altered summaries rejected',async()=>{
 const {readUsabilityRun}=await import('./usability-evidence.mjs'),root=fs.mkdtempSync(join(tmpdir(),'usability events '));
 const events=[{type:'item.completed',item:{id:'cmd',type:'command_execution',command:'node cli status --json',exit_code:0,aggregated_output:'{}'}},{type:'item.completed',item:{id:'reply',type:'agent_message',text:'{"mode":"direct"}'}},{type:'turn.completed',usage:{input_tokens:10,cached_input_tokens:0,output_tokens:1}}],raw=events.map(JSON.stringify).join('\n')+'\n';
 const run={completed:true,errors:[],final:'{"mode":"direct"}',commands:[{command:'node cli status --json',exitCode:0,output:'{}'}],exitCode:0,timedOut:false,after:[],evidence:{files:[]}};
 const put=(name,value)=>fs.writeFileSync(join(root,name),JSON.stringify(value));fs.writeFileSync(join(root,'events.jsonl'),raw);put('run.json',run);put('execution.json',{exitCode:0,timedOut:false,completed:true,events_sha256:createHash('sha256').update(raw).digest('hex')});put('before.json',run.evidence);put('after.json',[]);
 assert.equal(readUsabilityRun(root).events.length,3);run.final='{"mode":"full"}';put('run.json',run);assert.throws(()=>readUsabilityRun(root));
});
test('usability saved evidence: changed current business files cannot be attributed to the saved session',async()=>{
 const {assertUsabilityFiles}=await import('./usability-evidence.mjs'),root=fs.mkdtempSync(join(tmpdir(),'usability binding '));fs.writeFileSync(join(root,'app.mjs'),'original');const run={evidence:{project:root},after:[{path:'app.mjs',bytes:8,sha256:createHash('sha256').update('original').digest('hex')}]};
 assertUsabilityFiles(run,root,['app.mjs']);fs.writeFileSync(join(root,'app.mjs'),'new version');assert.throws(()=>assertUsabilityFiles(run,root,['app.mjs']));assert.equal(fs.readFileSync(join(root,'app.mjs'),'utf8'),'new version');
});
test('usability saved evidence: partial sessions are preserved and cannot cause another model invocation',async()=>{
 const {hasUsabilitySession}=await import('./usability-evidence.mjs'),root=fs.mkdtempSync(join(tmpdir(),'usability partial ')),dir=join(root,'partial');assert.equal(hasUsabilitySession(dir),false);fs.mkdirSync(dir);fs.writeFileSync(join(dir,'events.jsonl'),'partial events');assert.throws(()=>hasUsabilitySession(dir),/INCOMPLETE_SESSION/);assert.deepEqual(fs.readdirSync(dir),['events.jsonl']);assert.equal(fs.readFileSync(join(dir,'events.jsonl'),'utf8'),'partial events');
});
