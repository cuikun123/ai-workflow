// Protocol fixture only. Never a substitute for the final real Codex invocation.
import fs from 'node:fs';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const mode=process.env.ITERLANE_PROBE_FIXTURE_MODE||'ok',args=process.argv.slice(2);
if(args.includes('--version')){console.log('codex-cli 0.169.0');process.exit(0);}
if(args.includes('app-server')){
 let buffer='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,n);buffer=buffer.slice(n+1);const r=JSON.parse(raw);if(r.method==='initialize'){console.log(JSON.stringify({id:r.id,result:{userAgent:'test fixture'}}));}if(r.method==='skills/list'){if(!Array.isArray(r.params.cwds)||r.params.cwds.length!==1)process.exit(2);const cwd=r.params.cwds[0],dir=join(cwd,'.agents/skills'),skills=fs.readdirSync(dir).map(name=>({name,path:join(dir,name,'SKILL.md'),scope:'repo',enabled:true}));console.log(JSON.stringify({id:r.id,result:{data:[{cwd,skills,errors:[]}]}}));}}});
}else if(args[0]==='exec'){
 if(args[args.indexOf('-s')+1]!=='read-only'||!args.includes('approval_policy="never"')||!args.includes('--ephemeral'))process.exit(3);
 let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
  if(mode==='timeout'){setInterval(()=>{},1000);return;}
  if(mode==='auth'){console.error('401 unauthorized PROBE_PRIVATE_SECRET');process.exit(1);}
  const cwd=args[args.indexOf('-C')+1],cli=join(cwd,'.ai-workflow/bin/iterlane.mjs'),r=spawnSync(process.execPath,[cli,'status','--json'],{cwd,encoding:'utf8',windowsHide:true}),state=JSON.parse(r.stdout).data.state;
  const quote=x=>"'"+x.replaceAll('\\','/').replaceAll("'","''")+"'",command='& '+quote(process.execPath)+' '+quote(cli)+' status --json';
  if(!input.includes(command))process.exit(4);
  if(mode!=='fake')console.log(JSON.stringify({type:'item.completed',item:{id:'query',type:'command_execution',command,aggregated_output:r.stdout,exit_code:r.status,status:'completed'}}));
  console.log(JSON.stringify({type:'item.completed',item:{id:'reply',type:'agent_message',text:JSON.stringify({marker:'ITERLANE_READ_ONLY_CHECK',current_task:state.current_task,status:state.status})}}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:0,output_tokens:20,...(mode==='usage-secret'?{unknown:'PROBE_PRIVATE_SECRET'}:{})}}));
 });
}else process.exit(2);
