import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export async function startService({directory,version,dataFile}){
  const child=spawn(process.execPath,[path.join(directory,'server.mjs')],{cwd:directory,windowsHide:true,env:{...process.env,PORT:'0',BOOKMARKS_FILE:dataFile,ITERLANE_RELEASE_VERSION:version},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
  async function stop(){if(child.exitCode!==null||child.signalCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');},3000);child.once('close',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});}
  try{
    const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('HTTP startup deadline')),10000);const finish=(error,port)=>{clearTimeout(timer);error?reject(error):resolve(port);};child.once('error',e=>finish(e));child.once('close',code=>finish(Error('HTTP exited before ready: '+code+' '+stderr)));child.stdout.on('data',()=>{for(const line of stdout.split('\n'))try{const value=JSON.parse(line);if(Number.isInteger(value.port)&&value.port>0&&value.port<=65535){finish(null,value.port);return;}}catch{}});});
    return {child,url:'http://127.0.0.1:'+port,port,stop,logs:()=>({stdout,stderr}),stopped:()=>child.exitCode!==null||child.signalCode!==null};
  }catch(error){await stop();throw error;}
}
export async function health(service,expectedVersion){const response=await fetch(service.url+'/health',{signal:AbortSignal.timeout(5000)}),body=await response.text();let value;try{value=JSON.parse(body);}catch{}return {status:response.status,value,body,valid:response.status===200&&value?.ok===true&&value?.version===expectedVersion};}
export async function deployAndRollback({candidate,previous,dataFile}){
  const before=digest(dataFile),services=[],result={failed:false,rolled_back:false};
  try{
    let service;
    try{service=await startService({...candidate,dataFile});services.push(service);const check=await health(service,candidate.version);result.candidate={version:candidate.version,pid:service.child.pid,url:service.url,health:check};if(check.valid){result.data_preserved=digest(dataFile)===before;return result;}}
    catch(error){result.candidate={version:candidate.version,error:error.message};}
    result.failed=true;if(service)await service.stop();
    try{const rollback=await startService({...previous,dataFile});services.push(rollback);const restored=await health(rollback,previous.version);result.rollback={version:previous.version,pid:rollback.child.pid,url:rollback.url,health:restored};result.rolled_back=restored.valid;}
    catch(error){result.rollback={version:previous.version,error:error.message};}
    result.data_preserved=digest(dataFile)===before;return result;
  }finally{for(const service of services)await service.stop();result.processes_stopped=services.every(s=>s.stopped());result.logs=services.map(s=>s.logs());}
}
