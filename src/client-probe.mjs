import fs from 'node:fs';import {join,resolve,dirname} from 'node:path';import {tmpdir,homedir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';
import {diagnoseProject} from './diagnostics.mjs';import {skillNames} from './skill-names.mjs';import metadata from '../package.json' with {type:'json'};
const digest=b=>createHash('sha256').update(b).digest('hex'),configFile=()=>join(process.env.CODEX_HOME||join(homedir(),'.codex'),'config.toml');
const fingerprint=()=>{try{return digest(fs.readFileSync(configFile()));}catch{return null;}};
function commandFor(cli){
 let candidates=cli?[resolve(cli)]:[];
 if(!cli&&process.platform==='win32'){const found=spawnSync('where.exe',['codex'],{encoding:'utf8',windowsHide:true});if(found.status===0)candidates=found.stdout.trim().split(/\r?\n/);}
 for(const path of candidates){const js=/\.(?:cmd|ps1)$/i.test(path)?join(dirname(path),'node_modules/@openai/codex/bin/codex.js'):path;try{const stat=fs.lstatSync(js);if(!stat.isFile()||stat.isSymbolicLink())continue;if(/\.[cm]?js$/i.test(js))return {exe:process.execPath,args:[js]};if(/\.exe$/i.test(js))return {exe:js,args:[]};}catch{}}
 throw Object.assign(new Error('Client executable unavailable'),{failure:'client_unavailable'});
}
function stop(child){if(!child.pid||child.exitCode!==null)return;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGKILL');}
function childSession(command,args,{cwd,timeout,input,keepOpen=false,onLine}={}){
 return new Promise((done)=>{let stdout='',stderr='',buffer='',settled=false,timedOut=false;const child=spawn(command.exe,[...command.args,...args],{cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const finish=(exitCode,error)=>{if(settled)return;settled=true;clearTimeout(timer);stop(child);done({stdout,stderr,exitCode,error,timedOut});};
 const timer=setTimeout(()=>{timedOut=true;finish(null,'timeout');},timeout);child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
 child.stdout.on('data',chunk=>{if(settled)return;stdout+=chunk;buffer+=chunk;if(Buffer.byteLength(stdout)>4*1024*1024){finish(null,'protocol');return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(onLine){try{onLine(line,child,()=>finish(0));}catch{finish(null,'protocol');return;}}}});
 child.stderr.on('data',chunk=>{stderr+=chunk;if(Buffer.byteLength(stderr)>1024*1024)finish(null,'protocol');});child.once('error',e=>finish(null,e.code));child.once('close',code=>finish(code));
 child.stdin.on('error',()=>finish(null,'protocol'));
 if(input!==undefined){if(keepOpen)child.stdin.write(input);else child.stdin.end(input);}
 });
}
const quote=s=>"'"+s.replaceAll('\\','/').replaceAll("'","''")+"'";
function observedCommand(raw,expected){if(raw.trim()===expected)return true;const match=raw.match(/\s-(?:Command|c)\s+([\s\S]+)$/i);if(!match)return false;let body=match[1].trim();if(body[0]==="'"&&body.at(-1)==="'")body=body.slice(1,-1).replaceAll("''","'");else if(body[0]==='"'&&body.at(-1)==='"')body=body.slice(1,-1).replaceAll('\\"','"');return body===expected;}
function failureFor(result){if(result.timedOut||result.error==='timeout')return 'timeout';if(result.error==='ENOENT')return 'client_unavailable';const text=result.stderr+'\n'+result.stdout;if(/401|403|unauthoriz|authentication|invalid.*key/i.test(text))return 'authentication';if(/429|rate.limit/i.test(text))return 'rate_limit';if(/EOF|connect|transport|network|fetch failed|socket/i.test(text))return 'transport';return 'protocol';}
export async function probeClient(projectRoot,{cli,timeoutMs=120000}={}){
 const report=diagnoseProject(projectRoot),start=Date.now(),before=fingerprint();
 report.client={status:'not_probed',failure:null,execution_observed:false,source_authenticity_verified:false,framework_attempts:0};
 if(!report.local_valid)return report;
 let command,folder;
 try{
  command=commandFor(cli);const version=await childSession(command,['--version'],{cwd:report.project,timeout:Math.min(timeoutMs,10000),input:''});if(version.exitCode!==0)throw Object.assign(new Error('Client version lookup failed'),{failure:failureFor(version)});
  let discovered=null;const init=JSON.stringify({id:1,method:'initialize',params:{clientInfo:{name:'iterlane-client-check',version:metadata.version},capabilities:{experimentalApi:true}}})+'\n';
  const discovery=await childSession(command,['app-server'],{cwd:report.project,timeout:Math.min(timeoutMs,30000),onLine:(line,child,finish)=>{let m;try{m=JSON.parse(line);}catch{return;}if(m.id===1){if(m.error){discovered={error:true};finish();return;}child.stdin.write(JSON.stringify({method:'initialized'})+'\n'+JSON.stringify({id:2,method:'skills/list',params:{cwds:[report.project],forceReload:true}})+'\n');}if(m.id===2){discovered=m;finish();}},input:init,keepOpen:true});
  // Start the RPC after listeners are registered; app-server keeps stdin open.
  if(!discovered&&discovery.error)throw Object.assign(new Error('Discovery failed'),{failure:failureFor(discovery)});
  const list=discovered?.result?.data?.find(x=>resolve(x.cwd)===report.project),skills=list?.skills||[];
  if(discovery.exitCode!==0||!list||list.errors?.length||skillNames.some(name=>!skills.some(s=>s.name===name&&s.enabled&&resolve(s.path)===join(report.project,'.agents/skills',name,'SKILL.md'))))throw Object.assign(new Error('Client did not discover the installed skills'),{failure:'skills_unavailable'});
  const expected='& '+quote(process.execPath)+' '+quote(join(report.project,'.ai-workflow/bin/iterlane.mjs'))+' status --json';
  folder=fs.mkdtempSync(join(tmpdir(),'iterlane-client-check-'));const schemaPath=join(folder,'reply.json');fs.writeFileSync(schemaPath,JSON.stringify({type:'object',additionalProperties:false,required:['marker','current_task','status'],properties:{marker:{type:'string',const:'ITERLANE_READ_ONLY_CHECK'},current_task:{type:['string','null']},status:{type:'string'}}}));
  const prompt='Check this installed workflow without any writes, Git, installs, configuration changes or delegation. Use the shell to run exactly this read-only command: '+expected+'. Read only project navigation and the installed workflow entry if necessary. Return JSON with marker ITERLANE_READ_ONLY_CHECK, current_task and status from that command.';
  report.client.framework_attempts=1;
  const result=await childSession(command,['exec','--json','--ephemeral','--skip-git-repo-check','-s','read-only','-c','approval_policy="never"','-C',report.project,'--output-schema',schemaPath,'-'],{cwd:report.project,timeout:timeoutMs,input:prompt});
  if(result.exitCode!==0||result.timedOut)throw Object.assign(new Error('Client invocation failed'),{failure:failureFor(result)});
  const events=result.stdout.split(/\r?\n/).filter(Boolean).map(s=>{try{return JSON.parse(s);}catch{return null;}}).filter(Boolean),items=events.filter(e=>e.type==='item.completed').map(e=>e.item);let observed=null,reply=null;
  for(const item of items){if(item?.type==='command_execution'&&item.exit_code===0&&observedCommand(item.command||'',expected)){try{const parsed=JSON.parse(item.aggregated_output);if(parsed.ok&&parsed.command==='status'&&parsed.version===metadata.version)observed=parsed.data?.state;}catch{}}if(item?.type==='agent_message'){try{reply=JSON.parse(item.text);}catch{}}}
  const after=diagnoseProject(report.project);
  if(!events.some(e=>e.type==='turn.completed')||!observed||!reply||reply.marker!=='ITERLANE_READ_ONLY_CHECK'||observed.current_task!==report.state.current_task||observed.status!==report.state.status||reply.current_task!==observed.current_task||reply.status!==observed.status||!after.local_valid||JSON.stringify(after.state)!==JSON.stringify(report.state))throw Object.assign(new Error('No matching actual read-only command'),{failure:'protocol'});
  if(fingerprint()!==before)throw Object.assign(new Error('Client configuration changed'),{failure:'configuration_changed'});
  const rawUsage=events.findLast(e=>e.type==='turn.completed')?.usage,usage=rawUsage?Object.fromEntries(['input_tokens','cached_input_tokens','output_tokens'].map(key=>[key,Number.isSafeInteger(rawUsage[key])&&rawUsage[key]>=0?rawUsage[key]:null])):null;
  report.client={status:'connected',failure:null,execution_observed:true,checked_skills:skillNames.length,cli_version:version.stdout.match(/codex-cli [0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?/)?.[0]||'unknown',framework_attempts:1,sandbox:'read-only',config_file_unchanged:true,event_sha256:digest(result.stdout),reported_usage:usage,source_authenticity_verified:false,elapsed_ms:Date.now()-start};
 }catch(error){report.client={...report.client,status:'failed',failure:error.failure||'protocol',elapsed_ms:Date.now()-start};report.findings.push({code:'CLIENT_'+report.client.failure.toUpperCase(),category:'client',severity:'error',impact:'客户端只读检查未完成。',next_step:'检查客户端入口、登录、网络或实际配置；不自动回滚安装。',evidence:[]});}
 finally{if(folder&&resolve(folder).startsWith(resolve(tmpdir())+'\\'))fs.rmSync(folder,{recursive:true,force:true});}
 return report;
}
