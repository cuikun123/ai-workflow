import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {validateGuardRequest} from './guard-request.mjs';
import {canonicalJson,definitionDigest,parseStrictJson,validateWorkflowRecord} from './workflow-docs.mjs';
import {readProjectFile,projectPath} from './project-paths.mjs';
import {sha256} from './package.mjs';
import {inspectProjectContext,foundationMembers} from './foundation-context.mjs';
import {loadWorkflowView,inspectWorkflowView,positionFromState} from './workflow-status.mjs';
import {inspectConfirmations,inspectTaskPrerequisites,inspectCandidatePrerequisites,assertWorkflowPrerequisites} from './workflow-prerequisites.mjs';
import {readSpecInventory} from './spec-inventory.mjs';
import {guardRoot,guardAbsoluteFile,guardDirectory,guardIssue,inspectFileChanges,inspectTaskFileScope} from './operation-files.mjs';
import {observeGuardWorkspace,inspectWorkspacePolicy} from './operation-command.mjs';
import {iterationDefinition,protectedFile} from './operation-files.mjs';
import {validateStateYaml} from './state.mjs';

export function createOperationReader(root) {
  const reads=new Map(),stamps=new Map(),executables=new Set();
  const stamp=file=>{
    const absolute=path.isAbsolute(file)?projectPath(guardRoot(path.dirname(file)),path.basename(file)):projectPath(root,file),s=fs.lstatSync(absolute,{throwIfNoEntry:false,bigint:true});
    return s?{dev:s.dev,ino:s.ino,nlink:s.nlink,size:s.size,mtimeNs:s.mtimeNs,ctimeNs:s.ctimeNs}:null;
  };
  function remember(file,bytes) {
    const digest=bytes===null?null:sha256(bytes);
    if(reads.has(file)&&reads.get(file).sha256!==digest) guardIssue('GUARD_FACT_CHANGED','A read dependency changed during inspection',file);
    if(reads.size>=1000&&!reads.has(file)) guardIssue('GUARD_READ_LIMIT','Guard read set exceeds its supported limit',null,'unknown');
    const currentStamp=stamp(file);
    if(stamps.has(file)&&!isDeepStrictEqual(stamps.get(file),currentStamp)) guardIssue('GUARD_FACT_CHANGED','A file identity changed during inspection',file);
    stamps.set(file,currentStamp);reads.set(file,{kind:'file',path:file,sha256:digest});return bytes;
  }
  const read=file=>remember(file,readProjectFile(root,file,file.startsWith('.ai-workflow/.local/')?64*1024*1024:8*1024*1024));
  const readAbsolute=file=>{file=guardAbsoluteFile(file);executables.add(file);return sha256(remember(file,fs.readFileSync(file)));};
  const readExternal=file=>{const safe=projectPath(guardRoot(path.dirname(file)),path.basename(file)),stat=fs.lstatSync(safe,{throwIfNoEntry:false});
    if(stat&&(!stat.isFile()||stat.size>64*1024*1024))guardIssue('GIT_FILE_UNSUPPORTED','Git metadata must be bounded regular files',file,'unknown');
    return remember(safe,stat?fs.readFileSync(safe):null);};
  const verify=()=>{
    for(const item of reads.values()) {
      if(executables.has(item.path)){readAbsolute(item.path);continue;}
      const bytes=path.isAbsolute(item.path)?readExternal(item.path):readProjectFile(root,item.path,64*1024*1024);
      remember(item.path,bytes);
    }
  };
  return {read,readAbsolute,readExternal,verify,entries:()=>[...reads.values()].sort((a,b)=>a.path.localeCompare(b.path))};
}
export function expectedField(request,field,actual) {
  if(request.expected[field]===undefined) guardIssue('EXPECTED_FACT_MISSING','The request lacks its expected '+field,null,'unknown');
  if(request.expected[field]!==actual) guardIssue('EXPECTED_FACT_CHANGED','Actual '+field+' differs from the request');
}
export function taskGate(root,request,reads,observed,{mode='write'}={}) {
  const inventory=readSpecInventory(root),view=loadWorkflowView(root,{read:reads.read,inventory});
  observed.revision=view.state.revision;expectedField(request,'revision',view.state.revision);
  if(!request.task_ref||!view.state.current_task) guardIssue('TASK_REQUIRED','A current selected task is required for implementation');
  const task=view.getTask(view.state.current_iteration,view.state.current_task),taskRef={path:task.iteration+'/tasks.md',record_id:task.id};
  if(!isDeepStrictEqual(taskRef,request.task_ref)) guardIssue('TASK_SCOPE_MISMATCH','Request refers to another task');
  observed.task_ref=taskRef;observed.task_definition_sha256=definitionDigest(view.getDoc(taskRef.path));
  expectedField(request,'task_definition_sha256',observed.task_definition_sha256);
  const policy=task.data.guard_policy;
  if(!policy) guardIssue('TASK_GUARD_POLICY_MISSING','Task has no machine-checkable execution scope',taskRef.path,'unknown');
  const inspection=inspectWorkflowView(view);
  if(inspection.issues.length) guardIssue('WORKFLOW_PREREQUISITE_INVALID',inspection.issues.map(e=>e.message).join('; ').slice(0,16384));
  const context=inspectProjectContext(root,{read:reads.read});
  observed.framework_manifest_sha256=sha256(reads.read('.ai-workflow/manifest.json'));
  observed.context_snapshot_sha256=context.snapshot_sha256;expectedField(request,'context_snapshot_sha256',context.snapshot_sha256);
  const position=positionFromState(view.state,task),confirmation_refs=[...view.getDoc(task.iteration+'/verification.md').records.values()]
    .filter(r=>r.kind==='confirmation'&&(r.task===task.id||r.task===null)).map(r=>({path:task.iteration+'/verification.md',record_id:r.id}));
  assertWorkflowPrerequisites(inspectTaskPrerequisites(view,{task,position:{...position,phase:task.data.phase,confirmation_refs},context}));
  observed.git=observeGuardWorkspace(root,reads.readAbsolute);inspectWorkspacePolicy(root,policy,observed.git);
  const closeout=position.phase==='closeout'&&['ready','running'].includes(position.status);
  if(closeout) assertWorkflowPrerequisites(inspectCandidatePrerequisites(view,{task,position,requireAcceptance:true}));
  else if(mode==='git') {
    const normal=['build','execute','verify'].includes(position.phase)&&['ready','running'].includes(position.status);
    const saved=['paused','blocked'].includes(position.status)&&position.checkpoint_ref;
    const waiting=position.phase==='accept'&&position.status==='awaiting_user';
    if(!normal&&!saved&&!waiting)guardIssue('TASK_NOT_SAVABLE','Current task position does not permit Git operations');
    if(waiting)assertWorkflowPrerequisites(inspectCandidatePrerequisites(view,{task,position,requireAcceptance:false}));
  }
  else if(position.status!=='running'||!(['build','execute'].includes(position.phase)||position.phase==='verify'&&['build','execute'].includes(task.data.phase)))
    guardIssue('TASK_NOT_WRITABLE','Task must be running in implementation or authorized verification repair');
  return {view,task,position,policy,closeout,inventory,context};
}
