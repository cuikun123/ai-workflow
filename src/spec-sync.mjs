import {WorkflowError} from './errors.mjs';
import {parseSpecification,digest} from './spec-docs.mjs';
import {inspectSpecifications} from './spec-deltas.mjs';
import {changeSpecInventory} from './spec-inventory.mjs';
import {readWorkflowLogs,decode} from './workflow-log.mjs';
import {parseWorkflowDocument,canonicalJson} from './workflow-docs.mjs';

const fail=message=>{throw new WorkflowError('CONFLICT',message);};
const covers=(artifact,path)=>artifact.kind==='git'?artifact.scope.some(scope=>path===scope||path.startsWith(scope+'/')):artifact.path===path;
export function assertUnchangedSpecifications(view){
  const basis=new Map(view.state.basis.filter(x=>x.path.startsWith('docs/project/specs/')).map(x=>[x.path,x.sha256]));
  for(const [path,sha]of basis){const bytes=view.readFile(path);if(bytes===null||digest(bytes)!==sha)fail('Undeclared specification changes cannot be adopted');}
  for(const path of view.inventory.find(x=>x.root==='docs/project/specs').paths)if(!basis.has(path))fail('New effective specifications are outside the recorded task baseline');
}
export function planSpecSynchronization(view,task,{requestId,operationId,acceptanceRef,checkRefs,reviewRefs}){
  const checked=inspectSpecifications(view.root,{read:view.readFile,inventory:view.inventory,taskRef:{path:task.iteration+'/tasks.md',record_id:task.id}});
  if(!checked.valid)fail('Specification change cannot be synchronized: '+checked.issues.map(x=>x.code).join(', '));
  const acceptance=view.getRef(acceptanceRef,'confirmation'),deltas=task.data.delta_refs.map(ref=>({ref,record:view.getRef(ref,'spec_delta')})),operations=deltas.flatMap(({ref,record})=>record.data.operations.map(operation=>({ref,operation})));
  const definitionPaths=new Set([task.iteration+'/tasks.md',...task.data.delta_refs.map(ref=>ref.path)]);
  for(const path of definitionPaths)if(!acceptance.data.artifacts.some(artifact=>artifact.kind==='definition'&&artifact.path===path))fail('Acceptance must bind the task and delta definitions: '+path);
  for(const {operation}of operations)if(acceptance.data.artifacts.some(artifact=>covers(artifact,operation.path)))fail('Accepted candidate includes mutable effective specifications; use candidate/delta definitions');
  for(const artifact of acceptance.data.artifacts)if(covers(artifact,'docs/workflow/state.yaml')||artifact.kind!=='definition'&&(covers(artifact,task.iteration+'/verification.md')||covers(artifact,task.iteration+'/tasks.md')))fail('Accepted candidate includes generated mutable state/records');
  const grouped=new Map(),files=[],targets=[];
  for(const {record}of deltas)for(const op of record.data.operations){if(!grouped.has(op.path))grouped.set(op.path,{operations:[],header:record.data.new_spec_headers.find(h=>h.path===op.path)?.markdown});grouped.get(op.path).operations.push(op);}
  for(const [path,group]of [...grouped].sort(([a],[b])=>a.localeCompare(b))){
    const before=view.readFile(path);let after;
    if(before===null){
      if(!group.header||group.operations.some(op=>op.action!=='ADDED'))fail('New specification requires explicit added requirements and a header');
      after=group.header+(group.header.endsWith('\n')?'':'\n');
      for(const op of group.operations){if(after&&!after.endsWith('\n'))after+='\n';after+=op.after_markdown;}
    }else{
      const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(before),parsed=parseSpecification(text,path),changes=[];
      if(parsed.issues.some(issue=>issue.code!=='MISSING_REQUIREMENT'))fail('Affected specification needs format repair before synchronization');
      after=text;
      for(const op of group.operations)if(op.action!=='ADDED'){
        const section=parsed.sections.get(op.requirement_id);if(!section||section.sha256!==op.before_sha256)fail('Requirement preimage changed');
        const replacement=op.action==='REMOVED'?'':op.after_markdown;
        if(replacement&&section.end<text.length&&!replacement.endsWith('\n'))fail('Replacement needs a final newline before following content');
        changes.push({start:section.start,end:section.end,replacement});
      }
      for(const change of changes.sort((a,b)=>b.start-a.start))after=after.slice(0,change.start)+change.replacement+after.slice(change.end);
      for(const op of group.operations)if(op.action==='ADDED'){if(after&&!after.endsWith('\n'))after+='\n';after+=op.after_markdown;}
    }
    const bytes=Buffer.from(after,'utf8');if(bytes.length>1024*1024||new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)!==after)fail('Specification result is oversized or cannot roundtrip UTF-8');
    files.push({path,kind:'file',before,after:bytes});targets.push({path,before_sha256:before===null?null:digest(before),after_sha256:digest(bytes)});
  }
  if(!operations.length){
    if(!task.data.spec_change_reason.trim())fail('No-change closeout needs an explicit reason');
    assertUnchangedSpecifications(view);
  }
  const receipt={record_version:2,id:'spec-sync-'+operationId,kind:'spec_sync',iteration:task.iteration,task:task.id,source:{role:'tool',reference:'operation:'+operationId,text:'Computed specification synchronization; not a new human approval'},data:{delta_refs:task.data.delta_refs,acceptance_ref:acceptanceRef,check_refs:checkRefs,review_refs:reviewRefs,request_id:requestId,operation_id:operationId,targets,operations:operations.map(({ref,operation})=>({...ref,operation_id:operation.operation_id})),result:operations.length?'synced':'not_needed'}};
  return {files,receipt,inventory:changeSpecInventory(view.inventory,files.map(f=>({path:f.path,exists:true})))};
}
export function verifyCommittedSpecReceipt(root,receipt){
  const entry=readWorkflowLogs(root).find(x=>x.data.operation_id===receipt.data.operation_id);
  if(!entry||entry.data.journal_version!==2||entry.data.phase!=='committed'||entry.data.intent!=='apply'||entry.data.request.action!=='spec_sync'||entry.data.request.request_id!==receipt.data.request_id||entry.data.request.data.iteration!==receipt.iteration||entry.data.request.data.task!==receipt.task||receipt.source.reference!=='operation:'+entry.data.operation_id)fail('Synchronization receipt has no matching committed operation');
  const file=entry.data.files.find(f=>f.path===receipt.iteration+'/verification.md');if(!file)fail('Committed synchronization has no receipt document');
  const saved=parseWorkflowDocument(decode(file.after).toString('utf8'),file.path).records.get(receipt.id);
  if(!saved||canonicalJson(saved)!==canonicalJson(receipt))fail('Synchronization receipt differs from its committed operation');
  return entry;
}
