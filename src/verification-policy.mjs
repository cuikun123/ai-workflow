import {WorkflowError} from './errors.mjs';
const fail=message=>{throw new WorkflowError('STATE_INVALID',message);};
const types=['test_suite','command','observation'];
const sameScene=(a,b)=>a.requirement_id===b.requirement_id&&a.scenario_id===b.scenario_id;
export function planBindingIssues(task,doc,digest,key){
 const position=task.data.progress;if(task.record_version!==2||!task.data.verification_policy||!position||['not_started','completed'].includes(position.status))return [];
 const path=task.iteration+'/tasks.md',plans=[...doc.records.values()].filter(r=>r.kind==='confirmation'&&r.data.purpose==='plan'&&r.iteration===task.iteration&&(r.task===null||r.task===task.id));
 const selected=(position.confirmation_refs||[]).filter(ref=>ref.path===doc.path).map(ref=>doc.records.get(ref.record_id)).filter(r=>plans.includes(r));
 const bound=r=>r.data.artifacts.some(a=>a.kind==='definition'&&a.path===path&&a.sha256===digest),current=plans.filter(bound),pool=selected.length?selected:plans,removed=new Set();
 for(const r of current)for(const ref of r.data.supersedes){const old=doc.records.get(ref.record_id);if(ref.path===doc.path&&old&&current.includes(old)&&old.task===r.task&&key(old)===key(r))removed.add(old.id);}
 const good=pool.find(r=>bound(r)&&r.data.result==='approved'&&!removed.has(r.id)&&!current.some(other=>other.data.result==='rejected'&&!removed.has(other.id)&&key(other)===key(r)));
 if(good)return [];
 const reason=!plans.length?'missing':!current.length?'stale':current.some(r=>r.data.result==='rejected'&&!removed.has(r.id))?'rejected':'not_selected';
 return [{code:'STALE_PLAN_CONFIRMATION',message:'Task verification policy plan confirmation is '+reason,reason}];
}
export function taskVerificationPolicy(task){
 const d=task.data,legacy=task.record_version!==2,mode=legacy?'full':d.execution_mode||'full',p=legacy?null:d.verification_policy;
 const policy={mode,required_check_types:p?.required_check_types||['test_suite'],required_scenario_refs:p?.required_scenario_refs||d.scenario_refs||[],review_mode:p?.review_mode||'independent'};
 if(!['direct','light','full'].includes(mode))fail('Unknown execution mode');
 if(!Array.isArray(policy.required_check_types)||!policy.required_check_types.length||policy.required_check_types.some(t=>!types.includes(t)))fail('Required verification types are missing or unknown');
 if(!legacy){
  const newPolicy=mode!=='full'||policy.review_mode!=='independent'||policy.required_check_types.some(t=>t!=='test_suite');
  if(newPolicy&&(!d.execution_mode||!d.execution_reason?.trim()||!p))fail('New verification modes need an explicit mode, reason and confirmed policy');
  if(d.execution_reason!==undefined&&!d.execution_reason.trim())fail('Execution reason is empty');
  const behavior=!!(d.requirements.length||d.scenario_refs.length||d.delta_refs.length),operational=['release','maintenance'].includes(d.phase);
  if(mode==='direct'&&(behavior||operational))fail('Direct task mode cannot declare business behavior or release/maintenance');
  if(mode==='light'&&operational)fail('Release and maintenance tasks require full mode');
  if(policy.review_mode==='simplified'&&(mode==='full'||behavior||operational))fail('Simplified review is limited to explicitly scoped low-impact nonbusiness tasks');
 }
 return policy;
}
export function verificationIssues(task,checks,reviews){
 const p=taskVerificationPolicy(task),issues=[],note=(code,message)=>issues.push({code,message});
 for(const c of checks){
  if(!c||c.kind!=='check'||c.task!==task.id||c.iteration!==task.iteration||c.data.result!=='passed'||task.record_version===2&&c.record_version!==2){note('INVALID_REQUIRED_CHECK','Check does not pass for this task');continue;}
  const d=c.data,t=d.check_type||'test_suite';
  if(t==='test_suite'&&(!d.command?.trim()||d.exit_code!==0||!Number.isSafeInteger(d.test_count)||d.test_count<1)||t==='command'&&(!d.command?.trim()||d.exit_code!==0||d.test_count!==null)||t==='observation'&&(d.command!==null||d.exit_code!==null||d.test_count!==null||!d.method?.trim()||!d.expected?.trim()||!d.actual?.trim()))note('INVALID_REQUIRED_CHECK','Passing check execution/observation fields are incomplete');
 }
 for(const type of p.required_check_types)if(!checks.some(c=>c?.data.result==='passed'&&(c.data.check_type||'test_suite')===type))note('MISSING_CHECK_TYPE','Required passing check type is missing: '+type);
 for(const scene of p.required_scenario_refs)if(!checks.some(c=>c?.data.result==='passed'&&c.data.covers?.some(s=>sameScene(s,scene))))note('MISSING_SCENARIO_COVERAGE','Required scene has no applicable passing check: '+scene.requirement_id+'/'+scene.scenario_id);
 if(!reviews.length)note('MISSING_REQUIRED_REVIEW','Required review is missing');
 for(const r of reviews)if(!r||r.kind!=='review'||r.task!==task.id||r.iteration!==task.iteration||r.data.result!=='passed'||r.data.must_fix_open!==0||(r.data.mode||'independent')!==p.review_mode||!r.data.context_id?.trim()||task.record_version===2&&r.record_version!==2)note('INVALID_REQUIRED_REVIEW','Review mode, task, context or result does not match the confirmed policy');
 return issues;
}
