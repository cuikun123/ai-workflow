import Ajv2020 from 'ajv/dist/2020.js';
import records from '../schemas/workflow-record-v2.schema.json' with {type:'json'};
import requestSchema from '../schemas/guard-request.schema.json' with {type:'json'};
import {parseStrictJson} from './workflow-docs.mjs';
import {WorkflowError} from './errors.mjs';
import {validateGuardRelativePath,validateGuardAbsolutePath,validateGuardBranch,isGuardUnicodeText} from './guard-declarations.mjs';

export const guardRequestBytes=16*1024*1024;
export const guardFileTextBytes=8*1024*1024;
const invalid=message=>{throw new WorkflowError('USAGE',message);};
const ajv=new Ajv2020({allErrors:true,strict:true,strictTypes:false});
ajv.addSchema(records);
const validate=ajv.compile(requestSchema);
function checkJsonBudget(value){
 let bytes=0;
 const active=new Set();
 const add=n=>{bytes+=n;if(bytes>guardRequestBytes)invalid('Guard request exceeds its UTF-8 JSON byte limit');};
 const string=s=>{
  if(!isGuardUnicodeText(s))invalid('Guard request contains an isolated Unicode surrogate');
  add(2);
  for(let i=0;i<s.length;i++){
   const c=s.charCodeAt(i);
   if(c===34||c===92)add(2);
   else if(c<32)add([8,9,10,12,13].includes(c)?2:6);
   else if(c<128)add(1);
   else if(c<2048)add(2);
   else if(c>=0xd800&&c<=0xdbff){add(4);i++;}
   else add(3);
  }
 };
 const visit=(v,depth=0)=>{
  if(depth>64)invalid('Guard request JSON is too deeply nested');
  if(v===null){add(4);return;}
  if(typeof v==='string'){string(v);return;}
  if(typeof v==='boolean'){add(v?4:5);return;}
  if(typeof v==='number'){if(!Number.isSafeInteger(v))invalid('Guard request numbers must be lossless safe integers');add(String(Object.is(v,-0)?0:v).length);return;}
  if(typeof v!=='object')invalid('Guard request contains a non-JSON value');
  if(active.has(v))invalid('Guard request contains a JSON cycle');
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);
  if(!array&&prototype!==Object.prototype&&prototype!==null)invalid('Guard request contains a non-JSON object');
  active.add(v);add(2);
  const keys=Reflect.ownKeys(v).filter(k=>!array||k!=='length');
  if(array&&keys.length!==v.length)invalid('Guard request contains a sparse or extended array');
  for(let i=0;i<keys.length;i++){
   const key=keys[i],descriptor=Object.getOwnPropertyDescriptor(v,key);
   if(typeof key!=='string'||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid('Guard request contains an accessor or non-JSON property');
   if(i)add(1);
   if(array){if(key!==String(i))invalid('Guard request contains a non-JSON array property');}
   else{string(key);add(1);}
   visit(descriptor.value,depth+1);
  }
  active.delete(v);
 };
 visit(value);
}
export function validateGuardRequest(value){
 checkJsonBudget(value);
 if(!validate(value))invalid('Guard request does not match its schema: '+validate.errors.map(e=>e.instancePath+' '+e.message).join('; '));
 try{
  if(value.task_ref){validateGuardRelativePath(value.task_ref.path);if(!/^docs\/iterations\/[^/]+\/tasks\.md$/u.test(value.task_ref.path))invalid('Guard task reference must name a task document');}
  for(const ref of value.authorization_refs){validateGuardRelativePath(ref.path);if(!/^docs\/iterations\/[^/]+\/verification\.md$/u.test(ref.path))invalid('Guard authorization reference must name verification');}
  const op=value.operation;
  if(op.cwd!==undefined)validateGuardRelativePath(op.cwd,{cwd:true});
  if(op.executable!==undefined)validateGuardAbsolutePath(op.executable);
  for(const path of op.paths||[])validateGuardRelativePath(path);
  for(const field of ['target_branch'])if(op[field])validateGuardBranch(op[field]);
  if(op.integration_check_ref)validateGuardRelativePath(op.integration_check_ref.path);
  const changedPaths=new Set();
  for(const change of op.changes||[]){
   validateGuardRelativePath(change.path);
   const identity=change.path.normalize('NFC').toLowerCase();
   if(changedPaths.has(identity))invalid('Guard file changes have duplicate portable identities');
   changedPaths.add(identity);
   if(change.after?.encoding==='utf8'){
    if(Buffer.byteLength(change.after.text)>guardFileTextBytes)invalid('Guard file text exceeds its byte limit');
    if(/[\u0000\ufffd]/u.test(change.after.text))invalid('Guard file content violates the existing text-character restrictions');
   }
  }
 }catch(error){if(error.code==='USAGE')throw error;invalid(error.message);}
 return value;
}
export function parseGuardRequest(text){
 let value;
 try{value=parseStrictJson(text,guardRequestBytes);}catch(error){invalid(error.message);}
 return validateGuardRequest(value);
}
