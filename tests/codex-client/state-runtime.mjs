// Explicit real-client evaluation. Ordinary CI does not run authenticated sessions.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {discoverSkills} from './native.mjs';
import {eventEvidence} from './events.mjs';
import {collectStateCommands} from './state-events.mjs';
import {snapshot,captureEvidence} from './evidence.mjs';
import {driver,current,record,ref} from '../helpers/workflow.mjs';
import {planWorkflowTransition} from '../../src/workflow-transitions.mjs';
import {parseWorkflowDocument} from '../../src/workflow-docs.mjs';

const args=process.argv.slice(2);
if(![6,10].includes(args.length)||args[0]!=='--out'||args[2]!=='--package'||args[4]!=='--cli'||args.length===10&&(args[6]!=='--case'||args[8]!=='--deadline-ms'))throw Error('Usage: state-runtime.mjs --out <new directory> --package <fixed package> --cli <installed Codex CLI> [--case <id> --deadline-ms <budget>]');
const selected=args[7]||null,deadline=Number(args[9]||180000);if(![180000,300000,360000].includes(deadline))throw Error('Unsupported case budget');
const out=path.resolve(args[1]),packageRoot=path.resolve(args[3]),cli=path.resolve(args[5]);
fs.mkdirSync(out);const home=path.join(out,'client-home');fs.mkdirSync(home);
const globalConfigFile=path.join(process.env.USERPROFILE,'.codex/config.toml'),globalConfig=fs.readFileSync(globalConfigFile,'utf8');
const scalar=(key,text=globalConfig)=>JSON.parse(text.match(new RegExp('^\\s*'+key+'\\s*=\\s*(".*")\\s*$','m'))?.[1]||'null');
const provider=scalar('model_provider');if(provider!=='custom')throw Error('This validated combination requires the existing custom provider');
const providerSection=globalConfig.split('[model_providers.custom]')[1]?.split(/^\[/m)[0],token=scalar('experimental_bearer_token',providerSection||'');
if(!token||!scalar('model'))throw Error('Current model or existing in-memory proxy credential is unavailable');
const hash=b=>createHash('sha256').update(b).digest('hex'),redact=text=>text.split(token).join('[REDACTED]');
const sanitized=globalConfig.replace(/^\s*experimental_bearer_token\s*=\s*".*"\s*$/gm,'env_key = "ITERLANE_VALIDATION_API_KEY"');
if(sanitized.includes(token))throw Error('Credential sanitization failed');
fs.writeFileSync(path.join(home,'config.toml'),sanitized);
const context={requested_model:scalar('model'),effort:scalar('model_reasoning_effort'),provider,cli,cli_sha256:hash(fs.readFileSync(cli)),packageRoot,package:snapshot(packageRoot),global_config_sha256:hash(Buffer.from(globalConfig)),case_budget_ms:deadline,old_model_baseline_rechecked:false,fixture_sources:'Synthetic controller declarations, not real acceptance or independent review',started_at:new Date().toISOString()};
fs.writeFileSync(path.join(out,'context.json'),JSON.stringify(context,null,2));

const cases=[
  {id:'readonly-wait',fixture:'waiting',prompt:'这个虚构项目现在到哪了，T2能开始了吗？只查询与解释，暂时不修改任何文件；按适用工作流核对实际状态和文档，别用“测试通过”代替T1用户验收。'},
  {id:'authorized-pause',fixture:'waiting',prompt:'这是隔离虚构测试。我明确暂停当前T1，请按适用主流程登记本条暂停指令并保存暂停位置。T1尚未验收；保留它原来的验收等待，暂不切换到其他轮，不实施任务或修改业务源码。只做对应记录和状态操作。'},
  {id:'unresolved-block',fixture:'blocked',prompt:'继续T1，速度要快，能不能直接恢复执行、开始T2？先按实际工作流判断并处理允许的步骤。本条没有提供阻塞解除证据，也没有验收T1；不要猜记录或假造解除依据。'}
];
if(selected&&!cases.some(c=>c.id===selected))throw Error('Unknown case');

function fixture(project,kind){
  fs.mkdirSync(project);const init=spawnSync(process.execPath,[path.join(packageRoot,'bin/iterlane.mjs'),'init','--project',project,'--json'],{encoding:'utf8',windowsHide:true,timeout:60000});if(init.status!==0)throw Error('Fixed package initialization failed: '+init.stdout+init.stderr);
  const f={root:project,iteration:'docs/iterations/000-foundation'};
  for(const [name,text]of [['scope','One synthetic task T1. T2 is future work requiring T1 acceptance.'],['design','Synthetic scenario only; no production or Git authorization.'],['tasks','Task declarations below.'],['verification','All pre-existing confirmations/checks/reviews are explicit synthetic controller inputs. No real user has accepted T1.']])fs.writeFileSync(path.join(project,f.iteration,name+'.md'),'# '+name+'\n'+text+'\n');
  fs.writeFileSync(path.join(project,'docs/project/overview.md'),'# Synthetic project\nEvaluate workflow state queries and pause/block boundaries.\n');
  fs.writeFileSync(path.join(project,'server.mjs'),'export const value = 1;\n');fs.writeFileSync(path.join(project,'result.json'),'{"fixtureOnly":true,"declaredCheckPassed":true}\n');
  const d=driver(planWorkflowTransition,f);d.awaiting();
  if(kind==='blocked'){d.add(record(f,'unresolved','blocker',{reason:'Synthetic unresolved prerequisite',condition:'A resolution record with actual evidence is required'}));d.apply('block',{blocker_refs:[ref(f,'unresolved')],reason:'Explicit synthetic blocking'});}
  fs.mkdirSync(path.join(project,'docs/iterations/999-future-draft'));fs.writeFileSync(path.join(project,'docs/iterations/999-future-draft/scope.md'),'An unapproved future directory, never infer active work from its number.\n');
  return f;
}

// Disable only the isolated client's non-project skills after real native discovery.
const discoveryProject=path.join(out,'discovery-project');fixture(discoveryProject,'waiting');
const initial=await discoverSkills({cli,project:discoveryProject,home,token});fs.writeFileSync(path.join(out,'native-before-isolation.json'),redact(JSON.stringify(initial,null,2)));
for(const skill of initial.response.result.data[0].skills.filter(s=>s.scope!=='repo'&&s.enabled))fs.appendFileSync(path.join(home,'config.toml'),'\n[[skills.config]]\npath = '+JSON.stringify(skill.path.replaceAll('\\','/'))+'\nenabled = false\n');
context.isolated_config_sha256=hash(fs.readFileSync(path.join(home,'config.toml')));fs.writeFileSync(path.join(out,'context.json'),JSON.stringify(context,null,2));

const results=[];
async function run(scenario,repeat){
  const id=scenario.id+'-'+repeat,dir=path.join(out,id),project=path.join(dir,'project');fs.mkdirSync(dir);const f=fixture(project,scenario.fixture);
  const discovery=await discoverSkills({cli,project,home,token}),native=discovery.response.result.data[0];fs.writeFileSync(path.join(dir,'native-discovery.json'),redact(JSON.stringify(discovery,null,2)));
  if(native.errors.length||native.skills.some(s=>s.scope!=='repo'&&s.enabled)||!native.skills.some(s=>s.name==='workflow-guide'&&s.scope==='repo'&&s.enabled))throw Error('Native discovery or isolated skill configuration failed');
  const before=snapshot(project),beforeState=current(project),evidence=captureEvidence(project);fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(before));fs.writeFileSync(path.join(dir,'frozen-project.json'),JSON.stringify(evidence));
  // Use this host's already allowed execution mode in each isolated project.
  // Read-only behavior is judged by requests and snapshots, not write denial.
  const cliArgs=[cli,'exec','--json','--ephemeral','--skip-git-repo-check','-s','danger-full-access','-c','approval_policy="never"','-C',project,'-'];
  fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify({id,scenario,cliArgs},null,2));const started=Date.now();
  const child=spawn(process.execPath,cliArgs,{cwd:project,env:{...process.env,CODEX_HOME:home,ITERLANE_VALIDATION_API_KEY:token},windowsHide:true,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false,processError;child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.stdin.end(scenario.prompt);
  const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{encoding:'utf8',windowsHide:true});else child.kill('SIGKILL');},deadline);
  await new Promise(resolve=>{child.once('error',e=>{processError=e.code;resolve();});child.once('close',resolve);});clearTimeout(timer);
  fs.writeFileSync(path.join(dir,'events.jsonl'),redact(stdout));fs.writeFileSync(path.join(dir,'stderr.txt'),redact(stderr));const actual={...eventEvidence(stdout),commands:collectStateCommands(stdout)},after=snapshot(project),afterState=current(project),failures=[];
  if(child.exitCode!==0||timedOut||!actual.completed||actual.errors.length||!actual.final)failures.push('session did not complete cleanly');
  if(!actual.commands.some(c=>c.exitCode===0&&/iterlane\.mjs.*\bstatus\b/u.test(c.command)))failures.push('no successful project status query');
  if(hash(fs.readFileSync(globalConfigFile))!==context.global_config_sha256||hash(fs.readFileSync(path.join(home,'config.toml')))!==context.isolated_config_sha256||!isDeepStrictEqual(snapshot(packageRoot),context.package)||hash(fs.readFileSync(cli))!==context.cli_sha256)failures.push('configuration or fixed artifact changed during run');
  const changed=after.filter(file=>!before.some(old=>old.path===file.path&&old.sha256===file.sha256)).map(file=>file.path),removed=before.filter(file=>!after.some(next=>next.path===file.path)).map(file=>file.path);
  if(scenario.id==='authorized-pause'){
    if(afterState.status!=='paused'||afterState.current_task!=='T1'||afterState.current_iteration!==f.iteration||afterState.revision<=beforeState.revision)failures.push('requested pause was not persisted');
    if(!actual.commands.some(c=>c.exitCode===0&&/iterlane\.mjs.*\btransition\b/u.test(c.command)))failures.push('pause did not use the installed semantic transition CLI');
    const doc=parseWorkflowDocument(fs.readFileSync(path.join(project,f.iteration+'/verification.md'),'utf8'),f.iteration+'/verification.md'),saved=doc.records.get(afterState.checkpoint_ref?.record_id);
    if(saved?.data.position.status!=='awaiting_user'||saved?.data.position.waiting_for!=='task_acceptance')failures.push('pause lost the original acceptance wait');
    if(changed.some(p=>before.some(old=>old.path===p)&&!(p===f.iteration+'/tasks.md'||p===f.iteration+'/verification.md'||p==='docs/workflow/state.yaml'||p==='.gitattributes'||p==='.ai-workflow/manifest.json'||p.startsWith('.ai-workflow/.local/')))||removed.length)failures.push('pause changed unrelated existing files');
    if(!actual.commands.some(c=>c.output.includes('# 状态工具与结构化记录')&&c.output.includes('## 中断与限制')))failures.push('public state operation reference was not visibly read');
  }else{
    if(!isDeepStrictEqual(before,after))failures.push('query or unresolved blocker changed project files');
    if(scenario.id==='unresolved-block'&&afterState.status!=='blocked')failures.push('unresolved blocking was bypassed');
  }
  const finalCheck=spawnSync(process.execPath,[path.join(project,'.ai-workflow/bin/iterlane.mjs'),'check','--documents','--json'],{cwd:project,encoding:'utf8',windowsHide:true,timeout:30000});if(finalCheck.status!==0)failures.push('final document/resource check failed');
  const result={id,passed:failures.length===0,failures,exit_code:child.exitCode,timed_out:timedOut,process_error:processError,elapsed_ms:Date.now()-started,changed,removed,before_state:beforeState,after_state:afterState,actual};fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(after));fs.writeFileSync(path.join(dir,'final-check.json'),finalCheck.stdout);fs.writeFileSync(path.join(dir,'result.json'),redact(JSON.stringify(result,null,2)));results.push({id,passed:result.passed,failures,elapsed_ms:result.elapsed_ms});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
}
// Independent fresh CLI sessions, no delegated implementation or shared project.
for(const scenario of cases.filter(c=>!selected||c.id===selected))await Promise.all([1,2,3].map(repeat=>run(scenario,repeat)));
if(results.some(r=>!r.passed))process.exitCode=1;
console.log(JSON.stringify({runs:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,old_model_baseline_rechecked:false}));
