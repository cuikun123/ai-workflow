import * as fs from 'node:fs';import metadata from '../package.json' with {type:'json'};
import {projectPath,readProjectFile} from './project-paths.mjs';import {sha256} from './package.mjs';import {parseStrictJson} from './workflow-docs.mjs';import {WorkflowError} from './errors.mjs';
import {validateSpecInventory} from './spec-inventory.mjs';
export const workflowLocal='.ai-workflow/.local/workflow-operations';
export const workflowJournalLimit=64*1024*1024;
export const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
export const encode=value=>value===null?null:value.toString('base64');
export const decode=value=>value===null?null:Buffer.from(value,'base64');
export const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const fail=message=>{throw new WorkflowError('INCOMPLETE',message);};
export function validateWorkflowJournal(root,j,expectedVersion=metadata.version){
  if(!exact(j,['journal_version','kind','operation_id','project_root','nonce','package','request','created_at','phase','intent','files','reads','created_dirs','temporary','rollback_state',...(j.journal_version===2?['inventories']:[])])||![1,2].includes(j.journal_version)||j.kind!=='workflow-state'||!uuid(j.operation_id)||!uuid(j.nonce)||j.project_root!==root||!['prepared','applying','blocked','committed','rolled_back'].includes(j.phase)||!['apply','undo'].includes(j.intent)||typeof j.created_at!=='string'||new Date(j.created_at).toISOString()!==j.created_at)fail('Invalid workflow journal identity');
  if(j.journal_version===2){validateSpecInventory(j.inventories);if(!exact(j.request,['operation_version','request_id','expected_revision','action','data'])||j.request.operation_version!==2)fail('Invalid v2 workflow request');}
  if(!exact(j.package,['name','version','source_manifest_sha256','state_schemas'])||j.package.name!==metadata.name||j.package.version!==expectedVersion||!/^[a-f0-9]{64}$/u.test(j.package.source_manifest_sha256)||JSON.stringify(j.package.state_schemas)!=='[1]')fail('Workflow journal belongs to another package');
  if(!Array.isArray(j.files)||!j.files.length||j.files.length>2000||!Array.isArray(j.reads)||j.reads.length>3000||!Array.isArray(j.created_dirs))fail('Invalid workflow inventory');
  const ids=new Set();
  for(const f of j.files){
    if(!exact(f,['path','kind','before','before_sha256','after','after_sha256','status'])||!['file','attributes'].includes(f.kind)||!['pending','applied','undone'].includes(f.status)||typeof f.path!=='string'||!(f.path==='.gitattributes'||f.path==='.ai-workflow/manifest.json'||f.path==='docs/workflow/state.yaml'||/^docs\/iterations\/[^/]+\/(?:tasks|verification)\.md$/u.test(f.path)||j.journal_version===2&&(j.request.action==='record'&&/^docs\/iterations\/[^/]+\/scope\.md$/u.test(f.path)||j.request.action==='spec_sync'&&f.path.startsWith('docs/project/specs/')&&/\.md$/iu.test(f.path))))fail('Workflow target is outside its write scope');
    projectPath(root,f.path);const id=f.path.toLowerCase();if(ids.has(id))fail('Duplicate workflow target');ids.add(id);
    for(const [field,digest]of [['before','before_sha256'],['after','after_sha256']]){const value=f[field];if(field==='before'&&value===null){if(f[digest]!==null)fail('Missing-file preimage was changed');continue;}if(typeof value!=='string'||value.length>12*1024*1024||encode(decode(value))!==value||sha256(decode(value))!==f[digest])fail('Workflow image digest is damaged');}
  }
  if(j.files.at(-1).path!=='docs/workflow/state.yaml')fail('State must be the final workflow target');
  for(const r of j.reads){if(!exact(r,['path','sha256'])||typeof r.path!=='string'||r.sha256!==null&&!/^[a-f0-9]{64}$/u.test(r.sha256))fail('Invalid read dependency');projectPath(root,r.path);}
  for(const path of j.created_dirs)if(typeof path!=='string'||!(path==='.ai-workflow/.local'||path.startsWith(workflowLocal)||j.journal_version===2&&j.request.action==='spec_sync'&&path.startsWith('docs/project/specs/')&&j.files.some(f=>f.before===null&&f.path.startsWith(path+'/')))||!projectPath(root,path))fail('Invalid workflow metadata directory');
  if(j.temporary!==null){const t=j.temporary;if(!exact(t,['path','target','data','sha256'])||!j.files.some(f=>f.path===t.target)||t.path!==t.target+'.tmp-'+j.operation_id||typeof t.data!=='string'||encode(decode(t.data))!==t.data||sha256(decode(t.data))!==t.sha256)fail('Invalid temporary workflow ownership');projectPath(root,t.path);}
  if(j.rollback_state!==null){if(!exact(j.rollback_state,['data','sha256'])||typeof j.rollback_state.data!=='string'||encode(decode(j.rollback_state.data))!==j.rollback_state.data||sha256(decode(j.rollback_state.data))!==j.rollback_state.sha256)fail('Invalid rollback state image');}
  return j;
}
export function readWorkflowLogs(root,{onError}={}){const dir=projectPath(root,workflowLocal),stat=fs.lstatSync(dir,{throwIfNoEntry:false});if(!stat)return [];if(!stat.isDirectory())fail('Workflow operation namespace is not a directory');return fs.readdirSync(dir).map(id=>{const path=uuid(id)?workflowLocal+'/'+id+'/journal.json':workflowLocal;try{if(!uuid(id))fail('Unknown workflow operation entry');const bytes=readProjectFile(root,path,workflowJournalLimit);if(bytes===null)fail('Workflow operation stopped before a valid journal');const data=validateWorkflowJournal(root,parseStrictJson(bytes.toString('utf8'),workflowJournalLimit));if(data.operation_id!==id)fail('Workflow operation directory differs');return {path,bytes,data};}catch(error){if(!onError)throw error;onError(error,path);return null;}}).filter(Boolean);}
export function assertNoPendingWorkflow(root){if(readWorkflowLogs(root).some(x=>!['committed','rolled_back'].includes(x.data.phase)))fail('An unfinished workflow operation requires explicit resume or undo');}
