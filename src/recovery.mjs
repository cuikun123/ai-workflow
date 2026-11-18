import * as fs from 'node:fs';import {WorkflowError} from './errors.mjs';import {readProjectFile} from './project-paths.mjs';import {assertSafeRoot} from './paths.mjs';
import {diagnoseProject,inspectWriteLock} from './diagnostics.mjs';import {scanOperations} from './install-journal.mjs';import {readWorkflowLogs,uuid} from './workflow-log.mjs';import {planInstallation,initializeProject} from './installation.mjs';import {applyWorkflowTransition,recoverWorkflowTransition,planWorkflowOperation} from './workflow-journal.mjs';
import {readVersionLogs,assertNoPendingVersions} from './version-log.mjs';import {recoverVersionChange} from './version-journal.mjs';
import {loadWorkflowView} from './workflow-status.mjs';
const fail=(message,code='CONFLICT')=>{throw new WorkflowError(code,message);};
export function recoverProject(projectRoot,{mode,packageRoot,operationId,expectedRevision,requestId,preview=false,io=fs}={}){
  const root=fs.realpathSync.native(assertSafeRoot(projectRoot));if(!['repair','resume','undo','refresh'].includes(mode)||typeof preview!=='boolean')fail('Unknown recovery operation');
  const versionLogs=readVersionLogs(root);if(operationId&&versionLogs.some(x=>x.data.operation_id===operationId)){if(!['resume','undo'].includes(mode)||requestId!==undefined)fail('Version recovery requires resume/undo and an explicit fixed source');return recoverVersionChange(root,{mode,operationId,packageRoot,expectedRevision,preview,io});}
  if(operationId&&versionLogs.some(x=>x.data.projections.some(p=>p.path.endsWith('/'+operationId+'/journal.json'))))fail('Migrated request receipts cannot be resumed or undone');
  assertNoPendingVersions(root);
  let operation;
  if(mode==='repair'){
    if(!packageRoot||operationId!==undefined||expectedRevision!==undefined||requestId!==undefined)fail('Repair requires only an identical source package');
    const plan=planInstallation({packageRoot,projectRoot:root,mode:'repair'});
    if(preview)return {action:'preview',kind:'repair',targets:plan.files.map(f=>({path:f.path,kind:f.kind,action:'repair'})),acceptance_verified:false};
    operation=initializeProject({packageRoot,projectRoot:root,mode:'repair',io});
  }else if(mode==='refresh'){
    if(operationId!==undefined||packageRoot!==undefined||!Number.isSafeInteger(expectedRevision)||typeof requestId!=='string')fail('Refresh requires an exact revision and stable request ID');
    const view=loadWorkflowView(root),task=view.state.current_task?view.getTask(view.state.current_iteration,view.state.current_task):null;
    const request={operation_version:3,request_id:requestId,expected_revision:expectedRevision,action:'refresh',data:{}};
    if(preview){const inspection=diagnoseProject(root);if(inspection.findings.some(f=>['operation','resource','installation','version'].includes(f.category)&&f.severity==='error'))fail('Pending or invalid framework inputs prevent refresh');const plan=planWorkflowOperation(root,request);return {action:'preview',kind:'refresh',revision:plan.beforeState.revision,targets:plan.files.map(f=>({path:f.path,kind:f.kind,action:'refresh'})),acceptance_verified:false};}
    operation=applyWorkflowTransition(root,request,{io});
  }else{
    if(!uuid(operationId)||requestId!==undefined)fail('Resume/undo requires an explicit operation ID');
    const installations=scanOperations(root).map(x=>({...x,kind:'installation'})),workflows=readWorkflowLogs(root).map(x=>({...x,kind:'workflow'})),all=[...installations,...workflows],selected=all.filter(x=>x.data.operation_id===operationId);
    if(selected.length!==1)fail('No unique requested recovery operation','INCOMPLETE');const entry=selected[0],pending=all.filter(x=>!['committed','rolled_back'].includes(x.data.phase));
    if(pending.length>1||pending.length===1&&pending[0].data.operation_id!==operationId)fail('Another incomplete operation prevents recovery','INCOMPLETE');
    const lock=inspectWriteLock(root);if(lock.status!=='absent'&&(lock.status!=='stale'||lock.operation_id!==operationId||lock.nonce!==entry.data.nonce))fail('Lock ownership or termination cannot be verified','INCOMPLETE');
    if(entry.data.phase==='rolled_back'||entry.data.phase==='committed'&&(mode!=='resume'||lock.status==='absent'))fail('Requested operation is already finalized','INCOMPLETE');
    if(entry.kind==='installation'){if(!packageRoot||expectedRevision!==undefined)fail('Installation recovery needs an identical source, without a state revision');operation=initializeProject({packageRoot,projectRoot:root,mode,operationId,preview,io});}
    else{if(!Number.isSafeInteger(expectedRevision)||packageRoot!==undefined)fail('Workflow recovery requires an exact revision and the project-local runtime');operation=recoverWorkflowTransition(root,mode,expectedRevision,{operationId,preview,io});}
    if(preview)return operation;
  }
  return {operation,diagnostics:diagnoseProject(root),acceptance_verified:false,source_authenticity_verified:false};
}
