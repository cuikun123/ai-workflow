import {WorkflowError} from './errors.mjs';
import {checkArtifact,artifactsKey} from './workflow-artifacts.mjs';
import {verificationIssues} from './verification-policy.mjs';
import {assertTaskContextBinding,contextMethod,contextError} from './context-binding.mjs';
import {canonicalJson} from './workflow-docs.mjs';

const fail=message=>{throw new WorkflowError('CONFLICT',message);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const confirmationKey=record=>record.data.operation_scope?canonicalJson({artifacts:artifactsKey(record.data.artifacts),operation_scope:{...record.data.operation_scope,actions:[...record.data.operation_scope.actions].sort()}}):artifactsKey(record.data.artifacts);
const capture=fn=>{try{return {issues:[],...fn()};}catch(e){return {issues:[{code:e.code||'CONFLICT',message:e.message,path:e.details?.[0]?.path||null}],error_code:e.code||'CONFLICT',error_message:e.message,error_details:e.details||[]};}};
export function assertWorkflowPrerequisites(result){
 if(result.issues.length)throw new WorkflowError(result.error_code,result.error_message,result.error_details);
 return result;
}
function access(view){
 const getRef=(ref,kind)=>{if(!exact(ref,['path','record_id'])||typeof ref.path!=='string'||typeof ref.record_id!=='string')fail('Record reference is missing');const r=view.getDoc(ref.path).records.get(ref.record_id);if(!r||r.kind!==kind)fail('Record reference is missing or has wrong kind');return r;};
 const matches=(record,current=true)=>record.data.artifacts.every(a=>checkArtifact(view.root,a,{read:view.readFile,current}).valid);
 const sameSubject=r=>r.iteration===view.state.current_iteration&&(r.task===view.state.current_task||r.task===null&&r.kind==='confirmation'&&['scope','design','plan'].includes(r.data.purpose));
 return {getRef,matches,sameSubject};
}
export function inspectConfirmations(view,{purpose,refs}){
 return capture(()=>{
  const {getRef,matches,sameSubject}=access(view);
  const stageBound=r=>{const name={scope:'scope',design:'design',plan:'tasks'}[purpose];if(!name)return true;const path=view.state.current_iteration+'/'+name+'.md';return r.data.artifacts.some(a=>a.kind==='git'?a.scope.some(s=>path===s||path.startsWith(s+'/')):a.path===path);};
  if(!Array.isArray(refs))fail('Confirmation references must be an array');
  const selected=refs.map(ref=>getRef(ref,'confirmation')).filter(r=>r.data.purpose===purpose&&sameSubject(r)&&stageBound(r));
  if(!selected.length)fail('Required user confirmation record is missing: '+purpose);
  const doc=view.getDoc(view.state.current_iteration+'/verification.md');
  const relevant=[...doc.records.values()].filter(r=>r.kind==='confirmation'&&r.data.purpose===purpose&&sameSubject(r)&&matches(r)&&selected.some(s=>confirmationKey(s)===confirmationKey(r)));
  const removed=new Set();
  for(const r of relevant)for(const ref of r.data.supersedes){const old=getRef(ref,'confirmation');if(old.data.purpose!==purpose||old.iteration!==r.iteration||old.task!==r.task||confirmationKey(old)!==confirmationKey(r))fail('Confirmation cannot supersede another object');removed.add(ref.path+'#'+ref.record_id);}
  if(relevant.some(r=>r.data.result==='rejected'&&!removed.has(doc.path+'#'+r.id)))fail('Current confirmation records conflict or reject the object');
  const record=selected.find(r=>r.data.result==='approved'&&matches(r)&&!removed.has(doc.path+'#'+r.id));
  if(!record)fail('Confirmation is stale, rejected or superseded');
  return {record};
 });
}
export function inspectTaskPrerequisites(view,{task,position,context=null}){
 return capture(()=>{
  const records=[],{getRef}=access(view);
  const confirm=(purpose,refs)=>{const r=assertWorkflowPrerequisites(inspectConfirmations(view,{purpose,refs}));records.push(r.record);return r.record;};
  const phase=position.phase,refs=position.confirmation_refs;
  if(phase==='plan'){confirm('scope',refs);confirm('design',refs);}
  else if(['build','execute'].includes(phase)){
   if(!task)fail('Implementation needs a declared task');
   for(const purpose of ['scope','design','plan'])confirm(purpose,refs);
   for(const name of ['scope','design'])if(!view.getDoc(view.state.current_iteration+'/'+name+'.md').body.trim())fail('Implementation input is empty');
   for(const ref of task.data.depends_on){
    const dependency=getRef(ref,'task'),progress=dependency.data.progress;
    if(progress?.status!=='completed'||!progress.closeout_ref)fail('Task dependency has not completed closeout');
    const close=getRef(progress.closeout_ref,'closeout');
    if(close.task!==dependency.id||close.iteration!==dependency.iteration)fail('Dependency closeout names another task');
    const approvals=progress.confirmation_refs.map(r=>getRef(r,'confirmation'));
    if(!approvals.some(r=>r.data.purpose==='task_acceptance'&&r.data.result==='approved'&&r.task===dependency.id&&artifactsKey(r.data.artifacts)===artifactsKey(close.data.artifacts)))fail('Dependency has no matching historical acceptance');
   }
  }else if(['release','maintenance'].includes(phase))confirm('operation_authorization',refs);
  else if(phase==='closeout')confirm('task_acceptance',refs);
  if(context&&task)assertTaskContextBinding(view.root,task,{context,read:view.readFile});
  return {confirmations:records,context_checked:!!(context&&task)};
 });
}
export function inspectCandidatePrerequisites(view,{task,position,requireAcceptance=false}){
 return capture(()=>{
  const {getRef,matches,sameSubject}=access(view);
  if(!task||!position.check_refs.length||!position.review_refs.length)fail('Checks and required review records are required');
  if(task.record_version===2&&(task.data.verification_policy||task.data.guard_policy)){
   const doc=view.getDoc(task.iteration+'/verification.md'),selected=position.confirmation_refs.filter(ref=>getRef(ref,'confirmation').data.purpose==='plan');
   const refs=selected.length?selected:[...doc.records.values()].filter(r=>r.kind==='confirmation'&&r.data.purpose==='plan'&&sameSubject(r)).map(r=>({path:doc.path,record_id:r.id}));
   assertWorkflowPrerequisites(inspectConfirmations(view,{purpose:'plan',refs}));
  }
  const all=[];
  for(const ref of position.check_refs){
   const r=getRef(ref,'check');
   if(r.data.method===contextMethod)contextError('CONTEXT_BINDING_NOT_BUSINESS_CHECK','Context binding cannot replace a required business check',ref.path);
   if(r.data.operation_context?.kind==='git.integration')contextError('INTEGRATION_NOT_BUSINESS_CHECK','Git integration context cannot replace a required business check',ref.path);
   if(!sameSubject(r)||r.task!==task.id||r.data.result!=='passed'||!matches(r)||!r.data.evidence.every(a=>checkArtifact(view.root,a,{read:view.readFile}).valid))fail('Check record is incomplete or stale');all.push(r);
  }
  for(const ref of position.review_refs){const r=getRef(ref,'review');if(!sameSubject(r)||r.task!==task.id||r.data.result!=='passed'||r.data.must_fix_open!==0||!matches(r))fail('Required review is missing, stale or has open findings');all.push(r);}
  const issues=verificationIssues(task,all.filter(r=>r.kind==='check'),all.filter(r=>r.kind==='review'));
  if(issues.length)fail(issues.map(i=>i.message).join('; '));
  const key=artifactsKey(all[0].data.artifacts);if(all.some(r=>artifactsKey(r.data.artifacts)!==key))fail('Checks refer to different candidate content');
  let acceptance=null;
  if(requireAcceptance){acceptance=assertWorkflowPrerequisites(inspectConfirmations(view,{purpose:'task_acceptance',refs:position.confirmation_refs})).record;if(artifactsKey(acceptance.data.artifacts)!==key)fail('Acceptance names a different candidate');}
  return {artifacts:all[0].data.artifacts,artifacts_key:key,checks:all.filter(r=>r.kind==='check'),reviews:all.filter(r=>r.kind==='review'),acceptance};
 });
}
