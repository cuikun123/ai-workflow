import {TextDecoder} from 'node:util';
import {readProjectFile} from './project-paths.mjs';
import {parseWorkflowDocument,canonicalJson,definitionDigest} from './workflow-docs.mjs';
import {parseSpecification,digest,issue} from './spec-docs.mjs';
import {readSpecInventory,validateSpecInventory} from './spec-inventory.mjs';
import {verificationIssues,planBindingIssues} from './verification-policy.mjs';

const key=ref=>ref.path+'#'+ref.record_id;
const sceneKey=ref=>ref.requirement_id+'/'+ref.scenario_id;
const wrap=body=>'# Candidate\n## Purpose\nDeclared change.\n## Scope\nThis delta only.\n## Requirements\n'+body;
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));

export function inspectSpecifications(root,{read=path=>readProjectFile(root,path,1024*1024),taskRef=null,inventory=null}={}){
  const issues=[],documents=new Map(),specs=new Map(),records=new Map(),requirements=new Map(),raw=new Map(),files=[];
  const note=(code,path,message,record_id=null)=>issues.push(issue(code,path,message,null,record_id));
  function text(path){
    if(!raw.has(path))raw.set(path,read(path));
    const bytes=raw.get(path);
    if(bytes===null)throw new Error('Missing document: '+path);
    if(bytes.length>1024*1024)throw new Error('Document exceeds 1 MiB');
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }
  try{for(const entry of validateSpecInventory(inventory||readSpecInventory(root)))for(const path of entry.paths)files.push({path,spec:entry.root==='docs/project/specs'});}catch(error){note('INVALID_DOCUMENT_INVENTORY',null,error.message);}
  for(const file of files){
    try{
      const source=text(file.path);
      if(file.spec){
        const doc=parseSpecification(source,file.path,{legacy:true});
        if(file.path.endsWith('/README.md')&&!doc.has_requirement_header)continue;
        specs.set(file.path,doc);
        for(const [id,req]of doc.requirements){
          const folded=id.toLowerCase();
          if(requirements.has(folded))note('DUPLICATE_REQUIREMENT',file.path,'Project requirement ID is repeated or aliased: '+id);
          else requirements.set(folded,{...req,path:file.path,section:doc.sections.get(id)});
        }
      }else{
        const doc=parseWorkflowDocument(source,file.path);documents.set(file.path,doc);
        for(const record of doc.records.values())records.set(file.path+'#'+record.id,{record,path:file.path});
      }
    }catch(error){note('INVALID_SPEC_DOCUMENT',file.path,error.message);}
  }
  const resolve=(ref,kind=null)=>{
    const value=records.get(key(ref));
    if(!value||kind&&value.record.kind!==kind){note('BAD_RECORD_REFERENCE',ref.path,'Missing or wrong-kind record: '+ref.record_id,ref.record_id);return null;}
    return value.record;
  };
  const tasks=[...records.values()].filter(x=>x.record.kind==='task'),views=new Map(),retiredRequirements=new Set(),retiredScenes=new Set();
  const validReceipts=new Set(),candidateKey=r=>r.data.artifacts?.map(canonicalJson).sort().join('\0');
  for(const {record:r,path}of records.values()){
    const groups=[];
    if(r.kind==='task')groups.push([r.data.depends_on,'task']);
    if(r.kind==='confirmation')groups.push([r.data.supersedes,'confirmation']);
    if(r.kind==='resolution')groups.push([r.data.blockers,'blocker']);
    if(r.kind==='closeout'&&r.record_version===2)groups.push([[r.data.sync_ref],'spec_sync']);
    const position=r.kind==='task'?r.data.progress:r.data.position;
    if(position)groups.push([position.confirmation_refs,'confirmation'],[position.check_refs,'check'],[position.review_refs,'review'],[position.blocker_refs,'blocker'],[position.checkpoint_ref?[position.checkpoint_ref]:[],'checkpoint'],[position.closeout_ref?[position.closeout_ref]:[],'closeout']);
    for(const [refs,kind]of groups)for(const ref of refs||[])resolve(ref,kind);
    if(r.kind!=='spec_sync')continue;
    let valid=true;
    const bad=message=>{valid=false;note('BAD_SYNC_REFERENCE',path,message,r.id);};
    const t=records.get(r.iteration+'/tasks.md#'+r.task)?.record;
    if(!t||t.kind!=='task'||t.record_version!==2){bad('Receipt needs its declared v2 task');continue;}
    const approval=resolve(r.data.acceptance_ref,'confirmation');
    if(!approval||approval.iteration!==r.iteration||approval.task!==r.task||approval.data.purpose!=='task_acceptance'||approval.data.result!=='approved')bad('Receipt needs matching declared task acceptance');
    const checks=r.data.check_refs.map(ref=>resolve(ref,'check')),reviews=r.data.review_refs.map(ref=>resolve(ref,'review'));
    if(verificationIssues(t,checks,reviews).length)bad('Receipt verification differs from the confirmed task policy');
    if(!checks.length||!reviews.length||[...checks,...reviews].some(c=>!c||c.iteration!==r.iteration||c.task!==r.task||c.data.result!=='passed'||approval&&candidateKey(c)!==candidateKey(approval)))bad('Receipt evidence must belong to the same accepted candidate');
    if(!sameSet(t.data.delta_refs.map(key),r.data.delta_refs.map(key)))bad('Receipt changes differ from the task');
    const pos=t.data.progress;
    if(pos?.phase!=='closeout'||!pos.confirmation_refs.some(ref=>key(ref)===key(r.data.acceptance_ref))||!sameSet(pos.check_refs.map(key),r.data.check_refs.map(key))||!sameSet(pos.review_refs.map(key),r.data.review_refs.map(key)))bad('Receipt is not bound to the task closeout position');
    if(pos?.status==='completed'){
      const close=pos.closeout_ref?resolve(pos.closeout_ref,'closeout'):null;
      if(!close||close.record_version!==2||close.iteration!==r.iteration||close.task!==r.task||key(close.data.sync_ref)!==path+'#'+r.id||close.data.specs!==r.data.result||approval&&candidateKey(close)!==candidateKey(approval))bad('Completed task has no matching closeout receipt');
    }
    const expectedOps=[],expectedBases=new Map();
    for(const ref of r.data.delta_refs){
      const d=resolve(ref,'spec_delta');if(!d){valid=false;continue;}
      if(d.iteration!==r.iteration||d.task!==r.task){bad('Receipt delta names another task');continue;}
      for(const op of d.data.operations)expectedOps.push(key(ref)+'#'+op.operation_id);
      for(const b of d.data.base)expectedBases.set(b.path,b.sha256);
      if(pos?.status!=='completed')for(const op of d.data.operations){
        const actual=specs.get(op.path),section=actual?.sections.get(op.requirement_id);
        const stillPresent=actual&&[...actual.requirements.keys()].some(id=>id.toLowerCase()===op.requirement_id.toLowerCase());
        if(op.action==='REMOVED'?stillPresent:!section||section.raw!==op.after_markdown){
          valid=false;note('STALE_SYNC_RESULT',op.path,'Unfinished receipt does not match its declared requirement result',r.id);
        }
      }
    }
    if(!sameSet(expectedOps,r.data.operations.map(ref=>key(ref)+'#'+ref.operation_id))||!sameSet([...expectedBases.keys()],r.data.targets.map(target=>target.path)))bad('Receipt must cover every declared operation and file target');
    if(r.data.result==='synced'&&!expectedOps.length||r.data.result==='not_needed'&&expectedOps.length)bad('Receipt result differs from its changes');
    for(const target of r.data.targets){
      if(target.before_sha256!==expectedBases.get(target.path))bad('Receipt file base differs from the declared delta');
      if(pos?.status!=='completed')try{
        const bytes=read(target.path);
        if(bytes===null||digest(bytes)!==target.after_sha256){valid=false;note('STALE_SYNC_TARGET',target.path,'Unfinished closeout differs from its recorded file result',r.id);}
      }catch(error){bad(error.message);}
    }
    if(valid)validReceipts.add(path+'#'+r.id);
  }
  for(const {record:r,path}of records.values())if(r.kind==='spec_sync'&&validReceipts.has(path+'#'+r.id)){
    for(const ref of r.data.delta_refs){
      const delta=resolve(ref,'spec_delta');if(!delta)continue;
      if(delta.task!==r.task||delta.iteration!==r.iteration){note('BAD_SYNC_REFERENCE',path,'Receipt delta names another task',r.id);continue;}
      if(r.data.result==='synced')for(const op of delta.data.operations){
        if(!r.data.operations.some(x=>key(x)===key(ref)&&x.operation_id===op.operation_id))continue;
        if(op.action==='REMOVED')retiredRequirements.add(op.requirement_id.toLowerCase());
        for(const s of op.removed_scenarios)retiredScenes.add((op.requirement_id+'/'+s).toLowerCase());
      }
    }
  }
  for(const req of requirements.values()){
    if(retiredRequirements.has(req.id.toLowerCase()))note('RETIRED_REQUIREMENT_REUSED',req.path,'Effective specification reuses a removed requirement: '+req.id);
    for(const id of req.scenarios.keys())if(retiredScenes.has((req.id+'/'+id).toLowerCase()))note('RETIRED_SCENARIO_REUSED',req.path,'Effective specification reuses a removed scene: '+req.id+'/'+id);
  }
  const reservations=new Map();
  for(const {record:d,path}of records.values())if(d.kind==='spec_delta'){
    const applied=[...records.values()].some(x=>x.record.kind==='spec_sync'&&validReceipts.has(x.path+'#'+x.record.id)&&x.record.data.delta_refs.some(ref=>key(ref)===path+'#'+d.id));
    if(applied)continue;
    for(const op of d.data.operations)if(op.action==='ADDED'){
      const folded=op.requirement_id.toLowerCase();
      if(reservations.has(folded))note('DUPLICATE_DRAFT_ID',path,'Draft additions reserve the same requirement ID: '+op.requirement_id,d.id);
      else reservations.set(folded,path+'#'+d.id);
    }
  }
  function validateDelta(delta,path,view,targets,historical=false){
    const data=delta.data,bases=new Map(),headers=new Map(),operationIds=new Set();
    for(const base of data.base){
      if(bases.has(base.path))note('DUPLICATE_DELTA_BASE',path,'Repeated delta base',delta.id);
      bases.set(base.path,base.sha256);
    }
    for(const header of data.new_spec_headers){
      if(headers.has(header.path))note('DUPLICATE_SPEC_HEADER',path,'Repeated new-file header',delta.id);
      headers.set(header.path,header.markdown);
    }
    const usedPaths=new Set();
    for(const op of data.operations){
      usedPaths.add(op.path);
      const target=op.path+'#'+op.requirement_id.toLowerCase(),old=specs.get(op.path)?.requirements.get(op.requirement_id);
      if(operationIds.has(op.operation_id.toLowerCase()))note('DUPLICATE_OPERATION',path,'Operation ID repeated or aliased',delta.id);
      operationIds.add(op.operation_id.toLowerCase());
      if(targets.has(target))note('CONFLICTING_DELTA',path,'Multiple operations target the same requirement',delta.id);
      targets.add(target);
      if(op.action!=='ADDED'&&op.before_sha256===null)note('MISSING_REQUIREMENT_BASE',path,'Modified/removed requirement needs a block digest',delta.id);
      if(!bases.has(op.path))note('MISSING_DELTA_BASE',path,'Operation has no file base',delta.id);
      if(!historical){
        try{
          const bytes=read(op.path),actual=bytes===null?null:digest(bytes);
          if(actual!==bases.get(op.path))note('STALE_DELTA_BASE',op.path,'Specification file differs from the declared base',delta.id);
        }catch(error){note('INVALID_DELTA_PATH',op.path,error.message,delta.id);}
      }
      if(op.action==='ADDED'){
        if(!historical&&requirements.has(op.requirement_id.toLowerCase()))note('ADDED_REQUIREMENT_EXISTS',path,'Addition names an existing requirement',delta.id);
        if(!historical&&retiredRequirements.has(op.requirement_id.toLowerCase()))note('RETIRED_REQUIREMENT_REUSED',path,'Removed requirement ID cannot be reused',delta.id);
        if(op.before_sha256!==null||op.removed_scenarios.length)note('INVALID_ADDITION',path,'Addition cannot claim an old block or scene removal',delta.id);
      }else if(!historical){
        if(!old)note('MISSING_DELTA_REQUIREMENT',path,'Modified/removed requirement is missing or wrong-case',delta.id);
        else if(digest(specs.get(op.path).sections.get(op.requirement_id).raw)!==op.before_sha256)note('STALE_REQUIREMENT_BASE',path,'Requirement differs from the declared block',delta.id);
      }
      if(op.action==='REMOVED'){
        if(op.after_markdown!==null)note('INVALID_REMOVAL',path,'Removal cannot provide a replacement',delta.id);
        if(old&&!historical&&!sameSet([...old.scenarios.keys()],op.removed_scenarios))note('UNDECLARED_SCENARIO_REMOVAL',path,'Removal must declare all previous scenarios',delta.id);
        view.set(op.requirement_id.toLowerCase(),{id:op.requirement_id,path:op.path,removed:true,scenarios:new Map(op.removed_scenarios.map(id=>[id,{id,removed:true}]))});
        continue;
      }
      if(typeof op.after_markdown!=='string'){note('MISSING_REPLACEMENT',path,'Addition/modification needs the complete replacement',delta.id);continue;}
      try{
        const parsed=parseSpecification(wrap(op.after_markdown),op.path);
        for(const found of parsed.issues)issues.push({...found,record_id:delta.id});
        const next=parsed.requirements.get(op.requirement_id);
        if(parsed.requirements.size!==1||!next){note('DELTA_ID_MISMATCH',path,'Replacement must contain exactly the named requirement',delta.id);continue;}
        if(parsed.sections.get(op.requirement_id).raw!==op.after_markdown)note('INVALID_REPLACEMENT_SCOPE',path,'Replacement content escapes the named requirement block',delta.id);
        if(old&&!historical){
          const missing=[...old.scenarios.keys()].filter(id=>!next.scenarios.has(id));
          if(!sameSet(missing,op.removed_scenarios))note('UNDECLARED_SCENARIO_REMOVAL',path,'Scenario removals differ from the replacement',delta.id);
        }else if(op.action==='ADDED'&&op.removed_scenarios.length)note('INVALID_ADDITION',path,'New requirement cannot remove old scenarios',delta.id);
        if(!historical)for(const id of next.scenarios.keys())if(retiredScenes.has((op.requirement_id+'/'+id).toLowerCase())&&!old?.scenarios.has(id))note('RETIRED_SCENARIO_REUSED',path,'Removed scenario ID cannot be reused',delta.id);
        if(!historical&&bases.get(op.path)===null){
          if(op.action!=='ADDED'||!headers.has(op.path))note('MISSING_SPEC_HEADER',path,'New specification needs an explicit Purpose/Scope header',delta.id);
          else{
            const complete=parseSpecification(headers.get(op.path)+'\n'+op.after_markdown,op.path);
            if(complete.issues.length||complete.requirements.size!==1)note('INVALID_SPEC_HEADER',path,'New header must contain valid Purpose/Scope/Requirements and no extra requirements',delta.id);
          }
        }
        view.set(op.requirement_id.toLowerCase(),{...next,path:op.path});
        for(const id of op.removed_scenarios)next.scenarios.set(id,{id,removed:true});
      }catch(error){note('INVALID_REPLACEMENT',path,error.message,delta.id);}
    }
    for(const path of [...bases.keys(),...headers.keys()])if(!usedPaths.has(path))note('UNUSED_DELTA_RESOURCE',path,'Delta contains an unused base/header',delta.id);
    for(const path of headers.keys())if(bases.get(path)!==null)note('UNEXPECTED_SPEC_HEADER',path,'New-file header provided for an existing file',delta.id);
  }
  function taskView(t,path){
    const view=new Map(requirements),targets=new Set(),refs=t.data.delta_refs||[];
    const receipt=[...records.values()].find(x=>x.record.kind==='spec_sync'&&validReceipts.has(x.path+'#'+x.record.id)&&x.record.iteration===t.iteration&&x.record.task===t.id&&x.record.data.result==='synced'&&sameSet(x.record.data.delta_refs.map(key),refs.map(key)))?.record;
    const historical=!!receipt;
    if(t.record_version===2&&t.data.progress?.status==='completed'&&!receipt&&refs.length)note('MISSING_SYNC_RECEIPT',path,'Completed change has no consistent synchronization receipt',t.id);
    for(const ref of refs){
      const delta=resolve(ref,'spec_delta');if(!delta)continue;
      if(delta.task!==t.id||delta.iteration!==t.iteration){note('BAD_DELTA_REFERENCE',path,'Delta belongs to another task',t.id);continue;}
      for(const op of delta.data.operations)if(!t.data.requirements.includes(op.requirement_id))note('UNLINKED_DELTA_REQUIREMENT',path,'Delta requirement is not associated with its owning task: '+op.requirement_id,t.id);
      validateDelta(delta,ref.path,view,targets,historical);
    }
    return view;
  }
  const selected=taskRef?tasks.filter(x=>x.path===taskRef.path&&x.record.id===taskRef.record_id):tasks;
  const selectedTargets=selected.flatMap(x=>(x.record.data.delta_refs||[]).flatMap(ref=>records.get(key(ref))?.record.data.base||[])).map(x=>x.path);
  for(const [path,doc]of specs){
    const unrelatedLegacy=taskRef&&selected.every(x=>x.record.record_version===2)&&!selectedTargets.includes(path)&&doc.requirements.size===0&&doc.issues.some(x=>x.code==='LEGACY_SPEC');
    const retiredEmpty=doc.requirements.size===0&&[...records.values()].some(x=>x.record.kind==='spec_sync'&&validReceipts.has(x.path+'#'+x.record.id)&&x.record.data.targets.some(target=>target.path===path&&target.after_sha256===digest(raw.get(path)))&&x.record.data.delta_refs.some(ref=>records.get(key(ref))?.record.data.operations.some(op=>op.path===path&&op.action==='REMOVED')));
    if(!unrelatedLegacy)issues.push(...doc.issues.filter(x=>!(retiredEmpty&&x.message==='No identified requirement is present')));
  }
  if(taskRef&&!selected.length)note('BAD_TASK_REFERENCE',taskRef.path,'Selected task record does not exist',taskRef.record_id);
  for(const {record:t,path}of selected){
    const view=taskView(t,path);views.set(path+'#'+t.id,view);
    for(const id of t.data.requirements){
      const req=view.get(id.toLowerCase());
      if(!req||req.id!==id)note('BAD_REQUIREMENT_REFERENCE',path,'Task requirement is missing or wrong-case: '+id,t.id);
      else if(t.record_version===2&&!t.data.scenario_refs.some(s=>s.requirement_id===id))note('UNLINKED_REQUIREMENT_SCENARIO',path,'Task requirement has no associated scene: '+id,t.id);
    }
    for(const ref of t.data.scenario_refs||[]){
      const req=view.get(ref.requirement_id.toLowerCase());
      if(!req||req.id!==ref.requirement_id||!req.scenarios.has(ref.scenario_id))note('BAD_SCENARIO_REFERENCE',path,'Task scenario is missing or wrong-case: '+sceneKey(ref),t.id);
      if(!t.data.requirements.includes(ref.requirement_id))note('UNLINKED_SCENARIO',path,'Scenario requirement is not associated with the task',t.id);
    }
  }
  for(const {record:r,path}of records.values()){
    if(!['spec_delta','check','review'].includes(r.kind))continue;
    if(r.task===null)continue;
    const taskPath=r.iteration+'/tasks.md',t=records.get(taskPath+'#'+r.task)?.record;
    if(!t||t.kind!=='task'){note('BAD_TASK_REFERENCE',path,'Record names an unknown task',r.id);continue;}
    if(taskRef&&key(taskRef)!==taskPath+'#'+t.id)continue;
    if(r.kind==='spec_delta'){
      if(t.record_version!==2||!t.data.delta_refs.some(ref=>key(ref)===path+'#'+r.id))note('UNLINKED_DELTA',path,'Task does not reference its declared delta',r.id);
      continue;
    }
    const view=views.get(taskPath+'#'+t.id)||requirements;
    for(const ref of r.data.covers||[]){
      const req=view.get(ref.requirement_id.toLowerCase());
      if(!req||req.id!==ref.requirement_id||!req.scenarios.has(ref.scenario_id))note('BAD_SCENARIO_REFERENCE',path,'Evidence names an unknown or wrong-case scene',r.id);
      if(!t.data.scenario_refs?.some(s=>sceneKey(s)===sceneKey(ref)))note('UNLINKED_SCENARIO',path,'Evidence scene is not associated with the task',r.id);
    }
  }
  for(const {record:t,path}of selected)if(t.record_version===2&&t.data.verification_policy){
    const taskDoc=documents.get(path),verificationDoc=documents.get(t.iteration+'/verification.md');
    if(taskDoc){const doc=verificationDoc||{path:t.iteration+'/verification.md',records:new Map()};for(const problem of planBindingIssues(t,doc,definitionDigest(taskDoc),candidateKey))note(problem.code,path,problem.message,t.id);}
  }
  for(const {record:t,path}of selected)if(t.record_version===2&&['accept','closeout'].includes(t.data.progress?.phase)){
    const checks=(t.data.progress.check_refs||[]).map(ref=>resolve(ref,'check')).filter(Boolean),reviews=(t.data.progress.review_refs||[]).map(ref=>resolve(ref,'review')).filter(Boolean);
    for(const problem of verificationIssues(t,checks,reviews))note(problem.code,path,problem.message,t.id);
  }
  const specifications=[...specs.keys()].map(path=>({path,sha256:digest(raw.get(path))}));
  const requirementInputs=[...requirements.values()].map(req=>({id:req.id,path:req.path,sha256:req.section.sha256,scenario_ids:[...req.scenarios.keys()]}));
  const definitions=[...documents].filter(([path])=>/\/(?:scope|tasks)\.md$/u.test(path)).map(([path,doc])=>({path,sha256:definitionDigest(doc)}));
  return {valid:issues.length===0,issues,requirement_count:requirements.size,scenario_count:[...requirements.values()].reduce((sum,r)=>sum+r.scenarios.size,0),record_count:records.size,specifications,requirements:requirementInputs,definitions,acceptance_verified:false,source_authenticity_verified:false,validation:'declared_spec_and_record_structure'};
}
