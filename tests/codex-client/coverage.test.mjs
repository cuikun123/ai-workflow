import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {coverageCases,evaluateCoverageRun} from './coverage-cases.mjs';
import {evaluateRun,evaluateBatch} from './evaluate.mjs';
import {analyzeCommand} from './commands.mjs';

const record=(path,text)=>({path,text,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
function evidence(scenario){
  const files=[record('.agents/skills/'+scenario.requiredSkill+'/SKILL.md','真实技能正文'),...scenario.requiredFiles.map(file=>record(file,file.endsWith('state.yaml')?'basis: []\n':'虚构场景依据'))];
  const check={ok:true,command:'check',version:'0.3.0-dev.2',data:{resources:'valid'}};
  const targets=files.map(file=>file.path);
  return {exitCode:0,timedOut:false,completed:true,unchanged:true,globalConfigUnchanged:true,globalSkillsEnabled:0,errors:[],final:JSON.stringify({...scenario.expected,answer:'版本0.3.0-dev.2 '+scenario.skillVersion+'；T1等待用户验收，不得开始T2'}),evidence:{project:'D:/fixture',files,check:{exitCode:0,value:check}},commands:[{command:'node -e "const fs=require(\'fs\');for(const file of '+JSON.stringify(targets).replaceAll('"',"'")+')console.log(JSON.stringify({file,text:fs.readFileSync(file,\'utf8\')}));"',exitCode:0,output:files.map(f=>JSON.stringify({file:f.path,text:f.text})).join('\n')},{command:'node .ai-workflow/bin/iterlane.mjs check --json',exitCode:0,output:JSON.stringify(check)}]};
}
test('coverage: every specialist needs its own complete body and real project evidence',()=>{
  for(const scenario of coverageCases){const run=evidence(scenario);assert.equal(evaluateRun(scenario,run).ok,true,scenario.id);run.commands[0].output=run.commands[0].output.split('\n').slice(1).join('\n');assert.equal(evaluateRun(scenario,run).ok,false,scenario.id);}
});
test('coverage: read-only suggestions cannot approve T2 or replace missing resource checks',()=>{
  for(const scenario of coverageCases){for(const patch of [{may_start_next:true},{current_task:'T2'},{status:'completed'}]){const run=evidence(scenario);run.final=JSON.stringify({...JSON.parse(run.final),...patch});assert.equal(evaluateRun(scenario,run).ok,false,scenario.id);}const run=evidence(scenario);run.commands.pop();assert.equal(evaluateRun(scenario,run).ok,false,scenario.id);}
});
test('coverage: aggregate rejects an omitted repeat or any original client error',()=>{
  const required=coverageCases.flatMap(s=>[1,2,3].map(n=>s.id+'-'+n));const results=required.map(id=>({id,ok:true}));assert.equal(evaluateBatch(results,required).passed,33);assert.throws(()=>evaluateBatch(results.slice(1),required));const scenario=coverageCases[0],run=evidence(scenario);run.errors=[{type:'error',message:'stream closed before response.completed'}];assert.equal(evaluateRun(scenario,run).ok,false);
});
test('coverage: finite joined read paths are bound, while shadowed or skipped reads are rejected',()=>{
  const source="const fs=require('fs');const base='docs/iterations/001-entry-check/';for(const name of ['scope.md','tasks.md']){const file=base+name;console.log(JSON.stringify({file,text:fs.readFileSync(file,'utf8')}));}";
  const command="@'\n"+source+"\n'@ | node";
  const actual=analyzeCommand(command);assert.equal(actual.invalid,false);assert.deepEqual(actual.targets,['docs/iterations/001-entry-check/scope.md','docs/iterations/001-entry-check/tasks.md']);
  for(const changed of [source.replace('const file=base+name;','const file=base+name;file="outside.md";'),source.replace('const base=','let base=').replace('for(const name','base="outside/";for(const name'),source.replace('for(const name','for(let name').replace('const file=base+name;','name="other.md";const file=base+name;'),source.replace('for(const name','for(let name').replace('const file=base+name;','name &&= "other.md";const file=base+name;'),source.replace('console.log(JSON.stringify','if(false) console.log(JSON.stringify')])assert.equal(analyzeCommand("@'\n"+changed+"\n'@ | node").invalid,true);
});
test('coverage: a waiting specialist may recommend itself, but cannot approve work or recommend deployment',()=>{
  for(const name of ['execute-task','handle-incident']){const scenario=coverageCases.find(s=>s.id===name),run=evidence(scenario);run.final=JSON.stringify({...JSON.parse(run.final),next_skill:name});assert.equal(evaluateCoverageRun(scenario,run).ok,true);run.final=JSON.stringify({...JSON.parse(run.final),next_skill:'release-work'});assert.equal(evaluateCoverageRun(scenario,run).ok,false);run.final=JSON.stringify({...JSON.parse(run.final),next_skill:name,may_start_next:true});assert.equal(evaluateCoverageRun(scenario,run).ok,false);}
});
test('coverage: dollar-prefixed joined variables cannot bypass mutation rejection',()=>{
  const source="const fs=require('fs');const base='docs/';for(const name of ['tasks.md']){const $file=base+name;try{$file &&= 'other.md';fs.readFileSync($file,'utf8');}catch{}}";
  assert.equal(analyzeCommand("@'\n"+source+"\n'@ | node").invalid,true);
});
