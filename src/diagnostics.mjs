import * as fs from 'node:fs';import {resolve} from 'node:path';import {isDeepStrictEqual} from 'node:util';
import metadata from '../package.json' with {type:'json'};
import {assertSafeRoot} from './paths.mjs';import {readProjectFile,projectPath} from './project-paths.mjs';
import {sha256,checkPackage} from './package.mjs';import {parseStrictJson} from './workflow-docs.mjs';import {validateStateYaml} from './state.mjs';
import {readDiagnosticInstallationManifest,inspectInstallationResources} from './installation.mjs';import {scanOperations} from './install-journal.mjs';import {readWorkflowLogs,exact,uuid} from './workflow-log.mjs';import {inspectWorkflowState} from './workflow-status.mjs';
import {readVersionLogs} from './version-log.mjs';

export function inspectDiagnosticEnvironment({nodeVersion=process.versions.node,platform=process.platform}={}){const [major,minor,patch]=nodeVersion.split('.').map(Number);return {node_version:nodeVersion,runtime_supported:major===24&&(minor>18||minor===18&&patch>=0),platform,platform_verified:platform==='win32',dependencies:'loaded',network_probe:'not_run'};}
export function inspectWriteLock(root){
  const bytes=readProjectFile(root,'.ai-workflow/.local/write.lock');if(bytes===null)return {status:'absent'};
  let owner;try{owner=parseStrictJson(bytes.toString('utf8'));}catch{return {status:'invalid'};}
  if(!exact(owner,['lock_version','operation_id','nonce','pid','project_root','created_at'])||owner.lock_version!==1||!uuid(owner.operation_id)||!uuid(owner.nonce)||owner.project_root!==root||!Number.isSafeInteger(owner.pid)||owner.pid<1||typeof owner.created_at!=='string'||!Number.isFinite(Date.parse(owner.created_at)))return {status:'invalid'};
  let status='active';try{process.kill(owner.pid,0);}catch(e){status=e.code==='ESRCH'?'stale':'unknown';}
  return {status,operation_id:owner.operation_id,nonce:owner.nonce,pid:owner.pid};
}
export function validateClientEvidence(value,root){
  if(!exact(value,['evidence_version','project_root','observed_at','client','status','failure'])||value.evidence_version!==1||typeof value.project_root!=='string'||resolve(value.project_root)!==root||typeof value.observed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value.observed_at)||!Number.isFinite(Date.parse(value.observed_at))||typeof value.client!=='string'||!value.client.trim()||value.client.length>64||!['connected','failed','unknown'].includes(value.status)||!['transport','authentication','timeout','ui_control','unknown',null].includes(value.failure)||value.status==='failed'&&value.failure===null||value.status!=='failed'&&value.failure!==null)return null;
  const observed=new Date(value.observed_at).toISOString();if(observed!==value.observed_at&&observed.replace('.000Z','Z')!==value.observed_at)return null;
  return {status:'reported_'+value.status,failure:value.failure,observed_at:observed,source_authenticity_verified:false,probe:'not_run'};
}
export function diagnoseProject(projectRoot,{packageRoot,clientEvidence}={}){
  const environment=inspectDiagnosticEnvironment(),findings=[],recovery_candidates=[],report={report_version:1,tool:{name:metadata.name,version:metadata.version},project:resolve(projectRoot),environment,client:{status:'not_probed',source_authenticity_verified:false},local_valid:false,findings,recovery_candidates,source_authenticity_verified:false,acceptance_verified:false};
  const add=(code,category,impact,next_step,evidence=[],severity='error')=>findings.push({code,category,severity,evidence,impact,next_step});
  const errorFinding=(error,category,path)=>{const code=['EACCES','EPERM'].includes(error?.code)?'PERMISSION_DENIED':error?.code==='PACKAGE_INVALID'&&category==='environment'?'RUNTIME_DEPENDENCY':'PATH_UNSUPPORTED';add(code,category,'无法读取或核实此范围，检查结果保持未知。','保留现场，核对路径、权限和匹配版本工具后重新诊断。',[{path,error_code:error?.code||'UNKNOWN'}]);};
  let root;try{root=fs.realpathSync.native(assertSafeRoot(projectRoot));report.project=root;}catch(error){errorFinding(error,'environment',null);return report;}
  if(!environment.runtime_supported)add('RUNTIME_UNSUPPORTED','environment','当前Node版本不在已支持运行范围。','使用Node 24.18.x或更高的24主版本。',[{node_version:environment.node_version}]);
  if(!environment.platform_verified)add('PLATFORM_UNVERIFIED','environment','此平台尚未完成支持组合验证。','按支持环境运行，或单独验证平台。',[],'warning');
  try{fs.accessSync(root,fs.constants.R_OK);fs.accessSync(root,fs.constants.W_OK);report.environment.project_access='read_write_check_passed';}catch(error){report.environment.project_access='unknown';errorFinding(error,'environment',null);}
  let source=null;if(packageRoot)try{const checked=checkPackage(packageRoot),manifest=JSON.parse(fs.readFileSync(resolve(packageRoot,'resource-manifest.json'),'utf8'));source={name:checked.name,version:checked.version,source_manifest_sha256:sha256(fs.readFileSync(resolve(packageRoot,'resource-manifest.json'))),state_schemas:manifest.package.state_schemas};}catch(error){add('SOURCE_PACKAGE_INVALID','version','指定来源包无法匹配本运行工具。','使用对应项目和操作日志的固定来源包。',[{error_code:error.code||'UNKNOWN'}]);}
  let manifest=null,resourceIssues=null,versionMismatch=false;
  try{
    const bytes=readProjectFile(root,'.ai-workflow/manifest.json');
    if(bytes===null)add('INSTALLATION_MISSING','installation','尚无已提交安装清单；可能未安装或初始化中断。','核对安装日志；新项目使用完整固定包init，不能认领未知元数据。',[{path:'.ai-workflow/manifest.json'}]);
    else{let raw;try{raw=parseStrictJson(bytes.toString('utf8'));}catch{add('MANIFEST_INVALID','installation','安装清单损坏，无法核实资源归属。','保留清单与日志；使用匹配来源检查，不自动重建。',[{path:'.ai-workflow/manifest.json'}]);}
      if(raw!==undefined){if(typeof raw?.package?.version==='string'&&raw.package.version!==metadata.version){versionMismatch=true;const version=/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]{1,48})?$/u.test(raw.package.version)?raw.package.version:'<unrecognized>';add('VERSION_MISMATCH','version','项目和运行工具版本不同，不能按本版本认领或修改。','使用项目锁定版本的工具；升级属于独立流程。',[{path:'.ai-workflow/manifest.json',installed_version:version,runtime_version:metadata.version}]);}
      else try{manifest=readDiagnosticInstallationManifest(root);}catch{add('MANIFEST_INVALID','installation','安装清单结构或身份不符。','保留原记录并核对匹配版本。',[{path:'.ai-workflow/manifest.json'}]);}}
    }
    if(manifest){resourceIssues=inspectInstallationResources(root,manifest);
      for(const issue of resourceIssues.issues)errorFinding(issue.error,'resource',issue.path);
      for(const path of resourceIssues.missing)add('RESOURCE_MISSING','resource','受管理资源缺失。','使用相同来源包显式recover --repair；先查看预览。',[{path}]);
      for(const path of resourceIssues.changed){const entry=manifest.files.find(f=>f.path===path),actual=readProjectFile(root,path);add('RESOURCE_CHANGED','resource','受管理资源或区块内容已变化，不能覆盖。','保留改动并核对归属；repair不会覆盖这些变化。',[{path,...(entry?{expected_sha256:entry.sha256,actual_sha256:actual===null?null:sha256(actual)}:{block_changed:true})}]);}
      for(const path of resourceIssues.extra)add('RESOURCE_UNLISTED','resource','框架管理目录内存在未列入清单的文件。','保留外来文件并核对归属，不自动清理。',[{path}]);
      for(const block of resourceIssues.missingBlocks)add('MANAGED_BLOCK_MISSING','resource','框架导航/忽略/属性管理区块缺失。','相同来源包显式repair前预览，保留区块外内容。',[{path:block.path,kind:block.kind}]);
      if(source&&!isDeepStrictEqual(source,manifest.package))add('SOURCE_VERSION_MISMATCH','version','来源包与已安装版本或摘要不同。','使用完全相同来源，不能用repair换包。',[{installed_version:manifest.package.version,source_version:source.version}]);
    }
  }catch(error){errorFinding(error,'resource','.ai-workflow/manifest.json');}
  const operations=[];let journalInvalid=false;
  const badJournal=(kind,error,path)=>{journalInvalid=true;add('JOURNAL_INVALID','operation','操作日志损坏、不匹配或无法读取，自动恢复归属未知。','保留日志和目标，不挑选最新操作；使用匹配版本核对。',[{namespace:kind,path,error_code:error.code||'UNKNOWN'}]);};
  let versions=[];try{versions=readVersionLogs(root,{onError:(e,p)=>badJournal('version',e,p)});for(const v of versions)operations.push({kind:'version',operation_id:v.data.operation_id,phase:v.data.phase,intent:v.data.intent,nonce:v.data.nonce,package:v.data.package,path:v.path});}catch(e){badJournal('version',e,null);}
  report.migrated_requests=versions.flatMap(v=>v.data.projections.map(p=>({path:p.path,source_path:p.source_path,source_operation_id:p.source_operation_id,source_version:p.source_package.version,source_authenticity_verified:false})));
  for(const [kind,read]of (versionMismatch?[]:[['installation',scanOperations],['workflow',readWorkflowLogs]]))try{for(const item of read(root,{onError:(error,path)=>badJournal(kind,error,path)}))operations.push({kind,operation_id:item.data.operation_id,phase:item.data.phase,intent:item.data.intent,nonce:item.data.nonce,package:item.data.package,path:item.path});}catch(error){badJournal(kind,error,null);}
  report.operation_checks=versionMismatch?'not_assessed_for_version':'performed';
  report.operations=operations.map(({nonce,package:pkg,...item})=>item);const pending=operations.filter(o=>!['committed','rolled_back'].includes(o.phase));
  for(const op of pending)add(op.kind==='version'?'VERSION_INCOMPLETE':op.kind==='installation'?'INSTALLATION_INCOMPLETE':'WORKFLOW_INCOMPLETE','operation','已识别未完成写入，不能继续新操作。','按明确operation-id预览resume/undo；恢复前仍检查当前目标。',[{path:op.path,operation_id:op.operation_id,intent:op.intent}]);
  if(pending.length>1)add('MULTIPLE_OPERATIONS','operation','多个未完成操作无法唯一恢复。','保留全部现场，核对写入归属与先后依赖，不按时间选择。',pending.map(o=>({operation_id:o.operation_id,namespace:o.kind})));
  let lock={status:'unknown'};try{lock=inspectWriteLock(root);}catch(error){errorFinding(error,'operation','.ai-workflow/.local/write.lock');}
  report.lock={status:lock.status,...(lock.operation_id?{operation_id:lock.operation_id,pid:lock.pid}:{})};
  if(lock.status!=='absent')add({active:'LOCK_ACTIVE',stale:'LOCK_STALE',invalid:'LOCK_INVALID',unknown:'LOCK_UNKNOWN'}[lock.status],'operation',lock.status==='active'?'项目写入者仍存活。':'存在遗留或无法核实的写锁。','核对操作与nonce和进程结束事实；不要按锁年龄删除。',[{path:'.ai-workflow/.local/write.lock',...(lock.operation_id?{operation_id:lock.operation_id,pid:lock.pid}:{})}]);
  const owner=lock.operation_id?operations.find(o=>o.operation_id===lock.operation_id&&o.nonce===lock.nonce):null;
  if(lock.operation_id&&!owner&&!versionMismatch)add('LOCK_OWNERSHIP_UNKNOWN','operation','写锁没有对应的有效操作日志。','保留锁，不能自动认领或删除。',[{operation_id:lock.operation_id}]);
  let state=null;
  if(!versionMismatch)try{const bytes=readProjectFile(root,'docs/workflow/state.yaml');if(bytes===null){if(!pending.some(o=>o.kind==='installation'))add('STATE_MISSING','state','缺少工作书签，不能推断当前进度。','核对匹配操作日志或真实任务依据，不通过init重置。',[{path:'docs/workflow/state.yaml'}]);}
    else{try{state=validateStateYaml(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{add('STATE_INVALID','state','书签结构损坏，当前工作位置不能可靠恢复。','保留原文件；只有明确匹配日志才能恢复，不猜任务或revision。',[{path:'docs/workflow/state.yaml'}]);}
      if(state){report.state={revision:state.revision,current_iteration:state.current_iteration,current_task:state.current_task,phase:state.phase,status:state.status,waiting_for:state.waiting_for};const inspected=inspectWorkflowState(root);
      for(const issue of inspected.issues){if(issue.code==='STALE_PLAN_CONFIRMATION')add('PLAN_CONFIRMATION_STALE','state','任务验证政策对应的计划确认已失效。','核对政策与定义差异后登记实际的新计划确认；refresh不是重新批准。',[{path:issue.path,issue_code:issue.code}]);else add(issue.code==='STALE_BASIS'?'STATE_STALE':'DOCUMENT_INVALID',issue.code==='STALE_BASIS'?'state':'document','当前书签依据或文档/记录不一致。',issue.code==='STALE_BASIS'?'核对真实资料后显式recover --refresh；不借查询改书签。':'修正已核实的文档或记录；未知位置不自动重建。',[{path:issue.path,issue_code:issue.code}]);}}
    }
  }catch(error){errorFinding(error,'state','docs/workflow/state.yaml');}
  if(clientEvidence!==undefined){const client=validateClientEvidence(clientEvidence,root);if(client){report.client=client;if(client.failure)add('CLIENT_'+client.failure.toUpperCase(),'client','调用方报告客户端失败；这不证明框架资源损坏。','根据连接观察排查客户端、认证、上游或界面；不自动回滚安装。',[{failure:client.failure,observed_at:client.observed_at}]);}else add('CLIENT_EVIDENCE_INVALID','client','客户端观察不符合协议或不是当前项目。','提供有界的当前项目观察；不要附凭据或自由文本日志。',[]);}
  const safe=!journalInvalid&&!versionMismatch&&pending.length<=1&&['absent','stale'].includes(lock.status)&&(lock.status==='absent'||!!owner);
  if(safe){const recoverable=pending[0]||(owner?.phase==='committed'?owner:null);if(recoverable&&(!owner||owner.operation_id===recoverable.operation_id))recovery_candidates.push({kind:recoverable.kind,operation_id:recoverable.operation_id,modes:recoverable.phase==='committed'?['resume']:recoverable.intent==='undo'?['undo']:['resume','undo'],...(recoverable.kind==='workflow'?{expected_revision:state?.revision??null}:{requires_identical_source:true}),preflight_required:true});
    else if(!recoverable&&manifest&&resourceIssues&&!resourceIssues.changed.length&&!resourceIssues.extra.length&&(resourceIssues.missing.length||resourceIssues.missingBlocks.length))recovery_candidates.push({kind:'repair',requires_identical_source:true,preflight_required:true});}
  report.local_valid=!findings.some(f=>f.category!=='client'&&f.severity==='error');return report;
}
