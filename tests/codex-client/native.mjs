import {spawn} from 'node:child_process';
export async function discoverSkills({cli,project,home,token}){
  const child=spawn(process.execPath,[cli,'app-server'],{cwd:project,windowsHide:true,env:{...process.env,CODEX_HOME:home,ITERLANE_VALIDATION_API_KEY:token},stdio:['pipe','pipe','pipe']});
  let buffer='',stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  try{return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Native skill discovery deadline')),30000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.stdout.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let message;try{message=JSON.parse(line);}catch{continue;}
      if(message.id===1){if(message.error){clearTimeout(timer);reject(Error(JSON.stringify(message.error)));return;}child.stdin.write(JSON.stringify({method:'initialized'})+'\n');child.stdin.write(JSON.stringify({id:2,method:'skills/list',params:{cwds:[project],forceReload:true}})+'\n');}
      if(message.id===2){clearTimeout(timer);if(message.error)reject(Error(JSON.stringify(message.error)));else resolve({response:message,stderr});}
    }});
    child.stdin.write(JSON.stringify({id:1,method:'initialize',params:{clientInfo:{name:'iterlane-evaluation',version:'step3'},capabilities:{experimentalApi:true}}})+'\n');
  });}finally{child.kill();}
}
