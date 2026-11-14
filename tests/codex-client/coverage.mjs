import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse,stringify} from 'yaml';
import {coverageCases,evaluateCoverageRun} from './coverage-cases.mjs';
import {outputSchema} from './cases.mjs';
import {snapshot,captureEvidence} from './evidence.mjs';
import {eventEvidence} from './events.mjs';
import {evaluateBatch} from './evaluate.mjs';
import {discoverSkills} from './native.mjs';

const args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--out'||args[2]!=='--shard'||!['0','1','2'].includes(args[3]))throw Error('Usage: coverage.mjs --out <new evidence root> --shard <0|1|2>');
const root=path.resolve(args[1]),shard=Number(args[3]);
const previous=fs.readFileSync('.artifacts/step3/evidence-path.txt','utf8').trim();
const locations=JSON.parse(fs.readFileSync(path.join(previous,'final-joint/baseline.json'))).inputs;
// D117 skips historical model/configuration baseline checks. These are only
// locations of the previously installed real client, package and isolated home.
const packageRoot=locations.packageRoot,home=locations.home,cli=locations.cli;
const configFile=path.join(process.env.USERPROFILE,'.codex/config.toml');
const config=fs.readFileSync(configFile,'utf8');
const scalar=(key,text=config)=>JSON.parse(text.match(new RegExp('^\\s*'+key+'\\s*=\\s*(".*")\\s*$','m'))?.[1]||'null');
const model=scalar('model');if(!model)throw Error('No current user model');
const token=scalar('experimental_bearer_token',config.split('[model_providers.custom]')[1].split(/^\[/m)[0]);if(!token)throw Error('No existing proxy credential');
const effort='high'; // Current codeg UI selection observed for this coverage run.
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const out=path.join(root,'shard-'+shard);fs.mkdirSync(out);
const schemaFile=path.join(out,'output.schema.json');fs.writeFileSync(schemaFile,JSON.stringify(outputSchema));
fs.writeFileSync(path.join(out,'context.json'),JSON.stringify({model,effort,cli,home,packageRoot,oldBaselineRechecked:false,startedAt:new Date().toISOString()},null,2));
const results=[];
for(const scenario of coverageCases.filter((_,index)=>index%3===shard))for(let repeat=1;repeat<=3;repeat++){
  const id=scenario.id+'-'+repeat,dir=path.join(out,id),project=path.join(dir,'project');fs.mkdirSync(dir);fs.mkdirSync(project);
  const init=spawnSync(process.execPath,[path.join(packageRoot,'bin/iterlane.mjs'),'init','--project',project,'--json'],{windowsHide:true,encoding:'utf8',timeout:60000});if(init.status!==0)throw Error('Real package init failed: '+init.stdout+init.stderr);
  const iteration='docs/iterations/001-entry-check',iterationRoot=path.join(project,iteration);fs.mkdirSync(iterationRoot,{recursive:true});
  const materials={
    'scope.md':'这是显式虚构覆盖场景，不是真实需求或验收。T1为本轮候选成果，T2依赖T1用户验收；不启动未来草案。',
    'design.md':'虚构前提：方案和任务计划已确认。T1候选已实现并检查，用户尚未验收。架构讨论只能形成建议；发布环境、运行版本、远端和部署权限均未提供。',
    'tasks.md':'# 虚构任务\nT1：已实现、已检查，等待用户验收。\nT2：未开始，依赖T1明确验收。\n当前只读请求不得批准或推进T2。',
    'verification.md':'# 虚构检查前提\n记录ID: coverage-fixture-plan\n类型: 测试输入的计划确认，非真实用户批准。\nT1实施和检查为虚构前提，用户验收未通过，不能把本记录当独立源码审查或发布批准。\n一次503只算现象，不是已确认根因。',
  };
  for(const [name,text]of Object.entries(materials))fs.writeFileSync(path.join(iterationRoot,name),text);
  fs.writeFileSync(path.join(project,'docs/project/overview.md'),'# 虚构覆盖项目\n测试11项项目Skills的只读、待验收和专项返回边界。没有生产环境或发布授权。\n');
  const statePath=path.join(project,'docs/workflow/state.yaml'),state=parse(fs.readFileSync(statePath,'utf8'));
  Object.assign(state,{revision:3,current_iteration:iteration,current_task:'T1',phase:'accept',status:'awaiting_user',waiting_for:'task_acceptance',confirmation_refs:[{path:iteration+'/verification.md',record_id:'coverage-fixture-plan'}],basis:Object.keys(materials).map(name=>({path:iteration+'/'+name,sha256:hash(fs.readFileSync(path.join(iterationRoot,name)))})),updated_at:new Date().toISOString()});fs.writeFileSync(statePath,stringify(state));
  const discovery=await discoverSkills({cli,project,home,token});fs.writeFileSync(path.join(dir,'native-discovery.json'),JSON.stringify(discovery,null,2));
  const found=discovery.response.result.data[0],enabledGlobals=found.skills.filter(s=>s.scope!=='repo'&&s.enabled).length;
  if(found.errors.length||enabledGlobals||coverageCases.some(s=>!found.skills.some(f=>f.name===s.requiredSkill&&f.scope==='repo'&&f.enabled)))throw Error('Native project skill discovery/isolation failed');
  const evidence=captureEvidence(project),before=snapshot(project),configBefore=hash(fs.readFileSync(configFile));
  const cliArgs=[cli,'exec','--json','--ephemeral','--skip-git-repo-check','-s','read-only','-c','approval_policy="never"','-m',model,'-c','model_reasoning_effort='+JSON.stringify(effort),'--output-schema',schemaFile,'-C',project,'-'];
  fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify({id,scenario,cliArgs,prompt:scenario.prompt,oldBaselineRechecked:false,requestedModel:model,requestedEffort:effort},null,2));
  fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(before));
  const started=Date.now(),child=spawn(process.execPath,cliArgs,{cwd:project,windowsHide:true,env:{...process.env,CODEX_HOME:home,ITERLANE_VALIDATION_API_KEY:token},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false,processError;child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.stdin.end(scenario.prompt);
  const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});else child.kill('SIGKILL');},180000);
  await new Promise(resolve=>{child.once('error',e=>{processError=e.code;resolve();});child.once('close',resolve);});clearTimeout(timer);
  const actual=eventEvidence(stdout),after=snapshot(project);if(processError)actual.errors.push({type:'process_error',code:processError});
  const run={evidence,exitCode:child.exitCode,timedOut,...actual,unchanged:JSON.stringify(before)===JSON.stringify(after),globalConfigUnchanged:configBefore===hash(fs.readFileSync(configFile)),globalSkillsEnabled:enabledGlobals,elapsedMs:Date.now()-started};
  const evaluation={...evaluateCoverageRun(scenario,run),id};
  const redact=text=>text.split(token).join('[REDACTED]');
  fs.writeFileSync(path.join(dir,'events.jsonl'),redact(stdout));fs.writeFileSync(path.join(dir,'stderr.txt'),redact(stderr));fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(after));fs.writeFileSync(path.join(dir,'result.json'),redact(JSON.stringify({run,evaluation},null,2)));
  results.push(evaluation);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({id,elapsedMs:run.elapsedMs,...evaluation}));
}
const required=coverageCases.filter((_,i)=>i%3===shard).flatMap(s=>[1,2,3].map(n=>s.id+'-'+n));
try{console.log(JSON.stringify(evaluateBatch(results,required)));}catch(error){console.error(error.message);process.exitCode=1;}
