import {randomUUID} from 'node:crypto';import {parseDocument} from 'yaml';
import {taskVerificationPolicy,verificationIssues} from './verification-policy.mjs';
import {WorkflowError} from './errors.mjs';import {sha256} from './package.mjs';import {validateStateYaml} from './state.mjs';
import {loadWorkflowView,inspectWorkflowView,emptyPosition,positionFromState} from './workflow-status.mjs';
import {appendWorkflowRecord,replaceWorkflowRecord,parseWorkflowDocument,validateWorkflowRecord} from './workflow-docs.mjs';
import {checkArtifact,artifactsKey} from './workflow-artifacts.mjs';
import {readSpecInventory,changeSpecInventory} from './spec-inventory.mjs';
import {planSpecSynchronization,verifyCommittedSpecReceipt,assertUnchangedSpecifications} from './spec-sync.mjs';

const fail=message=>{throw new WorkflowError('CONFLICT',message);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const coreKeys=['phase','status','waiting_for','checkpoint_ref','confirmation_refs','blocker_refs'];
export function encodeWorkflowState(before,next){const doc=parseDocument(before);for(const [key,value]of Object.entries(next))doc.set(key,value);const bytes=Buffer.from(doc.toString({lineWidth:0}));validateStateYaml(bytes.toString());return bytes;}
export function planWorkflowTransition(root,request,{operationId=randomUUID(),now=new Date().toISOString(),read,inventory}={}){
  if(!exact(request,['operation_version','request_id','expected_revision','action','data'])||![1,2].includes(request.operation_version)||typeof request.request_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(request.request_id)||!Number.isSafeInteger(request.expected_revision)||!request.data||typeof request.data!=='object'||Array.isArray(request.data))fail('Invalid semantic operation input');
  const inventories=request.operation_version===2?(inventory||readSpecInventory(root)):null;
  const view=loadWorkflowView(root,{read,inventory:inventories}),beforeState=view.state,inspection=inspectWorkflowView(view);
  if(request.expected_revision!==beforeState.revision||beforeState.revision===Number.MAX_SAFE_INTEGER)fail('State revision changed or cannot be incremented');
  if(inspection.issues.some(x=>!['STALE_BASIS','STALE_PLAN_CONFIRMATION'].includes(x.code)))fail('Workflow documents or position are inconsistent');
  const afterState=structuredClone(beforeState),documents=new Map(),data=request.data;
  const readFile=path=>documents.has(path)?documents.get(path):view.readFile(path);
  const getDoc=path=>{const bytes=readFile(path);if(bytes===null)fail('Workflow document is missing');return parseWorkflowDocument(new TextDecoder('utf-8',{fatal:true}).decode(bytes),path);};
  const getRef=(ref,kind)=>{if(!exact(ref,['path','record_id'])||typeof ref.path!=='string'||typeof ref.record_id!=='string')fail('Record reference is missing');const record=getDoc(ref.path).records.get(ref.record_id);if(!record||record.kind!==kind)fail('Record reference is missing or has wrong kind');return record;};
  const getTask=(iteration,id)=>{const task=getDoc(iteration+'/tasks.md').records.get(id);if(!task||task.kind!=='task')fail('Task declaration is missing');return task;};
  let task=beforeState.current_task?getTask(beforeState.current_iteration,beforeState.current_task):null;
  const v2Gate=()=>{if(task?.record_version!==2)return;if(request.operation_version!==2)fail('A v2 task requires a v2 operation');taskVerificationPolicy(task);};
  v2Gate();
  if(task?.record_version===2&&beforeState.status!=='completed'&&request.action!=='spec_sync')assertUnchangedSpecifications(view);
  let sync_ref=null;
  let position=positionFromState(beforeState,task);
  const changePosition=next=>{position={...position,...next};for(const key of coreKeys)afterState[key]=position[key];};
  const append=(record,path=record.iteration+'/verification.md')=>{validateWorkflowRecord(record,path);documents.set(path,Buffer.from(appendWorkflowRecord(getDoc(path).text,record,path)));};
  const matches=(record,current=true)=>record.data.artifacts.every(artifact=>checkArtifact(root,artifact,{read:readFile,current}).valid);
  const sameSubject=record=>record.iteration===afterState.current_iteration&&(record.task===afterState.current_task||record.task===null&&record.kind==='confirmation'&&['scope','design','plan'].includes(record.data.purpose));
  const stageBound=(record,purpose)=>{const name={scope:'scope',design:'design',plan:'tasks'}[purpose];if(!name)return true;const path=afterState.current_iteration+'/'+name+'.md';return record.data.artifacts.some(a=>a.kind==='git'?a.scope.some(scope=>path===scope||path.startsWith(scope+'/')):a.path===path);};
  function confirmation(purpose,refs){
    if(!Array.isArray(refs))fail('Confirmation references must be an array');
    const selected=(refs||[]).map(ref=>getRef(ref,'confirmation')).filter(r=>r.data.purpose===purpose&&sameSubject(r)&&stageBound(r,purpose));
    if(!selected.length)fail('Required user confirmation record is missing: '+purpose);
    const doc=getDoc(afterState.current_iteration+'/verification.md');
    const relevant=[...doc.records.values()].filter(r=>r.kind==='confirmation'&&r.data.purpose===purpose&&sameSubject(r)&&matches(r)&&selected.some(s=>artifactsKey(s.data.artifacts)===artifactsKey(r.data.artifacts)));
    const removed=new Set();for(const r of relevant)for(const ref of r.data.supersedes){const old=getRef(ref,'confirmation');if(old.data.purpose!==purpose||old.iteration!==r.iteration||old.task!==r.task||artifactsKey(old.data.artifacts)!==artifactsKey(r.data.artifacts))fail('Confirmation cannot supersede another object');removed.add(ref.path+'#'+ref.record_id);}
    if(relevant.some(r=>r.data.result==='rejected'&&!removed.has(doc.path+'#'+r.id)))fail('Current confirmation records conflict or reject the object');
    const good=selected.find(r=>r.data.result==='approved'&&matches(r)&&!removed.has(doc.path+'#'+r.id));if(!good)fail('Confirmation is stale, rejected or superseded');return good;
  }
  function phaseGate(){
    const refs=afterState.confirmation_refs;
    if(afterState.phase==='clarify')return;
    if(afterState.phase==='plan'){confirmation('scope',refs);confirmation('design',refs);return;}
    if(['build','execute'].includes(afterState.phase)){
      if(!task)fail('Implementation needs a declared task');for(const kind of ['scope','design','plan'])confirmation(kind,refs);
      for(const name of ['scope','design'])if(!getDoc(afterState.current_iteration+'/'+name+'.md').body.trim())fail('Implementation input is empty');
      for(const ref of task.data.depends_on){const dependency=getRef(ref,'task');const progress=dependency.data.progress;if(progress?.status!=='completed'||!progress.closeout_ref)fail('Task dependency has not completed closeout');const close=getRef(progress.closeout_ref,'closeout');if(close.task!==dependency.id||close.iteration!==dependency.iteration)fail('Dependency closeout names another task');const approvals=progress.confirmation_refs.map(r=>getRef(r,'confirmation'));if(!approvals.some(r=>r.data.purpose==='task_acceptance'&&r.data.result==='approved'&&r.task===dependency.id&&artifactsKey(r.data.artifacts)===artifactsKey(close.data.artifacts)))fail('Dependency has no matching historical acceptance');}
      return;
    }
    if(['release','maintenance'].includes(afterState.phase)){confirmation('operation_authorization',refs);return;}
    if(afterState.phase==='closeout')confirmation('task_acceptance',refs);
  }
  function checks(){
    if(!task||!position.check_refs.length||!position.review_refs.length)fail('Checks and required review records are required');
    if(task.record_version===2&&task.data.verification_policy){
      const doc=getDoc(task.iteration+'/verification.md'),selected=position.confirmation_refs.filter(ref=>{const r=getRef(ref,'confirmation');return r.data.purpose==='plan';});
      const refs=selected.length?selected:[...doc.records.values()].filter(r=>r.kind==='confirmation'&&r.data.purpose==='plan'&&sameSubject(r)).map(r=>({path:doc.path,record_id:r.id}));
      confirmation('plan',refs);
    }
    const all=[];
    for(const ref of position.check_refs){const record=getRef(ref,'check');if(!sameSubject(record)||record.task!==task.id||record.data.result!=='passed'||!matches(record)||!record.data.evidence.every(a=>checkArtifact(root,a,{read:readFile}).valid))fail('Check record is incomplete or stale');all.push(record);}
    for(const ref of position.review_refs){const record=getRef(ref,'review');if(!sameSubject(record)||record.task!==task.id||record.data.result!=='passed'||record.data.must_fix_open!==0||!matches(record))fail('Required review is missing, stale or has open findings');all.push(record);}
    const policyIssues=verificationIssues(task,all.filter(r=>r.kind==='check'),all.filter(r=>r.kind==='review'));if(policyIssues.length)fail(policyIssues.map(i=>i.message).join('; '));
    const key=artifactsKey(all[0].data.artifacts);if(all.some(r=>artifactsKey(r.data.artifacts)!==key))fail('Checks refer to different candidate content');return key;
  }
  function checkpoint(reason){if(!afterState.current_iteration)fail('There is no work to checkpoint');const record={record_version:task?.record_version||request.operation_version,id:'checkpoint-'+operationId,kind:'checkpoint',iteration:afterState.current_iteration,task:afterState.current_task,source:{role:'tool',reference:'operation:'+operationId,text:'Recorded previous position; not a new approval'},data:{revision:beforeState.revision,reason,position:structuredClone(position)}};append(record);return {path:record.iteration+'/verification.md',record_id:record.id};}
  const args=(required,optional=[])=>{if(Object.keys(data).some(k=>![...required,...optional].includes(k))||required.some(k=>data[k]===undefined))fail('Unknown or missing operation argument');};
  switch(request.action){
    case 'record':{
      args(['record']);let record=structuredClone(data.record);if(!['task','confirmation','check','review','blocker','resolution','closeout',...(request.operation_version===2?['spec_delta']:[])].includes(record?.kind))fail('Runtime position records cannot be registered by callers');
      if(record.record_version!==request.operation_version)fail('Record and operation versions differ');
      const path=record.iteration+'/'+(record.kind==='task'?'tasks.md':record.kind==='spec_delta'?'scope.md':'verification.md');validateWorkflowRecord(record,path);
      if(record.kind==='task'){if(record.data.progress!==undefined)fail('Task declarations cannot inject progress');record.data.progress=emptyPosition(record.data.phase);}
      if(record.data.artifacts&&!matches(record))fail('Record candidate artifacts are stale');append(record,path);break;
    }
    case 'prepare':case 'select':{
      args(['iteration','task','confirmations'],['phase','selection_ref']);
      if(typeof data.iteration!=='string'||data.task!==null&&typeof data.task!=='string'||!Array.isArray(data.confirmations))fail('Selection arguments have invalid types');
      if(!['not_started','completed'].includes(beforeState.status)&&!(request.action==='select'&&beforeState.status==='paused'))fail('Current work must finish or explicitly pause before selection');
      for(const name of ['scope','design','tasks','verification'])getDoc(data.iteration+'/'+name+'.md');
      afterState.current_iteration=data.iteration;afterState.current_task=data.task;task=data.task?getTask(data.iteration,data.task):null;
      v2Gate();
      if(beforeState.status==='paused')confirmation('operation_authorization',[data.selection_ref]);
      if(task?.data.progress?.status==='paused'){
        const saved=getRef(task.data.progress.checkpoint_ref,'checkpoint');if(saved.iteration!==data.iteration||saved.task!==data.task)fail('Checkpoint names different work');position=structuredClone(saved.data.position);changePosition(position);if(['ready','running'].includes(position.status))phaseGate();
      }else{if(task&&task.data.progress?.status!=='not_started')fail('Selected task is already active or completed');position=emptyPosition(task?task.data.phase:(data.phase||'clarify'));changePosition({status:'ready',confirmation_refs:data.confirmations});phaseGate();}
      break;
    }
    case 'start':args([]);if(beforeState.status!=='ready')fail('Only ready work can start');phaseGate();changePosition({status:'running'});break;
    case 'verify':args([],['authorization_ref']);if(!task||!(['build','execute','release','maintenance'].includes(beforeState.phase)&&beforeState.status==='running'||beforeState.phase==='accept'&&beforeState.status==='awaiting_user'||beforeState.phase==='closeout'&&['ready','running'].includes(beforeState.status)&&data.authorization_ref))fail('This position cannot enter verification');if(beforeState.phase==='closeout')confirmation('operation_authorization',[data.authorization_ref]);else if(beforeState.status==='running')phaseGate();changePosition({phase:'verify',status:'running',waiting_for:null,check_refs:[],review_refs:[],closeout_ref:null,confirmation_refs:position.confirmation_refs.filter(r=>getRef(r,'confirmation').data.purpose!=='task_acceptance')});break;
    case 'await':{
      args(['waiting_for'],['check_refs','review_refs']);
      if(data.waiting_for==='task_acceptance'){if(beforeState.phase!=='verify'||beforeState.status!=='running')fail('Acceptance requires completed verification preparation');position.check_refs=data.check_refs||[];position.review_refs=data.review_refs||[];checks();changePosition({phase:'accept',status:'awaiting_user',waiting_for:'task_acceptance'});}
      else{if(!['scope_confirmation','plan_confirmation','operation_authorization','retry_decision'].includes(data.waiting_for)||!['not_started','ready','running'].includes(beforeState.status))fail('Invalid confirmation waiting operation');changePosition({status:'awaiting_user',waiting_for:data.waiting_for});}
      break;
    }
    case 'confirm':{
      args(['confirmation_refs'],['next_phase']);if(beforeState.status!=='awaiting_user')fail('Only waiting work can accept a confirmation');
      const purpose=beforeState.waiting_for==='scope_confirmation'?'scope':beforeState.waiting_for==='plan_confirmation'?'plan':beforeState.waiting_for;
      const selected=confirmation(purpose,data.confirmation_refs);
      if(purpose==='task_acceptance'){const key=checks();if(artifactsKey(selected.data.artifacts)!==key)fail('User acceptance names a different candidate');changePosition({phase:'closeout',status:'ready',waiting_for:null,confirmation_refs:data.confirmation_refs});}
      else{const phase=data.next_phase||beforeState.phase;if(!['clarify','plan','build','execute','release','maintenance'].includes(phase))fail('Confirmation cannot bypass verification or closeout');changePosition({phase,status:'ready',waiting_for:null,confirmation_refs:[...position.confirmation_refs,...data.confirmation_refs].filter((r,i,a)=>a.findIndex(x=>x.path===r.path&&x.record_id===r.record_id)===i)});phaseGate();}
      break;
    }
    case 'closeout':args([]);if(beforeState.phase!=='closeout'||beforeState.status!=='ready')fail('Closeout needs current accepted content');phaseGate();checks();changePosition({status:'running'});break;
    case 'spec_sync':{
      args(['iteration','task']);if(task?.record_version!==2||request.operation_version!==2||data.iteration!==beforeState.current_iteration||data.task!==task.id||beforeState.phase!=='closeout'||!['ready','running'].includes(beforeState.status))fail('Specification synchronization needs the current accepted v2 task');
      const acceptance=confirmation('task_acceptance',position.confirmation_refs),key=checks();if(artifactsKey(acceptance.data.artifacts)!==key)fail('Acceptance names a different candidate');
      if([...getDoc(task.iteration+'/verification.md').records.values()].some(r=>r.kind==='spec_sync'&&r.task===task.id))fail('Task already has a synchronization receipt; retry its original request');
      const acceptanceRef=position.confirmation_refs.find(ref=>ref.record_id===acceptance.id&&ref.path===task.iteration+'/verification.md');if(!acceptanceRef)fail('Task acceptance must be recorded in its verification document');
      const sync=planSpecSynchronization(view,task,{requestId:request.request_id,operationId,now,acceptanceRef,checkRefs:position.check_refs,reviewRefs:position.review_refs});
      for(const file of sync.files)documents.set(file.path,file.after);append(sync.receipt);sync_ref={path:task.iteration+'/verification.md',record_id:sync.receipt.id};break;
    }
    case 'complete':{
      args(['closeout_ref']);if(beforeState.phase!=='closeout'||!['ready','running'].includes(beforeState.status))fail('Only accepted closeout can complete');phaseGate();const key=checks(),close=getRef(data.closeout_ref,'closeout');if(!sameSubject(close)||close.task!==afterState.current_task||!matches(close)||artifactsKey(close.data.artifacts)!==key)fail('Closeout does not match current accepted content');
      if(task?.record_version===2){if(close.record_version!==2)fail('V2 completion needs a v2 closeout');const receipt=getRef(close.data.sync_ref,'spec_sync');if(receipt.task!==task.id||receipt.iteration!==task.iteration||close.data.specs!==receipt.data.result)fail('Closeout receipt names another result');verifyCommittedSpecReceipt(root,receipt);}
      changePosition({status:'completed',closeout_ref:data.closeout_ref});break;
    }
    case 'pause':args(['confirmation_ref','reason']);if(['paused','completed'].includes(beforeState.status))fail('This work cannot pause');{confirmation('pause',[data.confirmation_ref]);const saved=checkpoint(data.reason);changePosition({status:'paused',waiting_for:null,checkpoint_ref:saved});}break;
    case 'block':args(['blocker_refs','reason']);if(['paused','completed','blocked'].includes(beforeState.status)||!Array.isArray(data.blocker_refs)||!data.blocker_refs.length)fail('Blocking requires active work and evidence');for(const ref of data.blocker_refs){const record=getRef(ref,'blocker');if(!sameSubject(record))fail('Blocker names other work');}{const saved=checkpoint(data.reason);changePosition({status:'blocked',waiting_for:null,blocker_refs:data.blocker_refs,checkpoint_ref:saved});}break;
    case 'resume':{
      args([],['resolution_ref']);if(!['paused','blocked'].includes(beforeState.status))fail('Only paused or blocked work can resume');const saved=getRef(beforeState.checkpoint_ref,'checkpoint');if(!sameSubject(saved)||saved.task!==beforeState.current_task)fail('Checkpoint names another task');
      if(beforeState.status==='blocked'){const resolution=getRef(data.resolution_ref,'resolution');if(!sameSubject(resolution)||beforeState.blocker_refs.some(r=>!resolution.data.blockers.some(x=>x.path===r.path&&x.record_id===r.record_id))||!resolution.data.evidence.every(a=>checkArtifact(root,a,{read:readFile}).valid))fail('Blocker resolution is missing or stale');}
      changePosition(structuredClone(saved.data.position));if(['ready','running'].includes(position.status))phaseGate();break;
    }
    case 'refresh':args([]);if(task?.record_version===2)assertUnchangedSpecifications(view);if(['ready','running'].includes(beforeState.status))phaseGate();break;
    default:fail('Unknown semantic state operation');
  }
  if(task&&afterState.current_task===task.id){task={...task,data:{...task.data,progress:structuredClone(position)}};const path=task.iteration+'/tasks.md';documents.set(path,Buffer.from(replaceWorkflowRecord(getDoc(path).text,task,path)));}
  afterState.revision=beforeState.revision+1;afterState.updated_at=now;
  if(afterState.current_iteration)append({record_version:task?.record_version||request.operation_version,id:'progress-'+operationId,kind:'progress',iteration:afterState.current_iteration,task:afterState.current_task,source:{role:'tool',reference:'operation:'+operationId,text:'State operation record; completion is subject to journal commit'},data:{operation:request.action,request_id:request.request_id,from_revision:beforeState.revision,to_revision:afterState.revision,position:structuredClone(position)}});
  const statePath='docs/workflow/state.yaml';
  const basis=new Set([...beforeState.basis.map(x=>x.path),...view.raw.keys()].filter(path=>path!==statePath&&!path.startsWith('.ai-workflow/')&&readFile(path)!==null));
  for(const path of documents.keys())basis.add(path);
  afterState.basis=[...basis].sort().map(path=>{const bytes=readFile(path);if(bytes===null)fail('Basis disappeared during planning');return {path,sha256:sha256(bytes)};});
  const stateBytes=encodeWorkflowState(view.text(statePath),afterState);
  const afterInventory=inventories?changeSpecInventory(inventories,[...documents].map(([path,bytes])=>({path,exists:bytes!==null}))):null;
  const finalView=loadWorkflowView(root,{read:path=>path===statePath?stateBytes:readFile(path),inventory:afterInventory}),finalInspection=inspectWorkflowView(finalView);if(finalInspection.issues.some(x=>!['STALE_BASIS','STALE_PLAN_CONFIRMATION'].includes(x.code)))fail('Prepared state and documents are inconsistent: '+finalInspection.issues.map(x=>x.code).join(', '));
  const files=[...documents].map(([path,after])=>({path,kind:'file',before:view.readFile(path),after})).filter(file=>file.before===null||!file.before.equals(file.after));files.push({path:statePath,kind:'file',before:view.readFile(statePath),after:stateBytes});
  const reads=[...view.raw].map(([path,bytes])=>({path,sha256:bytes===null?null:sha256(bytes)}));
  return {root,request,operationId,createdAt:now,beforeState,afterState,files,reads,...(inventories?{inventories,sync_ref}:{}),acceptance_verified:false,source_authenticity_verified:false};
}
