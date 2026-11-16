import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {discoverSkills} from '../codex-client/native.mjs';
import {eventEvidence} from '../codex-client/events.mjs';
import {collectStateCommands} from '../codex-client/state-events.mjs';
import {snapshot,captureEvidence} from '../codex-client/evidence.mjs';
import {createClientJournal} from './client-journal.mjs';
export function packagedSkillNames(packageRoot){
  const root=path.join(packageRoot,'resources/skills');
  return fs.readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(root,entry.name,'SKILL.md'))).map(entry=>entry.name).sort();
}
export function assertClientBaseline(frozen,actual){if(!isDeepStrictEqual(frozen,actual))throw Error('Frozen actual client baseline changed');return true;}
export async function createClient({out,cli,packageRoot,discoveryProject,resume=false}){
  const home=path.join(out,'client-home');if(!resume)fs.mkdirSync(home);
  const globalFile=path.join(process.env.USERPROFILE,'.codex/config.toml'),original=fs.readFileSync(globalFile,'utf8');
  const scalar=(key,text=original)=>JSON.parse(text.match(new RegExp('^\\s*'+key+'\\s*=\\s*(".*")\\s*$','m'))?.[1]||'null');
  const provider=scalar('model_provider'),section=original.split('[model_providers.'+provider+']')[1]?.split(/^\[/m)[0],token=scalar('experimental_bearer_token',section||'');
  if(!token||!scalar('model'))throw Error('Existing provider credential or model unavailable');
  const sanitized=original.replace(/^\s*experimental_bearer_token\s*=\s*".*"\s*$/gm,'env_key = "ITERLANE_VALIDATION_API_KEY"');if(sanitized.includes(token))throw Error('Credential sanitization failed');
  const redact=s=>s.split(token).join('[REDACTED]'),hash=b=>createHash('sha256').update(b).digest('hex');if(!resume)fs.writeFileSync(path.join(home,'config.toml'),sanitized);
  if(!resume){
  const first=await discoverSkills({cli,project:discoveryProject,home,token});fs.writeFileSync(path.join(out,'native-before-isolation.json'),redact(JSON.stringify(first,null,2)));
  for(const skill of first.response.result.data[0].skills.filter(s=>s.scope!=='repo'&&s.enabled))fs.appendFileSync(path.join(home,'config.toml'),'\n[[skills.config]]\npath = '+JSON.stringify(skill.path.replaceAll('\\','/'))+'\nenabled = false\n');
  }
  const cliVersion=spawnSync(process.execPath,[cli,'--version'],{encoding:'utf8',windowsHide:true,timeout:30000});if(cliVersion.status!==0)throw Error('Actual client version lookup failed');
  const cliBinary=path.resolve(path.dirname(cli),'../node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe');
  const actual={package:snapshot(packageRoot),cli:hash(fs.readFileSync(cli)),binary:hash(fs.readFileSync(cliBinary)),config:hash(fs.readFileSync(path.join(home,'config.toml'))),global:hash(Buffer.from(original))};
  const saved=resume?JSON.parse(fs.readFileSync(path.join(out,'context.json'),'utf8')):null,frozen=saved?saved.fingerprint:actual;
  if(resume){if(path.resolve(saved.cli)!==path.resolve(cli)||path.resolve(saved.packageRoot)!==path.resolve(packageRoot))throw Error('Resume client/package path changed');assertClientBaseline(frozen,actual);}
  const context=saved||{requested_model:scalar('model'),effort:scalar('model_reasoning_effort'),provider,cli_version:cliVersion.stdout.trim(),cli,packageRoot,fingerprint:frozen,old_model_baseline_rechecked:false,started_at:new Date().toISOString()};if(!resume)fs.writeFileSync(path.join(out,'context.json'),JSON.stringify(context,null,2));console.log(JSON.stringify({client:context.cli_version,model:context.requested_model,effort:context.effort,provider,global_modified:false,resumed:resume}));
  const baselineUnchanged=()=>isDeepStrictEqual(frozen,{package:snapshot(packageRoot),cli:hash(fs.readFileSync(cli)),binary:hash(fs.readFileSync(cliBinary)),config:hash(fs.readFileSync(path.join(home,'config.toml'))),global:hash(fs.readFileSync(globalFile))});
  async function session({id,project,prompt,schema,deadline=240000,control=false}){
    const dir=path.join(out,id);fs.mkdirSync(dir);if(!baselineUnchanged())throw Error('Frozen actual client baseline changed');
    const native=await discoverSkills({cli,project,home,token});fs.writeFileSync(path.join(dir,'native-discovery.json'),redact(JSON.stringify(native,null,2)));const data=native.response.result.data[0];
    const globals=data.skills.filter(s=>s.scope!=='repo'&&s.enabled).length,repo=data.skills.filter(s=>s.scope==='repo'&&s.enabled),expected=control?[]:packagedSkillNames(packageRoot);
    if(data.errors.length||globals||repo.length!==expected.length||expected.some(name=>!repo.some(skill=>skill.name===name)))throw Error('Actual native discovery does not match the selected framework/control fixture');
    const evidence=control?{project,files:snapshot(project,{text:true}),managedPaths:[],check:null}:captureEvidence(project);
    if(!control){const status=spawnSync(process.execPath,[path.join(project,'.ai-workflow/bin/iterlane.mjs'),'status','--json'],{cwd:project,windowsHide:true,encoding:'utf8',timeout:30000});evidence.status={exitCode:status.status,value:JSON.parse(status.stdout)};}
    for(const file of evidence.files)if(!file.path.startsWith('.ai-workflow/')&&/\.(?:mjs|json|html)$/.test(file.path))file.text=fs.readFileSync(path.join(project,file.path),'utf8');
    fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(evidence,null,2));
    const args=[cli,'exec','--json','--ephemeral','--skip-git-repo-check','-s','danger-full-access','-c','approval_policy="never"','-C',project];
    if(schema){const file=path.join(dir,'schema.json');fs.writeFileSync(file,JSON.stringify(schema));args.push('--output-schema',file);}args.push('-');fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify({id,project,prompt,args,deadline},null,2));
    const started=Date.now(),child=spawn(process.execPath,args,{cwd:project,windowsHide:true,env:{...process.env,CODEX_HOME:home,ITERLANE_VALIDATION_API_KEY:token},stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',timedOut=false,processError;const journal=createClientJournal(dir,token);
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',b=>{stdout+=b;journal.write('stdout',b);});child.stderr.on('data',b=>{stderr+=b;journal.write('stderr',b);});child.stdin.end(prompt);
    const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});else child.kill('SIGKILL');},deadline);
    await new Promise(resolve=>{child.once('error',e=>{processError=e.code;resolve();});child.once('close',resolve);});clearTimeout(timer);
    // Rewrite from the complete buffer so split UTF-8/token chunks cannot damage evidence.
    journal.finish({exitCode:child.exitCode,timedOut,model_turn_completed:eventEvidence(stdout).completed});fs.writeFileSync(path.join(dir,'events.jsonl'),redact(stdout));fs.writeFileSync(path.join(dir,'stderr.txt'),redact(stderr));
    const after=snapshot(project),actual=eventEvidence(stdout),result={id,exitCode:child.exitCode,timedOut,processError,elapsed_ms:Date.now()-started,...actual,commands:collectStateCommands(stdout),evidence,after,unchanged:isDeepStrictEqual(evidence.files.map(({text,...v})=>v),after),globalConfigUnchanged:hash(fs.readFileSync(globalFile))===frozen.global,baselineUnchanged:baselineUnchanged(),globalSkillsEnabled:globals};
    fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(after,null,2));fs.writeFileSync(path.join(dir,'execution.json'),JSON.stringify({exitCode:result.exitCode,timedOut,completed:result.completed,events_sha256:hash(Buffer.from(redact(stdout)))},null,2));fs.writeFileSync(path.join(dir,'run.json'),redact(JSON.stringify(result,null,2)));return result;
  }
  return {session,baselineUnchanged,context};
}
