import * as fs from 'node:fs';import {randomUUID} from 'node:crypto';import {isDeepStrictEqual} from 'node:util';
import {projectPath,readProjectFile,ensureParent} from './project-paths.mjs';import {sha256} from './package.mjs';import {WorkflowError} from './errors.mjs';
import {assertSafeRoot} from './paths.mjs';
import {takeNewLock,releaseLock,durableWrite,equalBytes} from './project-writes.mjs';
import {workflowLocal,workflowJournalLimit,readWorkflowLogs,validateWorkflowJournal,encode,decode,uuid,exact} from './workflow-log.mjs';
import {checkInstallation,readInstallationManifest,prepareWorkflowProtection} from './installation.mjs';import {scanOperations} from './install-journal.mjs';
import {planWorkflowTransition,encodeWorkflowState,requireCurrentOperation} from './workflow-transitions.mjs';import {loadWorkflowView,inspectWorkflowState} from './workflow-status.mjs';import {validateStateYaml} from './state.mjs';import {canonicalJson} from './workflow-docs.mjs';import {parseManagedBlock,replaceManagedBlock,initialFoundationPaths} from './managed-blocks.mjs';
import {readSpecInventory,changeSpecInventory} from './spec-inventory.mjs';
import {bindingRecordId,assertTaskContextBinding} from './context-binding.mjs';
import {foundationMembers,makeFoundationInventory,inspectProjectContext} from './foundation-context.mjs';
import {inspectSpecifications} from './spec-deltas.mjs';import {verifyCommittedSpecReceipt} from './spec-sync.mjs';import {checkArtifact} from './workflow-artifacts.mjs';

const lockPath='.ai-workflow/.local/write.lock',statePath='docs/workflow/state.yaml';
const fail=(message,code='CONFLICT')=>{throw new WorkflowError(code,message);};
export function planWorkflowOperation(root,request,options={}){
  requireCurrentOperation(request);root=fs.realpathSync.native(assertSafeRoot(root));
  const plan=planWorkflowTransition(root,request,options),read=options.read||((path)=>readProjectFile(root,path));
  const protection=prepareWorkflowProtection(root,plan.afterState.basis.map(x=>x.path).filter(path=>/^docs\/.+\.([mM][dD]|yaml|json)$/u.test(path)),{read});
  plan.files.splice(plan.files.length-1,0,...protection.files);
  if(request.operation_version===3){
    readSpecInventory(root,{additionalPaths:plan.files.filter(f=>f.before===null).map(f=>f.path)});
    const encodedSize=bytes=>4*Math.ceil(bytes/3),images=plan.files.reduce((sum,f)=>sum+encodedSize(f.before?.length||0)+encodedSize(f.after.length),0);
    const metadata=Buffer.byteLength(JSON.stringify({root,request,reads:plan.reads,inventories:plan.inventories,foundation_inventory:plan.foundation_inventory,files:plan.files.map(f=>({path:f.path,kind:f.kind}))},null,2))+plan.files.length*512+4096;
    const longestPath=Math.max(128,...plan.files.map(f=>Buffer.byteLength(JSON.stringify(f.path))));
    const temporaryBytes=Math.max(...plan.files.map(f=>f.kind==='attributes'?8*1024*1024+Math.max(parseManagedBlock(f.before||Buffer.alloc(0),'attributes')?.bytes.length||0,parseManagedBlock(f.after,'attributes')?.bytes.length||0):Math.max(f.before?.length||0,f.after.length)));
    // Include future directories, a temporary image (also preserving external attributes prose), and rollback state.
    const reserve=1004*(longestPath+8)+encodedSize(temporaryBytes)+2*longestPath+512+encodedSize(1024*1024)+256;
    if(images+metadata+reserve>workflowJournalLimit)fail('Workflow operation exceeds the recoverable log budget');
  }
  return plan;
}
const combinedPlan=planWorkflowOperation;
const fileStamp=(root,path)=>{const s=fs.lstatSync(projectPath(root,path),{throwIfNoEntry:false,bigint:true});return s?{dev:s.dev,ino:s.ino,size:s.size,mtimeNs:s.mtimeNs,ctimeNs:s.ctimeNs}:null;};
function syncResult(j){if(j.request.action==='context_bind')return {binding_ref:{path:j.request.data.iteration+'/verification.md',record_id:bindingRecordId(j.request.request_id)},snapshot_sha256:j.request.data.expected_snapshot,semantic_completeness_verified:false};return j.journal_version>=2&&j.request.action==='spec_sync'?{sync_ref:{path:j.request.data.iteration+'/verification.md',record_id:'spec-sync-'+j.operation_id}}:{};}
function verifyInventory(root,j){
  if(j.journal_version===3){
    if(!isDeepStrictEqual(makeFoundationInventory(foundationMembers(root)),j.foundation_inventory))fail('Foundation inventory changed; current files are preserved');
    const writes=new Set(j.files.map(f=>f.path)),stamps=[];for(const r of j.reads)if(!writes.has(r.path)){stamps.push({path:r.path,stamp:fileStamp(root,r.path)});const bytes=readProjectFile(root,r.path);if((bytes===null?null:sha256(bytes))!==r.sha256)fail('Workflow context/read dependency changed; preserved: '+r.path);}
    if(!isDeepStrictEqual(makeFoundationInventory(foundationMembers(root)),j.foundation_inventory)||stamps.some(e=>!isDeepStrictEqual(e.stamp,fileStamp(root,e.path))))fail('Workflow context changed during dependency verification');
  }
  if(j.journal_version<2)return;
  for(const file of j.files.filter(f=>f.before===null&&f.path.startsWith('docs/project/specs/'))){const exists=readProjectFile(root,file.path)!==null;if(j.intent==='apply'&&file.status==='applied'&&!exists||j.intent==='undo'&&file.status==='undone'&&exists)fail('New specification membership changed after a recorded write; preserved: '+file.path);}
  const current=changeSpecInventory(readSpecInventory(root),j.files.filter(f=>f.before===null).map(f=>({path:f.path,exists:false})));if(!isDeepStrictEqual(current,j.inventories))fail('Specification inventory changed; recovery preserved the current files');
}
function verifyRepeatedSync(root,j){
  if(j.journal_version<2||j.request.action!=='spec_sync')return;
  const view=loadWorkflowView(root),task=view.getTask(j.request.data.iteration,j.request.data.task),receipt=view.getRef(syncResult(j).sync_ref,'spec_sync');verifyCommittedSpecReceipt(root,receipt);
  if(task.data.progress?.status==='completed')return;
  const checked=inspectSpecifications(root,{read:view.readFile,taskRef:{path:task.iteration+'/tasks.md',record_id:task.id}});if(!checked.valid)fail('Unfinished synchronization changed: '+checked.issues.map(x=>x.code).join(', '));
  for(const ref of [receipt.data.acceptance_ref,...receipt.data.check_refs,...receipt.data.review_refs]){const record=view.getRef(ref);for(const artifact of [...record.data.artifacts,...(record.data.evidence||[])])if(!checkArtifact(root,artifact,{read:view.readFile}).valid)fail('Unfinished synchronization candidate or evidence changed');}
}
function image(root,entry){const current=readProjectFile(root,entry.path),before=decode(entry.before),after=decode(entry.after);if(entry.kind==='attributes'){const block=parseManagedBlock(current||Buffer.alloc(0),'attributes')?.bytes||null;if(equalBytes(block,parseManagedBlock(after,'attributes')?.bytes||null))return 'after';if(equalBytes(block,parseManagedBlock(before||Buffer.alloc(0),'attributes')?.bytes||null))return 'before';}else{if(equalBytes(current,after))return 'after';if(equalBytes(current,before))return 'before';}fail('Workflow target changed; preserved: '+entry.path);}
function verifyOriginalPlan(root,j){
  const beforeMap=new Map(j.files.map(f=>[f.path,decode(f.before)]));
  const read=path=>beforeMap.has(path)?beforeMap.get(path):readProjectFile(root,path);
  for(const r of j.reads){const bytes=read(r.path);if((bytes===null?null:sha256(bytes))!==r.sha256)fail('Read dependency changed; cannot replay workflow');}
  verifyInventory(root,j);
  const plan=combinedPlan(root,j.request,{operationId:j.operation_id,now:j.created_at,read,inventory:j.inventories,allowPendingWorkflow:true});
  if(j.journal_version===3&&(!isDeepStrictEqual(plan.reads,j.reads)||!isDeepStrictEqual(plan.foundation_inventory,j.foundation_inventory)))fail('Workflow recovery read dependencies differ from the original semantic operation');
  if(j.journal_version>=2&&!isDeepStrictEqual(plan.inventories,j.inventories))fail('Workflow recovery read inventory differs');
  if(plan.files.length!==j.files.length)fail('Workflow recovery inventory differs');
  for(let i=0;i<plan.files.length;i++){const expected=plan.files[i],actual=j.files[i];if(expected.path!==actual.path||expected.kind!==actual.kind||!equalBytes(expected.before,decode(actual.before))||!equalBytes(expected.after,decode(actual.after)))fail('Workflow journal payload differs from its semantic operation');}
  return plan;
}
function cleanTemporary(root,j,io){if(!j.temporary)return;const bytes=readProjectFile(root,j.temporary.path,8*1024*1024),expected=decode(j.temporary.data);if(bytes!==null){if(bytes.length>expected.length||!bytes.equals(expected.subarray(0,bytes.length)))fail('Unknown temporary content was preserved');io.unlinkSync(projectPath(root,j.temporary.path));}j.temporary=null;}
function restoredBasis(root,j,original){const before=new Map(j.files.map(f=>[f.path,decode(f.before)]));return original.basis.map(entry=>{const bytes=before.has(entry.path)?before.get(entry.path):readProjectFile(root,entry.path);if(bytes===null){if(j.journal_version===3&&entry.path.startsWith('docs/project/foundation/')&&!initialFoundationPaths.includes(entry.path))return entry;fail('Rollback basis is missing');}return {path:entry.path,sha256:sha256(bytes)};});}
function validateRollback(root,j,state,stateBytes){if(!j.rollback_state)return;const original=validateStateYaml(decode(j.files.at(-1).before).toString()),rollback=validateStateYaml(decode(j.rollback_state.data).toString());const expected={...original,basis:restoredBasis(root,j,original),revision:rollback.revision,updated_at:rollback.updated_at};if(!isDeepStrictEqual(rollback,expected)||rollback.revision<=original.revision||!equalBytes(stateBytes,decode(j.rollback_state.data))&&rollback.revision!==state.revision+1)fail('Rollback state differs from the original workflow position');}
function saveContext(root,j,path,before,io){let saved=before;return ()=>{validateWorkflowJournal(root,j);const bytes=Buffer.from(JSON.stringify(j,null,2)+'\n');if(bytes.length>workflowJournalLimit)fail('Workflow journal exceeds its read limit');durableWrite(root,path,bytes,saved,io,j.created_dirs);saved=bytes;};}
function writeEntry(root,j,entry,bytes,io,save){const current=readProjectFile(root,entry.path);j.temporary={path:entry.path+'.tmp-'+j.operation_id,target:entry.path,data:encode(bytes),sha256:sha256(bytes)};save();durableWrite(root,entry.path,bytes,current,io,j.created_dirs,j.temporary.path);j.temporary=null;}
function validateReadback(root,j){verifyInventory(root,j);const result=inspectWorkflowState(root);if(!result.valid&&(!result.issues.length||result.issues.some(x=>x.code!=='STALE_PLAN_CONFIRMATION')))fail('Workflow state readback did not match its documents','INCOMPLETE');checkInstallation(root,{allowPendingWorkflow:true});const stamps=j.files.map(f=>({path:f.path,stamp:fileStamp(root,f.path)}));for(const f of j.files)if(image(root,f)!=='after')fail('Workflow target was not fully applied','INCOMPLETE');verifyInventory(root,j);if(stamps.some(e=>!isDeepStrictEqual(e.stamp,fileStamp(root,e.path))))fail('Workflow target changed during final readback','INCOMPLETE');}

export function applyWorkflowTransition(projectRoot,request,{io=fs}={}){
  requireCurrentOperation(request);
  const root=fs.realpathSync.native(projectRoot),logs=readWorkflowLogs(root),previous=logs.find(x=>x.data.request.request_id===request.request_id);
  if(previous){if(canonicalJson(previous.data.request)!==canonicalJson(request))fail('Request ID was reused with different content');if(previous.data.phase!=='committed')fail('This request has an unfinished or undone operation: '+previous.data.operation_id,'INCOMPLETE');
    if(request.action==='context_bind'){const view=loadWorkflowView(root);if(view.state.current_iteration===request.data.iteration&&view.state.current_task===request.data.task&&view.state.status!=='completed')assertTaskContextBinding(root,view.getTask(request.data.iteration,request.data.task),{context:inspectProjectContext(root),read:view.readFile,operationId:previous.data.operation_id});}
    verifyRepeatedSync(root,previous.data);return {action:'already_applied',operation_id:previous.data.operation_id,...syncResult(previous.data),revision:validateStateYaml(readProjectFile(root,statePath).toString()).revision,applied_revision:validateStateYaml(decode(previous.data.files.at(-1).after).toString()).revision,acceptance_verified:false};}
  checkInstallation(root,{allowFoundationMembershipChanges:true});const operationId=randomUUID(),created=[],lock=takeNewLock(root,operationId,io,created),path=workflowLocal+'/'+operationId+'/journal.json';
  let j,save,plan,verifiedCommit=false;
  try{
    if(readWorkflowLogs(root).some(x=>!['committed','rolled_back'].includes(x.data.phase))||scanOperations(root).some(x=>!['committed','rolled_back'].includes(x.data.phase)))fail('An unfinished operation requires recovery','INCOMPLETE');
    checkInstallation(root,{allowPendingWorkflow:true,allowFoundationMembershipChanges:true});plan=combinedPlan(root,request,{operationId,allowPendingWorkflow:true});
    for(const f of plan.files)if(!equalBytes(readProjectFile(root,f.path),f.before))fail('Workflow target changed before preparation');
    for(const r of plan.reads){const bytes=readProjectFile(root,r.path);if((bytes===null?null:sha256(bytes))!==r.sha256)fail('Workflow read dependency changed before preparation');}
    if(plan.inventories&&!isDeepStrictEqual(readSpecInventory(root),plan.inventories))fail('Specification inventory changed before preparation');
    ensureParent(root,path,io,created);
    j={journal_version:request.operation_version,kind:'workflow-state',operation_id:operationId,project_root:root,nonce:lock.owner.nonce,package:readInstallationManifest(root).package,request,created_at:plan.createdAt,phase:'prepared',intent:'apply',created_dirs:created,files:plan.files.map(f=>({path:f.path,kind:f.kind,before:encode(f.before),before_sha256:f.before===null?null:sha256(f.before),after:encode(f.after),after_sha256:sha256(f.after),status:'pending'})),reads:plan.reads,...(plan.inventories?{inventories:plan.inventories}:{}),foundation_inventory:plan.foundation_inventory,temporary:null,rollback_state:null};
    save=saveContext(root,j,path,null,io);save();verifyOriginalPlan(root,j);j.phase='applying';save();
    for(const f of j.files){verifyInventory(root,j);if(image(root,f)!=='before')fail('Target changed before applying workflow');let bytes=decode(f.after);if(f.kind==='attributes')bytes=replaceManagedBlock(readProjectFile(root,f.path),'attributes',parseManagedBlock(decode(f.before),'attributes').bytes,parseManagedBlock(bytes,'attributes').bytes);writeEntry(root,j,f,bytes,io,save);f.status='applied';save();}
    validateReadback(root,j);j.phase='committed';save();validateReadback(root,j);verifiedCommit=true;releaseLock(root,lock.bytes,io);return {action:'applied',revision:plan.afterState.revision,operation_id:operationId,...syncResult(j),acceptance_verified:false,source_authenticity_verified:false};
  }catch(e){if(j&&save&&!verifiedCommit){j.phase='blocked';try{save();}catch{}}try{releaseLock(root,lock.bytes,io);}catch{}throw e;}
}

export function recoverWorkflowTransition(projectRoot,mode,expectedRevision,{io=fs,preview=false,operationId}={}){
  if(!['resume','undo'].includes(mode)||!Number.isSafeInteger(expectedRevision))fail('Invalid workflow recovery mode/revision');
  const root=fs.realpathSync.native(projectRoot),logs=readWorkflowLogs(root),pending=logs.filter(x=>!['committed','rolled_back'].includes(x.data.phase)),lockBytes=readProjectFile(root,lockPath);
  if(pending.length===0&&mode==='resume'&&lockBytes){let owner;try{owner=JSON.parse(lockBytes);}catch{fail('Unknown workflow lock','INCOMPLETE');}const committed=logs.find(x=>x.data.phase==='committed'&&x.data.operation_id===owner.operation_id);if(committed)pending.push(committed);}
  if(pending.length!==1||scanOperations(root).some(x=>!['committed','rolled_back'].includes(x.data.phase)))fail('No unique recoverable workflow operation','INCOMPLETE');
  const operation=pending[0],j=operation.data;if(j.journal_version!==3)fail('Legacy workflow operations require their matching tool for recovery','INCOMPLETE');const stateBytes=readProjectFile(root,statePath),state=validateStateYaml(stateBytes.toString());if(operationId&&operationId!==j.operation_id)fail('Requested workflow operation differs');if(state.revision!==expectedRevision)fail('Recovery revision changed');
  if(j.intent==='undo'&&mode!=='undo')fail('Partial undo must continue with undo','INCOMPLETE');
  if(lockBytes){let owner;try{owner=JSON.parse(lockBytes);}catch{fail('Unknown workflow lock','INCOMPLETE');}if(!exact(owner,['lock_version','operation_id','nonce','pid','project_root','created_at'])||owner.lock_version!==1||owner.operation_id!==j.operation_id||owner.nonce!==j.nonce||owner.project_root!==root||!Number.isSafeInteger(owner.pid)||owner.pid<1)fail('Workflow lock ownership differs','INCOMPLETE');try{process.kill(owner.pid,0);fail('Workflow writer is still alive','INCOMPLETE');}catch(e){if(e.code!=='ESRCH')fail('Writer termination cannot be verified','INCOMPLETE');}}
  if(!isDeepStrictEqual(j.package,readInstallationManifest(root).package))fail('Recovery package differs');
  verifyOriginalPlan(root,j);validateRollback(root,j,state,stateBytes);for(const f of j.files){if(f.path===statePath&&j.rollback_state&&equalBytes(stateBytes,decode(j.rollback_state.data)))continue;image(root,f);}
  if(j.temporary){const actual=readProjectFile(root,j.temporary.path),expected=decode(j.temporary.data);if(actual!==null&&(actual.length>expected.length||!actual.equals(expected.subarray(0,actual.length))))fail('Unknown temporary content was preserved');}
  if(mode==='undo'&&j.files.slice(0,-1).some(f=>f.before===null&&!(j.journal_version>=2&&j.request.action==='spec_sync'&&f.path.startsWith('docs/project/specs/'))))fail('Workflow undo cannot infer deletion ownership');
  if(preview){if(j.phase==='committed')validateReadback(root,j);return {action:'preview',kind:'workflow',operation_id:j.operation_id,mode,revision:state.revision,targets:j.files.map(f=>({path:f.path,kind:f.kind,action:j.phase==='committed'?'verify':mode==='undo'?'restore':'resume'})),lock_action:lockBytes?'release_verified_owner':'none',acceptance_verified:false};}
  if(j.phase==='committed'){validateReadback(root,j);if(!lockBytes)fail('Committed lock is missing','INCOMPLETE');releaseLock(root,lockBytes,io);return {action:'lock_released',revision:state.revision,acceptance_verified:false,source_authenticity_verified:false};}
  if(lockBytes)releaseLock(root,lockBytes,io);const lock=takeNewLock(root,j.operation_id,io,j.created_dirs,j.nonce);const save=saveContext(root,j,operation.path,operation.bytes,io);
  try{
    cleanTemporary(root,j,io);j.intent=mode==='undo'?'undo':'apply';j.phase='applying';save();
    if(mode==='resume'){
      for(const f of j.files){verifyInventory(root,j);if(image(root,f)==='before'){let bytes=decode(f.after);if(f.kind==='attributes')bytes=replaceManagedBlock(readProjectFile(root,f.path),'attributes',parseManagedBlock(decode(f.before),'attributes').bytes,parseManagedBlock(bytes,'attributes').bytes);writeEntry(root,j,f,bytes,io,save);}f.status='applied';save();}
      validateReadback(root,j);j.phase='committed';save();validateReadback(root,j);releaseLock(root,lock.bytes,io);return {action:'resumed',operation_id:j.operation_id,...syncResult(j),revision:validateStateYaml(readProjectFile(root,statePath).toString()).revision,acceptance_verified:false};
    }
    const stateEntry=j.files.at(-1),original=validateStateYaml(decode(stateEntry.before).toString());
    if(j.rollback_state===null){if(state.revision===Number.MAX_SAFE_INTEGER)fail('Cannot increment rollback revision');const next={...original,basis:restoredBasis(root,j,original),revision:state.revision+1,updated_at:new Date().toISOString()};const bytes=encodeWorkflowState(stateBytes.toString(),next);j.rollback_state={data:encode(bytes),sha256:sha256(bytes)};save();}
    for(const f of [...j.files.slice(0,-1)].reverse()){
      verifyInventory(root,j);
      if(image(root,f)==='after'){const before=decode(f.before);if(before===null){if(j.journal_version<2||j.request.action!=='spec_sync'||!f.path.startsWith('docs/project/specs/'))fail('Workflow undo cannot infer deletion ownership');io.unlinkSync(projectPath(root,f.path));}else{let bytes=before;if(f.kind==='attributes'){const current=readProjectFile(root,f.path);bytes=equalBytes(current,decode(f.after))?before:replaceManagedBlock(current,'attributes',parseManagedBlock(decode(f.after),'attributes').bytes,parseManagedBlock(before,'attributes').bytes);}writeEntry(root,j,f,bytes,io,save);}}f.status='undone';save();
    }
    const rollback=decode(j.rollback_state.data);if(!equalBytes(readProjectFile(root,statePath),rollback))writeEntry(root,j,stateEntry,rollback,io,save);stateEntry.status='undone';j.temporary=null;
    const result=inspectWorkflowState(root);if(result.issues.some(x=>!['STALE_BASIS','STALE_PLAN_CONFIRMATION','STALE_FOUNDATION','FOUNDATION_MEMBERSHIP_CHANGED'].includes(x.code)))fail('Restored workflow position cannot be verified','INCOMPLETE');
    j.phase='rolled_back';save();verifyInventory(root,j);releaseLock(root,lock.bytes,io);checkInstallation(root,{allowFoundationMembershipChanges:true});return {action:'undone',revision:validateStateYaml(rollback.toString()).revision,acceptance_verified:false};
  }catch(e){j.phase='blocked';try{save();}catch{}try{releaseLock(root,lock.bytes,io);}catch{}throw e;}
}
