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
import {observeGuardWorkspace,inspectWorkspacePolicy,inspectCommand} from './operation-command.mjs';
import {iterationDefinition,protectedFile} from './operation-files.mjs';
import {validateStateYaml} from './state.mjs';
import {planWorkflowOperation} from './workflow-journal.mjs';

import {createOperationReader,expectedField,taskGate} from './operation-context.mjs';
import {inspectGitOperation} from './operation-git.mjs';
function observeState(root,request,reads,observed,{optional=false}={}) {
  const bytes=reads.read('docs/workflow/state.yaml');
  if(bytes===null) {
    if(!optional||request.expected.revision!==undefined) guardIssue('STATE_OBSERVATION_MISSING','Current revision is unavailable',null,'unknown');
    return null;
  }
  let state;
  try{state=validateStateYaml(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{guardIssue('STATE_OBSERVATION_INVALID','Current revision cannot be read',null,'unknown');}
  observed.revision=state.revision;
  if(!optional||request.expected.revision!==undefined) expectedField(request,'revision',state.revision);
  return state;
}
async function hostObservation(root,request,observer) {
  if(typeof observer!=='function') guardIssue('HOST_REQUEST_OBSERVATION_MISSING','A controlled host request observation is required',null,'unknown');
  let value;
  try{value=await observer({projectRoot:root,request:structuredClone(request)});}
  catch{guardIssue('HOST_REQUEST_OBSERVATION_FAILED','Host request observation failed',null,'unknown');}
  if(value?.status!=='observed') guardIssue('HOST_REQUEST_OBSERVATION_MISSING','Host did not observe a current explicit request',null,'unknown');
  if(typeof value.source_reference!=='string'||!value.source_reference.trim()||typeof value.projectRoot!=='string'||
    guardRoot(value.projectRoot)!==root||!Array.isArray(value.files)||value.files.length!==request.operation.changes.length)
    guardIssue('HOST_REQUEST_SCOPE_MISMATCH','Host observation does not identify this exact project and file request');
  const actual=request.operation.changes.map(({path,before_sha256})=>({path,before_sha256})).sort((a,b)=>a.path.localeCompare(b.path));
  const supplied=value.files.map(f=>({path:f.path,before_sha256:f.before_sha256})).sort((a,b)=>String(a.path).localeCompare(String(b.path)));
  if(!isDeepStrictEqual(actual,supplied)) guardIssue('HOST_REQUEST_SCOPE_MISMATCH','Host observation names different paths or before images');
  return value;
}
function validatePreparedInput(text) {
  let input;
  try {
    input=parseStrictJson(text);
    validateGuardRequest({schema_version:1,task_ref:null,expected:{},authorization_refs:[],operation:{kind:'workflow.apply',request:input,input_sha256:sha256(Buffer.from(text))}});
    const shapes={record:[['record'],[]],prepare:[['iteration','task','confirmations'],['phase','selection_ref']],select:[['iteration','task','confirmations'],['phase','selection_ref']],
      start:[[],[]],verify:[[],['authorization_ref']],await:[['waiting_for'],['check_refs','review_refs']],confirm:[['confirmation_refs'],['next_phase']],
      closeout:[[],[]],spec_sync:[['iteration','task'],[]],complete:[['closeout_ref'],[]],pause:[['confirmation_ref','reason'],[]],
      block:[['blocker_refs','reason'],[]],resume:[[],['resolution_ref','verification_authorization_ref']],refresh:[[],[]],
      context_bind:[['iteration','task','expected_snapshot','impact','reason'],[]],task_revise:[['iteration','task','expected_definition_sha256','reason','declaration'],[]]};
    const [required,optional]=shapes[input.action];
    if(required.some(k=>!Object.hasOwn(input.data,k))||Object.keys(input.data).some(k=>![...required,...optional].includes(k))) throw Error('Unsupported semantic arguments');
    if(input.action==='record') {
      const r=input.data.record;
      if(!['task','confirmation','check','review','blocker','resolution','closeout','spec_delta'].includes(r?.kind)||r.data?.progress!==undefined) throw Error('Unsupported record preparation');
      validateWorkflowRecord(r,r.iteration+'/'+(r.kind==='task'?'tasks':r.kind==='spec_delta'?'scope':'verification')+'.md');
    }
  } catch {guardIssue('INVALID_WORKFLOW_INPUT','Prepared JSON must be a supported semantic operation object');}
  return input;
}
async function inspectHostFiles(root,request,entries,reads,observed,options) {
  if(request.expected.context_snapshot_sha256!==undefined||request.expected.task_definition_sha256!==undefined)
    guardIssue('UNEXPECTED_TASK_EXPECTATION','A task-free request cannot supply unchecked task-specific expectations',null,'unknown');
  const state=observeState(root,request,reads,observed,{optional:!options.preparationRequestObserver});
  if(options.preparationRequestObserver) {
    const observation=await hostObservation(root,request,options.preparationRequestObserver);
    if(observation.iteration!==state?.current_iteration) guardIssue('PREPARATION_ITERATION_MISMATCH','Preparation must name the actual current iteration');
    if(observation.purpose==='planning') {
      if(state.current_task!==null) guardIssue('PLANNING_TASK_SELECTED','Selected task definitions must use their revision workflow');
      for(const {change} of entries) if(!['scope','design','tasks','verification'].some(n=>change.path===observation.iteration+'/'+n+'.md')||change.after?.encoding!=='utf8')
        guardIssue('PLANNING_FILE_OUTSIDE_SCOPE','Planning permits current iteration prose only',change.path);
    } else if(observation.purpose==='workflow_input') {
      if(entries.length!==1||!/^\.ai-workflow\/\.local\/inputs\/[^/]+\.json$/u.test(entries[0].change.path)||entries[0].change.after?.encoding!=='utf8')
        guardIssue('WORKFLOW_INPUT_SCOPE','Input preparation permits one local JSON input file only');
      validatePreparedInput(entries[0].change.after.text);
    } else guardIssue('PREPARATION_PURPOSE_UNSUPPORTED','Host preparation purpose is not supported',null,'unknown');
  } else {
    await hostObservation(root,request,options.independentRequestObserver);
    for(const {change} of entries) {
      if(protectedFile(change.path)||iterationDefinition(change.path)||change.path.startsWith('docs/iterations/')||
        change.path.startsWith('docs/project/')||!(change.path==='README.md'||change.path==='CHANGELOG.md'||change.path.startsWith('docs/'))||!change.path.endsWith('.md'))
        guardIssue('INDEPENDENT_PROSE_SCOPE','Independent requests permit ordinary nonbusiness prose only',change.path);
    }
  }
}
function inspectQuery(root,operation,read) {
  const specs={status:{flags:['--json'],values:[]},check:{flags:['--json','--documents'],values:[]},doctor:{flags:['--json'],values:[]},
    'context.inspect':{flags:['--json'],values:[]},'context.guard':{flags:['--json'],values:['--expected-snapshot']},
    validate:{flags:['--json'],values:['--state']},'artifacts.inspect':{flags:['--json'],values:['--path','--kind']},
    'spec.check':{flags:['--json'],values:['--iteration','--task']}};
  const shape=specs[operation.command];if(!shape) guardIssue('QUERY_UNSUPPORTED','This query interface is not implemented',null,'unknown');
  const seen=new Set(),values=new Map();
  for(let i=0;i<operation.argv.length;i++) {
    const key=operation.argv[i];
    if(![...shape.flags,...shape.values].includes(key)||seen.has(key)&&key!=='--path') guardIssue('QUERY_ARGUMENT_UNSUPPORTED','Query arguments are not a recognized read-only shape',null,'unknown');
    seen.add(key);if(shape.flags.includes(key)) continue;
    const value=operation.argv[++i];if(typeof value!=='string'||!value||value.startsWith('--')) guardIssue('QUERY_ARGUMENT_UNSUPPORTED','Query option lacks its literal value',null,'unknown');
    values.set(key,value);
    if(['--path','--state'].includes(key)) {projectPath(root,value);read(value);}
    if(key==='--iteration') {
      if(!/^docs\/iterations\/[^/]+$/u.test(value)) guardIssue('QUERY_PATH_UNSAFE','Query iteration path is unsafe');
      guardDirectory(root,value);
    }
    if(key==='--task'&&!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(value)) guardIssue('QUERY_ARGUMENT_UNSUPPORTED','Query task identifier is unsupported',null,'unknown');
  }
  if(operation.command==='context.guard'&&!/^[a-f0-9]{64}$/u.test(values.get('--expected-snapshot')||'')||
    operation.command==='validate'&&!seen.has('--state')||operation.command==='artifacts.inspect'&&!seen.has('--path')||
    seen.has('--kind')&&!['file','definition'].includes(values.get('--kind'))||seen.has('--iteration')!==seen.has('--task'))
    guardIssue('QUERY_ARGUMENT_UNSUPPORTED','Required query options are missing or unsupported',null,'unknown');
}
function inspectSemantic(root,request,reads,observed) {
  const state=observeState(root,request,reads,observed),context=inspectProjectContext(root,{read:reads.read});
  observed.context_snapshot_sha256=context.snapshot_sha256;observed.framework_manifest_sha256=sha256(reads.read('.ai-workflow/manifest.json'));
  if(request.task_ref) {
    if(request.task_ref.path!==state.current_iteration+'/tasks.md'||request.task_ref.record_id!==state.current_task) guardIssue('TASK_SCOPE_MISMATCH','Semantic request names another selected task');
    const view=loadWorkflowView(root,{read:reads.read});observed.task_ref=request.task_ref;
    observed.task_definition_sha256=definitionDigest(view.getDoc(request.task_ref.path));
    expectedField(request,'context_snapshot_sha256',context.snapshot_sha256);expectedField(request,'task_definition_sha256',observed.task_definition_sha256);
  } else {
    if(request.expected.context_snapshot_sha256!==undefined) expectedField(request,'context_snapshot_sha256',context.snapshot_sha256);
    if(request.expected.task_definition_sha256!==undefined) guardIssue('UNEXPECTED_TASK_EXPECTATION','A task-free semantic operation cannot supply an unchecked task definition expectation',null,'unknown');
  }
  const semantic=request.operation.request;
  if(semantic.action==='verify'&&['accept','closeout'].includes(state.phase)||semantic.action==='resume'&&semantic.data.verification_authorization_ref!==undefined) {
    const view=loadWorkflowView(root,{read:reads.read});
    if(!state.current_task||!request.authorization_refs.length) guardIssue('TASK_REPAIR_AUTHORIZATION_REQUIRED','Returning from acceptance or closeout requires explicit feedback repair authorization');
    const selectedRef=semantic.data.authorization_ref||semantic.data.verification_authorization_ref;
    if(selectedRef&&!request.authorization_refs.some(ref=>isDeepStrictEqual(ref,selectedRef))) guardIssue('TASK_REPAIR_AUTHORIZATION_MISMATCH','Semantic feedback reference is not among this operation authorization references');
    const task=view.getTask(state.current_iteration,state.current_task),taskPath=task.iteration+'/tasks.md';
    const {record}=assertWorkflowPrerequisites(inspectConfirmations(view,{purpose:'operation_authorization',refs:request.authorization_refs}));
    const scope=record.data.operation_scope;
    if(!scope) guardIssue('TASK_REPAIR_SCOPE_MISSING','Feedback authorization has no machine-checkable operation scope',null,'unknown');
    if(!scope.actions.includes('task.repair')||record.task!==task.id||!record.data.artifacts.some(a=>a.kind==='definition'&&a.path===taskPath))
      guardIssue('TASK_REPAIR_AUTHORIZATION_MISMATCH','Feedback authorization must cover repair of this exact task definition');
    if(!task.data.guard_policy) guardIssue('TASK_GUARD_POLICY_MISSING','Repair requires a confirmed task execution scope',taskPath,'unknown');
    observed.git=observeGuardWorkspace(root,reads.readAbsolute);inspectWorkspacePolicy(root,task.data.guard_policy,observed.git);
    if(scope.binding==='candidate'&&scope.candidate_commit!==observed.git.head_commit||scope.git&&
      (guardRoot(scope.git.worktree_root)!==root||guardRoot(scope.git.git_common_dir)!==guardRoot(observed.git.git_common_dir)||scope.git.source_branch!==observed.git.branch))
      guardIssue('TASK_REPAIR_AUTHORIZATION_MISMATCH','Feedback authorization names another candidate or repository');
  }
  // The embedded object is the actual semantic input. Its source byte digest is part of the
  // request identity; the host must obtain it from the same input it decodes for execution.
  const plan=planWorkflowOperation(root,request.operation.request,{read:reads.read});
  for(const dependency of plan.reads) {
    const bytes=reads.read(dependency.path);
    if((bytes===null?null:sha256(bytes))!==dependency.sha256) guardIssue('GUARD_FACT_CHANGED','Semantic planner read dependencies changed',dependency.path);
  }
  for(const file of plan.files) {
    const actual=reads.read(file.path);
    if((actual===null?null:sha256(actual))!==(file.before===null?null:sha256(file.before))) guardIssue('GUARD_FACT_CHANGED','Semantic write before image changed',file.path);
  }
  return {context,inventory:readSpecInventory(root)};
}
export async function inspectOperation(projectRoot,input,options={}) {
  // Validate before touching the filesystem. Clone so caller mutation cannot change the request mid-await.
  const request=structuredClone(validateGuardRequest(input)),request_sha256=sha256(Buffer.from(canonicalJson(request)));
  const observed={},reasons=[];let reads=null,root=null,gate=null,gitInspection=null;
  let decision='allow';
  try {
    root=guardRoot(projectRoot);reads=createOperationReader(root);
    const operation=request.operation;
    if(operation.kind==='file.mutate') {
      const entries=inspectFileChanges(root,operation.changes,reads.read,{workflowInput:!request.task_ref&&typeof options.preparationRequestObserver==='function'});
      if(!request.task_ref) await inspectHostFiles(root,request,entries,reads,observed,options);
      else {gate=taskGate(root,request,reads,observed);inspectTaskFileScope(entries,gate.policy,{closeout:gate.closeout});}
    } else if(operation.kind==='command.run') {
      gate=taskGate(root,request,reads,observed);inspectCommand(root,operation,gate.policy,reads.readAbsolute);
    } else if(operation.kind==='workflow.query') inspectQuery(root,operation,reads.read);
    else if(operation.kind==='workflow.apply') gate=inspectSemantic(root,request,reads,observed);
    else if(operation.kind.startsWith('git.'))gitInspection=await inspectGitOperation(root,request,{reads,observed,platformObserver:options.platformObserver});
    else guardIssue('OPERATION_NOT_IMPLEMENTED','This structured operation has no implementation in this delivery',null,'unknown');
    if(gate) {
      if(!isDeepStrictEqual(gate.inventory,readSpecInventory(root))||!isDeepStrictEqual(gate.context.foundation.map(e=>e.path),foundationMembers(root))||
        observed.git&&!isDeepStrictEqual(observed.git,observeGuardWorkspace(root,reads.readAbsolute))) guardIssue('GUARD_FACT_CHANGED','Workflow inventory or Git identity changed during inspection');
    }
    if(gitInspection)gitInspection.verify();
    reads.verify();
  } catch(error) {
    decision=['INCOMPLETE','PACKAGE_INVALID','IO','ENVIRONMENT'].includes(error.code)||!error.code?'unknown':'deny';
    const detail=error.details?.[0];reasons.push({code:detail?.code||error.code||'GUARD_INSPECTION_FAILED',message:(detail?.message||error.message||'Guard inspection failed').slice(0,16384),
      path:detail?.path||null,record_ref:null,next_action:decision==='unknown'?'Supply supported parameters and the missing current observations.':'Repair the reported prerequisite and inspect the operation again.'});
  }
  return {schema_version:1,decision,allowed:decision==='allow',request_sha256,observed,read_set:[...(reads?.entries()||[]),...(gitInspection?.read_set||[])],reasons,
    verification:{source_authenticity_verified:false,checks_execution_verified:false,review_independence_verified:false}};
}
export async function revalidateOperation(projectRoot,request,previousResult,options={}) {
  const current=await inspectOperation(projectRoot,request,options);
  if(current.decision!=='allow') return current;
  if(!previousResult||previousResult.decision!=='allow'||previousResult.allowed!==true||
    previousResult.request_sha256!==current.request_sha256||!isDeepStrictEqual(previousResult.read_set,current.read_set)||!isDeepStrictEqual(previousResult.observed,current.observed))
    return {...current,decision:'deny',allowed:false,reasons:[{code:'STALE_GUARD_RESULT',message:'Prior result does not match the current request and freshly observed facts',path:null,record_ref:null,next_action:'Inspect the actual current operation again before execution.'}]};
  return current;
}
