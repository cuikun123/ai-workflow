import assert from 'node:assert/strict';import {scriptCommand} from './evaluate.mjs';
export function taskScenario({id,iteration='docs/iterations/000-foundation',name,skills=[name],allowedWrites,requiredFiles=[]}){
  return {id,skills,requiredSkill:name,requiredFiles:['AGENTS.md','docs/workflow/state.yaml','docs/project/overview.md',...['scope','design','tasks','verification'].map(n=>iteration+'/'+n+'.md'),...requiredFiles],check:true,answerFormat:'text',allowedWrites};
}
export function assertProbeSequence(run, script) {
  let red=-1,green=-1;
  for(const [index,c]of (run.commands||[]).entries()){
    if(!scriptCommand(c.command,script))continue;
    const values=[];try{values.push(JSON.parse(c.output));}catch{for(const line of (c.output||'').split('\n'))try{values.push(JSON.parse(line));}catch{}}
    if(c.exitCode!==0&&values.some(v=>v.status===503&&v.valid===false))red=index;
    if(c.exitCode===0&&values.some(v=>v.status===200&&v.valid===true)&&red>=0&&index>red){green=index;break;}
  }
  assert.ok(red>=0&&green>red,'Actual HTTP503 RED execution must precede HTTP200 GREEN execution');return true;
}
