import fs from 'node:fs';
export function renameDirectory(from,to,{rename=fs.renameSync,delays=process.platform==='win32'?[100,200,400]:[]}={}){
 for(let attempt=0;;attempt++){
  if(fs.existsSync(to))throw Object.assign(Error('Build output appeared; it was preserved'),{code:'EEXIST'});
  try{return rename(from,to);}catch(error){
   if(!['EPERM','EBUSY'].includes(error.code)||attempt>=delays.length||!fs.existsSync(from)||fs.existsSync(to))throw error;
   const stat=fs.lstatSync(from);if(!stat.isDirectory()||stat.isSymbolicLink())throw error;
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delays[attempt]);
  }
 }
}
