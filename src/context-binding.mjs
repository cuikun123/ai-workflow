import {createHash} from 'node:crypto';
import {WorkflowError} from './errors.mjs';
import {inspectProjectContext} from './foundation-context.mjs';
import {readProjectFile} from './project-paths.mjs';
import {canonicalJson,parseWorkflowDocument,definitionDigest} from './workflow-docs.mjs';
import {readWorkflowLogs,decode} from './workflow-log.mjs';
import {planWorkflowOperation} from './workflow-journal.mjs';
import {sha256} from './package.mjs';
import {validateStateYaml} from './state.mjs';

export const contextMethod='iterlane.foundation-context/v1';
export const bindingRecordId=id=>'context-'+createHash('sha256').update(id).digest('hex');
export const contextError=(code,message,path=null)=>{throw new WorkflowError('CONFLICT',message,[{code,message,path}]);};
export const quoteReason=reason=>reason.split(/\r?\n/u).map(line=>'> '+line.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')).join('\n');

export function contextArtifacts(context,taskDefinition){
  const artifacts=[...context.framework.files,context.project_rules,...context.foundation].map(e=>({kind:'file',...e}));
  artifacts.push(taskDefinition);if(artifacts.length>1000)contextError('CONTEXT_ARTIFACT_LIMIT','Task context exceeds the artifact limit');return artifacts;
}
export function contextBindingRecord(context,task,definition,request,operationId){
  return {record_version:2,id:bindingRecordId(request.request_id),kind:'check',iteration:task.iteration,task:task.id,
    source:{role:'tool',reference:'operation:'+operationId,text:'Tool supplied current context; this does not certify understanding, compliance or business checks'},
    data:{result:'passed',check_type:'observation',command:null,exit_code:null,test_count:null,method:contextMethod,expected:context.snapshot_sha256,actual:context.snapshot_sha256,
      covers:[],evidence:[definition],artifacts:contextArtifacts(context,definition)}};
}
export function planContextBinding(root,input,options={}){if(input?.action!=='context_bind')contextError('INVALID_CONTEXT_BIND_REQUEST','Expected the context_bind semantic operation');return planWorkflowOperation(root,input,options);}

export function assertTaskContextBinding(root,task,{context,read=path=>readProjectFile(root,path),operationId=null}={}){
  const state=validateStateYaml(new TextDecoder('utf-8',{fatal:true}).decode(read('docs/workflow/state.yaml')));
  if(state.current_iteration!==task.iteration||state.current_task!==task.id||state.status==='completed')contextError('CONTEXT_BINDING_SUBJECT','Binding check requires the selected unfinished task');
  context ||= inspectProjectContext(root);const path=task.iteration+'/verification.md',bytes=read(path);
  const current=bytes===null?null:parseWorkflowDocument(new TextDecoder('utf-8',{fatal:true}).decode(bytes),path);
  const taskPath=task.iteration+'/tasks.md',taskBytes=read(taskPath),definition={kind:'definition',path:taskPath,sha256:definitionDigest(parseWorkflowDocument(new TextDecoder('utf-8',{fatal:true}).decode(taskBytes),taskPath))};
  const entries=readWorkflowLogs(root).filter(e=>e.data.journal_version===3&&e.data.phase==='committed'&&e.data.intent==='apply'&&e.data.request.action==='context_bind'&&e.data.request.data.iteration===task.iteration&&e.data.request.data.task===task.id&&(!operationId||e.data.operation_id===operationId));
  for(const entry of entries){const j=entry.data;
    if(j.request.data.expected_snapshot!==context.snapshot_sha256)continue;
    const file=j.files.find(f=>f.path===path),saved=file&&parseWorkflowDocument(decode(file.after).toString('utf8'),path).records.get(bindingRecordId(j.request.request_id));
    const actual=current?.records.get(bindingRecordId(j.request.request_id)),expected=contextBindingRecord(context,task,definition,j.request,j.operation_id);
    if(saved&&actual&&canonicalJson(saved)===canonicalJson(actual)&&canonicalJson(actual)===canonicalJson(expected)){
      const receiptBytes=read(entry.path);if(receiptBytes===null||sha256(receiptBytes)!==sha256(entry.bytes))contextError('CONTEXT_BINDING_LOG_CHANGED','Binding receipt changed during verification',entry.path);
      return {binding_ref:{path,record_id:actual.id},operation_id:j.operation_id,snapshot_sha256:context.snapshot_sha256};}
  }
  contextError(entries.length?'STALE_CONTEXT_BINDING':'CONTEXT_BINDING_REQUIRED',entries.length?'Current task context or definition changed; inspect, check impact and bind again':'Current task requires its own committed context binding',taskPath);
}
