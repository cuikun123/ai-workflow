import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {project} from '../helpers/installation.mjs';
import {syncFixture,snapshot,iteration,specPath} from '../helpers/spec-sync.mjs';
import {planWorkflowOperation,applyWorkflowTransition,recoverWorkflowTransition} from '../../src/workflow-journal.mjs';
import {readWorkflowLogs} from '../../src/workflow-log.mjs';

async function writer(f,target){
  const helper=project(),script=join(helper,'worker.mjs'),signal=join(helper,'ready'),request=f.syncRequest();
  const module=pathToFileURL(join(f.root,'.ai-workflow/runtime/cli.mjs')).href;
  fs.writeFileSync(script,`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const [root,input,target,signal]=process.argv.slice(2),request=JSON.parse(input),rename=fs.renameSync;fs.renameSync=(from,to)=>{rename(from,to);if(to===target){fs.writeFileSync(signal,'ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}};syncBuiltinESMExports();const {runCli}=await import(${JSON.stringify(module)});process.exitCode=await runCli(['spec','sync','--iteration',request.data.iteration,'--task',request.data.task,'--request-id',request.request_id,'--expected-revision',String(request.expected_revision),'--json'],{projectRoot:root});`);
  const child=spawn(process.execPath,[script,f.root,JSON.stringify(request),target,signal],{windowsHide:true,stdio:'pipe'}),done=once(child,'exit');let stderr='';child.stderr.on('data',bytes=>stderr+=bytes);
  try{const deadline=Date.now()+20000;while(!fs.existsSync(signal)&&child.exitCode===null&&Date.now()<deadline)await delay(25);assert.ok(fs.existsSync(signal),stderr);return {child,done,request};}
  catch(error){if(child.exitCode===null)child.kill('SIGKILL');await done;throw error;}
}
test('spec sync process: killed writers at every planned file resume through the installed recovery entry',async()=>{
  const first=await syncFixture(),targets=planWorkflowOperation(first.root,first.syncRequest()).files.map(f=>f.path);assert.ok(targets.includes(specPath));assert.equal(targets.at(-1),'docs/workflow/state.yaml');
  for(const [index,target]of targets.entries()){
    const f=index===0?first:await syncFixture(),running=await writer(f,join(f.root,target));
    try{
      const before=snapshot(f.root,true);assert.throws(()=>applyWorkflowTransition(f.root,f.syncRequest('competing')));assert.throws(()=>recoverWorkflowTransition(f.root,'resume',f.current().revision));assert.deepEqual(snapshot(f.root,true),before);
      running.child.kill('SIGKILL');await running.done;const pending=readWorkflowLogs(f.root).find(x=>x.data.phase!=='committed');assert.ok(pending);
      const cli=spawnSync(process.execPath,[join(f.root,'.ai-workflow/bin/iterlane.mjs'),'recover','--resume','--operation-id',pending.data.operation_id,'--expected-revision',String(f.current().revision),'--json'],{cwd:f.root,encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(cli.status,0,cli.stdout+cli.stderr);assert.equal(f.current().revision,1);assert.match(f.read(specPath),/MUST be 120/);
      const saved=snapshot(f.root,true);assert.equal(applyWorkflowTransition(f.root,running.request).action,'already_applied');assert.deepEqual(snapshot(f.root,true),saved);
    }finally{if(running.child.exitCode===null){running.child.kill('SIGKILL');await running.done;}}
  }
});
test('spec sync process: committed sync with a killed lock owner cleans only the verified lock',async()=>{
  const f=await syncFixture(),helper=project(),script=join(helper,'commit.mjs'),signal=join(helper,'ready'),module=pathToFileURL(join(f.root,'.ai-workflow/runtime/cli.mjs')).href;
  fs.writeFileSync(script,`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const [root,input,signal]=process.argv.slice(2),request=JSON.parse(input),rename=fs.renameSync;fs.renameSync=(from,to)=>{rename(from,to);if(to.endsWith('journal.json')&&JSON.parse(fs.readFileSync(to)).phase==='committed'){fs.writeFileSync(signal,'ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}};syncBuiltinESMExports();const {runCli}=await import(${JSON.stringify(module)});process.exitCode=await runCli(['spec','sync','--iteration',request.data.iteration,'--task',request.data.task,'--request-id',request.request_id,'--expected-revision',String(request.expected_revision),'--json'],{projectRoot:root});`);
  const child=spawn(process.execPath,[script,f.root,JSON.stringify(f.syncRequest()),signal],{windowsHide:true,stdio:'pipe'}),done=once(child,'exit');let stderr='';child.stderr.on('data',x=>stderr+=x);
  try{const deadline=Date.now()+20000;while(!fs.existsSync(signal)&&child.exitCode===null&&Date.now()<deadline)await delay(25);assert.ok(fs.existsSync(signal),stderr);child.kill('SIGKILL');await done;const log=readWorkflowLogs(f.root)[0],before=snapshot(f.root,true);const result=recoverWorkflowTransition(f.root,'resume',1,{operationId:log.data.operation_id});assert.equal(result.action,'lock_released');const after=snapshot(f.root,true);delete before['.ai-workflow/.local/write.lock'];assert.deepEqual(after,before);}
  finally{if(child.exitCode===null){child.kill('SIGKILL');await done;}}
});
