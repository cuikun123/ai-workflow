import * as fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {stringify,parse} from 'yaml';
import {cases,outputSchema} from './cases.mjs';import {evaluateRun,evaluateBatch} from './evaluate.mjs';
import {discoverSkills} from './native.mjs';
import {eventEvidence} from './events.mjs';
import {snapshot,captureEvidence,assertBaseline,createSuite} from './evidence.mjs';
const args=process.argv.slice(2),seen=new Set();for(let index=0;index<args.length;index+=2){const key=args[index];if(!['--evidence','--baseline','--package','--case','--repeat','--suite'].includes(key)||seen.has(key)||!args[index+1]||args[index+1].startsWith('--'))throw Error('Invalid evaluation argument: '+key);seen.add(key);}const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const root=path.resolve(option('--evidence')||fs.readFileSync('.artifacts/step3/evidence-path.txt','utf8').trim()),baseline=JSON.parse(fs.readFileSync(path.resolve(option('--baseline')||path.join(root,'candidate-baseline.json')))),home=baseline.inputs.home,cli=baseline.inputs.cli;
if(path.dirname(path.resolve(home))!==root)throw Error('Client home must belong to the evidence root');
assertBaseline(baseline);
const packageRoot=path.resolve(option('--package')||baseline.inputs.packageRoot),selected=option('--case'),repetitions=Number(option('--repeat')||3),suite=option('--suite')||'candidate';
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>3)throw Error('repeat must be 1 to 3');
if(!/^[a-z0-9-]{1,64}$/.test(suite)||selected&&!cases.some(c=>c.id===selected))throw Error('Unknown case or invalid evidence suite');
if(packageRoot!==path.resolve(baseline.inputs.packageRoot))throw Error('Package path differs from frozen baseline');
const out=createSuite(root,suite);fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify(baseline,null,2),{flag:'wx'});const schemaFile=path.join(out,'output.schema.json');fs.writeFileSync(schemaFile,JSON.stringify(outputSchema));
const cfgFile=baseline.inputs.globalConfigFile,cfg=fs.readFileSync(cfgFile,'utf8'),section=cfg.split('[model_providers.custom]')[1].split(/^\[/m)[0],token=JSON.parse(section.match(/^\s*experimental_bearer_token\s*=\s*(".*")\s*$/m)[1]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),globalBefore=hash(Buffer.from(cfg));
function fixture(project,type){
  if(type==='waiting'){
    const iteration='docs/iterations/001-entry-check',directory=path.join(project,iteration);fs.mkdirSync(directory,{recursive:true});
    const materials={'scope.md':'这是显式虚构客户端测试输入，不是真实业务。当前轮为001-entry-check。只读核对T1验收及下一步。','design.md':'测试前提：本轮目标、方案和任务计划已确认。T1测试成果已实现并检查，但用户尚未验收；T2不能开始。','tasks.md':'# 当前虚构任务\n- T1：已实现、检查完成，等待用户验收；未验收。\n- T2：未开始，依赖T1明确验收。\n下一步：等待T1用户验收，不进入T2。','verification.md':'# 显式测试前提\n记录ID: fixture-plan\n类型: 虚构场景的计划确认前提，非本仓库用户验收。\nT1实施与检查已完成为测试输入；用户验收未通过或未确认，不存在验收记录。\nT2未开始。'};
    for(const [name,text]of Object.entries(materials))fs.writeFileSync(path.join(directory,name),text);
    const future=path.join(project,'docs/iterations/999-future-draft');fs.mkdirSync(future,{recursive:true});fs.writeFileSync(path.join(future,'scope.md'),'这是未批准、非活跃的未来草案，不是当前迭代。');
    const statePath=path.join(project,'docs/workflow/state.yaml'),state=parse(fs.readFileSync(statePath,'utf8'));Object.assign(state,{revision:3,current_iteration:iteration,current_task:'T1',phase:'accept',status:'awaiting_user',waiting_for:'task_acceptance',confirmation_refs:[{path:iteration+'/verification.md',record_id:'fixture-plan'}],basis:Object.keys(materials).map(name=>({path:iteration+'/'+name,sha256:hash(fs.readFileSync(path.join(directory,name)))})),updated_at:new Date().toISOString()});fs.writeFileSync(statePath,stringify(state));
  }
  if(type==='damaged')fs.unlinkSync(path.join(project,'.agents/skills/workflow-guide/NOTICE.md'));
}
const native=JSON.parse(fs.readFileSync(path.join(root,'native-isolatedSkills.json'))).result.data[0];const globalEnabled=native.skills.filter(skill=>skill.scope!=='repo'&&skill.enabled).length;if(globalEnabled)throw Error('Global skills were not isolated');
const results=[];
for(const scenario of cases.filter(c=>!selected||c.id===selected))for(let repeat=1;repeat<=repetitions;repeat++){
  assertBaseline(baseline);
  const id=scenario.id+'-'+repeat,dir=path.join(out,id),project=path.join(dir,'project');fs.mkdirSync(dir);fs.mkdirSync(project);
  const foreign=path.join(project,'.agents/skills/project-helper');fs.mkdirSync(foreign,{recursive:true});fs.writeFileSync(path.join(foreign,'SKILL.md'),'---\nname: project-helper\ndescription: "Use only when explicitly asked for synthetic bookmark values."\n---\nA synthetic coexisting project skill, unrelated to workflow validation.\n');
  const initialized=spawnSync(process.execPath,[path.join(packageRoot,'bin/iterlane.mjs'),'init','--project',project,'--json'],{windowsHide:true,encoding:'utf8',timeout:60000});if(initialized.status!==0)throw Error(initialized.stdout+initialized.stderr);fixture(project,scenario.fixture);
  const discovery=await discoverSkills({cli,project,home,token}),found=discovery.response.result.data[0];fs.writeFileSync(path.join(dir,'native-discovery.json'),JSON.stringify(discovery,null,2));
  const currentGlobals=found.skills.filter(skill=>skill.scope!=='repo'&&skill.enabled).length,frameworkNames=['workflow-guide','clarify-design','discuss-design','build-foundation','plan-tasks','execute-task','test-work','debug-issue','review-work','release-work','handle-incident'];
  if(found.errors.length||currentGlobals||frameworkNames.some(name=>!found.skills.some(skill=>skill.name===name&&skill.scope==='repo'&&skill.enabled))||!found.skills.some(skill=>skill.name==='project-helper'&&skill.enabled))throw Error('Native discovery/coexistence failed');
  const evidence=captureEvidence(project);fs.writeFileSync(path.join(dir,'frozen-project.json'),JSON.stringify(evidence));
  const before=snapshot(project),started=Date.now(),cliArgs=[cli,'exec','--json','--ephemeral','--skip-git-repo-check','-s','read-only','-c','approval_policy="never"','-m','gpt-6.1-sol','-c','model_reasoning_effort="medium"','--output-schema',schemaFile,'-C',project,'-'];
  fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify({id,scenario,cliArgs,prompt:scenario.prompt,global_config_sha256:globalBefore,isolated_config_sha256:hash(fs.readFileSync(path.join(home,'config.toml'))),startedAt:new Date().toISOString()},null,2));fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(before));
  assertBaseline(baseline);
  const child=spawn(process.execPath,cliArgs,{cwd:project,env:{...process.env,CODEX_HOME:home,ITERLANE_VALIDATION_API_KEY:token},windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',timedOut=false;child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);child.stdin.end(scenario.prompt);
  let processError;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},180000);await new Promise(resolve=>{child.once('error',error=>{processError=error.code;resolve();});child.once('close',resolve);});clearTimeout(timer);
  const actualEvents=eventEvidence(stdout),after=snapshot(project);
  const run={evidence,exitCode:child.exitCode,timedOut,...actualEvents,unchanged:JSON.stringify(before)===JSON.stringify(after),globalConfigUnchanged:globalBefore===hash(fs.readFileSync(cfgFile)),globalSkillsEnabled:currentGlobals,elapsedMs:Date.now()-started};
  if(processError)run.errors.push({type:'process_error',code:processError});try{assertBaseline(baseline);}catch(error){run.errors.push({type:'baseline_changed',message:error.message});}
  const evaluation={...evaluateRun(scenario,run),id};fs.writeFileSync(path.join(dir,'events.jsonl'),stdout);fs.writeFileSync(path.join(dir,'stderr.txt'),stderr);fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(after));fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({run,evaluation},null,2));results.push(evaluation);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({id,elapsedMs:run.elapsedMs,...evaluation}));
}
const requiredIds=cases.filter(c=>!selected||c.id===selected).flatMap(c=>Array.from({length:repetitions},(_,index)=>c.id+'-'+(index+1)));
try{console.log(JSON.stringify(evaluateBatch(results,requiredIds)));}catch(error){console.error(error.message);process.exitCode=1;}
