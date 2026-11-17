import test from 'node:test';import assert from 'node:assert/strict';import {evaluateUsability} from './usability-evaluate.mjs';
const event=(command,output='ok')=>({type:'item.completed',item:{id:command,type:'command_execution',command,aggregated_output:output,exit_code:0}});
import {createHash} from 'node:crypto';
const file=(path,text)=>({path,text,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
const run=(mode,events=[])=>({exitCode:0,completed:true,timedOut:false,baselineUnchanged:true,globalConfigUnchanged:true,final:JSON.stringify({mode,may_start_next:false}),events,evidence:{files:[{path:'welcome.md',sha256:'a',bytes:1}]},after:[{path:'welcome.md',sha256:'a',bytes:1}],elapsed_ms:1});
test('usability evaluator: actual excess output and unrelated method reads fail a small task budget',()=>{
 const c={mode:'direct',allowedWrites:[],maxTools:2,maxTextBytes:20,forbiddenMethods:['execute-task']};assert.equal(evaluateUsability(c,run('direct',[event('read welcome')])).passed,true);
 assert.equal(evaluateUsability(c,run('direct',[event('read welcome','x'.repeat(21))])).passed,false);
 assert.equal(evaluateUsability(c,run('direct',[event('Get-Content .agents/skills/execute-task/references/implementation.md')])).passed,false);
 assert.equal(evaluateUsability(c,run('direct',[event('Get-Content .agents\\skills\\execute-task\\SKILL.md')])).passed,false);
});
test('usability evaluator: no evidence and missing required reads cannot pass',()=>{
 const c={mode:'full',allowedWrites:[],maxTools:10,maxTextBytes:1000,requiredReads:['auth.mjs'],requiredCommands:['status --json']};
 assert.equal(evaluateUsability(c,run('full')).passed,false);
 assert.equal(evaluateUsability(c,run('full',[event('node cli status --json','{"ok":true}')])).passed,false);
 const r=run('full',[event('Get-Content auth.mjs','export const adminOnly=true;'),event('node cli status --json','{"ok":true}')]);r.evidence.files=[file('auth.mjs','export const adminOnly=true;')];r.after=r.evidence.files;assert.equal(evaluateUsability(c,r).passed,true);
});
test('usability evaluator: command names alone cannot stand in for exact returned file content',()=>{
 const c={mode:'direct',requiredReads:['welcome.md'],allowedWrites:[],maxTools:10,maxTextBytes:1000},r=run('direct',[event('Get-Content welcome.md','invented text')]);r.evidence.files=[file('welcome.md','# Welcom\n')];r.after=r.evidence.files;assert.equal(evaluateUsability(c,r).passed,false);
 r.events=[event('node -e fs.readFileSync("welcome.md")',JSON.stringify({path:'welcome.md',content:'# Welcom\n'})+'\\n'+JSON.stringify({path:'other.md',content:'other'}))];assert.equal(evaluateUsability(c,r).passed,true);
});
test('usability evaluator: controller behavior and observed waiting state are mandatory when requested',()=>{
 const c={mode:'light',allowedWrites:[],maxTools:10,maxTextBytes:1000,requireBehavior:true};
 const r=run('light',[event('read file')]);assert.equal(evaluateUsability(c,r).passed,false);r.behaviorVerified=true;assert.equal(evaluateUsability(c,r).passed,true);
 const waiting={...c,mode:'direct',waiting:true,expectedStatus:'awaiting_user'};r.final=JSON.stringify({mode:'direct',may_start_next:false});assert.equal(evaluateUsability(waiting,r).passed,false);
 r.events=[event('node cli status --json',JSON.stringify({ok:true,command:'status',data:{state:{status:'awaiting_user',waiting_for:'task_acceptance',current_task:'T1'}}}))];assert.equal(evaluateUsability(waiting,r).passed,true);
});
test('usability evaluator: wrong risk label, attempted writes and next-task approval fail even if files look unchanged',()=>{
 const c={mode:'full',allowedWrites:[],maxTools:10,maxTextBytes:1000,readOnly:true};assert.equal(evaluateUsability(c,run('direct')).passed,false);assert.equal(evaluateUsability(c,run('full',[event('node -e fs.writeFileSync(file,data)')])).passed,false);
 const waiting={...c,mode:'direct',waiting:true},r=run('direct');r.final=JSON.stringify({mode:'direct',may_start_next:true});assert.equal(evaluateUsability(waiting,r).passed,false);r.final=JSON.stringify({mode:'direct',may_start_next:false});r.after=[];assert.equal(evaluateUsability(waiting,r).passed,false);
});
