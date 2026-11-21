import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {readGit,readGitBlob,gitExecutable} from './git-read.mjs';
import {guardRoot,guardDirectory,guardIssue,inFileScope,protectedFile,iterationDefinition} from './operation-files.mjs';
import {createOperationReader,taskGate} from './operation-context.mjs';
import {validateGuardRequest} from './guard-request.mjs';
import {projectPath} from './project-paths.mjs';
import {parseWorkflowDocument,canonicalJson} from './workflow-docs.mjs';
import {inspectConfirmations,inspectCandidatePrerequisites,assertWorkflowPrerequisites} from './workflow-prerequisites.mjs';
import {readWorkflowLogs,decode} from './workflow-log.mjs';
import {verifyCommittedSpecReceipt} from './spec-sync.mjs';
import {checkArtifact} from './workflow-artifacts.mjs';
import {sha256} from './package.mjs';

const portable=p=>p.replaceAll('\\','/');
const names=s=>s.split('\0').filter(Boolean);
function query(root,args,{optional=false}={}) {
 let r;try{r=readGit(root,args);}catch(error){if(error.code==='USAGE')guardIssue('GIT_QUERY_SHAPE_UNSUPPORTED','Unsupported read-only Git query',JSON.stringify(args),'unknown');throw error;}
 if(r.error||r.status!==0&&!optional)guardIssue('GIT_OBSERVATION_UNAVAILABLE','Required Git observation failed',null,'unknown');
 return r.status===0?r.stdout:null;
}
const attrNames=text=>{const fields=text.split('\0');if(fields.at(-1)==='')fields.pop();return fields;};
function assertNoRepositoryFilters(root,common,reads) {
 const sources=[['.gitattributes',()=>reads.read('.gitattributes')],['.git/info/attributes',()=>reads.readExternal(path.join(common,'info/attributes'))]];
 for(const [relative,load] of sources) {
  const bytes=load();
  if(bytes===null)continue;
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{guardIssue('GIT_ATTRIBUTES_UNSUPPORTED','Git attributes are not valid UTF-8',relative,'unknown');}
  if(/(?:^|[\s])(?:filter\s*=|working-tree-encoding\s*=|ident\b)/imu.test(text))
   guardIssue('GIT_WORKTREE_CONVERSION_UNSUPPORTED','Git attributes can invoke external filters or undefined byte conversion',relative,'unknown');
 }
 const check=(args,allowUnspecified=false)=>{
  const fields=attrNames(query(root,args));
  if(fields.length%3!==0)guardIssue('GIT_ATTRIBUTE_OBSERVATION_INVALID','Git attribute response is incomplete',null,'unknown');
  for(let i=2;i<fields.length;i+=3)if(!['unspecified','unset'].includes(fields[i]))guardIssue('GIT_WORKTREE_CONVERSION_UNSUPPORTED','Git attribute conversion is active or cannot be ruled out',null,'unknown');
 };
 check(['check-attr','-z','filter','working-tree-encoding','--','.']);
 check(['check-attr','--cached','-z','filter','working-tree-encoding','--','.']);
}
const digestBytes=bytes=>bytes===null?null:sha256(bytes);
function headBlob(root,commit,file) {
 const rows=names(query(root,['ls-tree','-r','-z','--full-tree',commit,'--',file]));
 if(rows.length>1)guardIssue('GIT_TREE_UNSUPPORTED','Git tree returned an ambiguous path entry',file,'unknown');
 if(!rows.length)return null;
 const match=rows[0].match(/^(?:100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/u);
 if(!match)guardIssue('GIT_TREE_UNSUPPORTED','Git tree entry is not a regular file',file,'unknown');
 return match[1];
}
function worktreeBlob(root,file) {
 const value=(query(root,['hash-object','--path='+portable(file),'--',file],{optional:true})||'').trim();
 return /^[a-f0-9]{40}$/u.test(value)?value:null;
}
function indexEntries(text) {
 return names(text).map(row=>{const m=row.match(/^(100644|100755) ([a-f0-9]{40}) 0\t([\s\S]+)$/u);
  if(!m)guardIssue('GIT_INDEX_UNSUPPORTED','Index contains unresolved conflicts, links or submodules');return {mode:m[1],oid:m[2],path:m[3]};});
}
export function inspectGitOperationContext(projectRoot,{reads=createOperationReader(guardRoot(projectRoot))}={}) {
 const root=guardRoot(projectRoot),executable=gitExecutable();reads.readAbsolute(executable);
 const top=guardRoot(query(root,['rev-parse','--show-toplevel']).trim());
 if(top!==root)guardIssue('WRONG_WORKTREE','Actual repository worktree differs from the controlled project root');
 const common=guardRoot(query(root,['rev-parse','--path-format=absolute','--git-common-dir']).trim());
 assertNoRepositoryFilters(root,common,reads);
 const branch=query(root,['symbolic-ref','--quiet','--short','HEAD']).trim(),head=query(root,['rev-parse','--verify','HEAD']).trim();
 if(!/^[a-f0-9]{40}$/u.test(head))guardIssue('GIT_OBJECT_FORMAT_UNSUPPORTED','Git object format is not supported',null,'unknown');
 const indexPath=path.resolve(query(root,['rev-parse','--path-format=absolute','--git-path','index']).trim());
 const bytes=reads.readExternal(indexPath);if(fs.lstatSync(indexPath,{throwIfNoEntry:false})?.nlink>1)guardIssue('GIT_INDEX_UNSAFE','Git index has multiple hard links');
 if(reads.readExternal(indexPath+'.lock')!==null)guardIssue('GIT_INDEX_BUSY','Git index has an active or unresolved write lock',null,'unknown');
 reads.readExternal(path.join(common,'config'));
 const refs=new Map(query(root,['for-each-ref','--format=%(refname) %(objectname)','refs/heads','refs/remotes']).trim().split('\n').filter(Boolean).map(line=>{
  const m=line.match(/^(refs\/\S+) ([a-f0-9]{40})$/u);if(!m)guardIssue('GIT_REF_UNSUPPORTED','Git reference cannot be inspected',null,'unknown');return [m[1],m[2]];}));
 const index=query(root,['ls-files','--stage','-z']),entries=indexEntries(index);
 for(const e of entries)projectPath(root,e.path);
 const untracked=names(query(root,['ls-files','--others','--exclude-standard','-z']));
 return {git_common_dir:portable(common),worktree_root:portable(root),branch,head_commit:head,index_sha256:sha256(bytes||Buffer.alloc(0)),
  refs,entries,untracked,index_path:indexPath,signature:sha256(Buffer.from(canonicalJson({head,branch,index:sha256(bytes||Buffer.alloc(0)),refs:[...refs],entries,untracked}))),reads};
}
function remoteUrl(root,name) {
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(name))guardIssue('GIT_REMOTE_UNSUPPORTED','Remote name has an unsupported argument shape',null,'unknown');
 const urls=query(root,['remote','get-url','--push','--all',name]).trim().split('\n');
 if(urls.length!==1||!urls[0])guardIssue('GIT_REMOTE_AMBIGUOUS','Git remote must identify one exact push destination',null,'unknown');
 try{const url=new URL(urls[0]);if(url.password||url.search||url.hash)guardIssue('GIT_REMOTE_CREDENTIALS','Credential-bearing or parameterized remote URLs are unsupported',null,'unknown');}catch(e){if(e.code)throw e;}
 return urls[0];
}
function authorization(root,request,gate,context,{remote=null,target=context.branch}={}) {
 const {record}=assertWorkflowPrerequisites(inspectConfirmations(gate.view,{purpose:'operation_authorization',refs:request.authorization_refs}));
 const scope=record.data.operation_scope;
 if(!scope)guardIssue('GIT_AUTHORIZATION_SCOPE_MISSING','Git authorization has no machine-checkable operation scope',null,'unknown');
 const git=scope.git;
 if(!scope.actions.includes(request.operation.kind)||record.task!==gate.task.id||!git||guardRoot(git.git_common_dir)!==guardRoot(context.git_common_dir)||
  guardRoot(git.worktree_root)!==root||git.source_branch!==context.branch||git.target_branch!==target||remote&&git.remote_name!==remote)
  guardIssue('GIT_AUTHORIZATION_MISMATCH','Git authorization does not cover this action and exact repository target');
 if(!record.data.artifacts.some(a=>a.kind==='definition'&&a.path===request.task_ref.path))guardIssue('GIT_AUTHORIZATION_TASK_UNBOUND','Task authorization must bind the current task definition');
 const url=remoteUrl(root,git.remote_name);
 if(git.remote_url!==url)guardIssue('GIT_REMOTE_CHANGED','Remote URL differs from the authorized destination');
 if(scope.binding==='candidate'&&scope.candidate_commit!==context.head_commit)guardIssue('GIT_CANDIDATE_AUTHORIZATION_STALE','Fixed candidate authorization names another commit');
 return {scope,url,remote:git.remote_name};
}
function headBytes(root,commit,file) {
 const entries=names(query(root,['ls-tree','-r','-z','--full-tree',commit,'--',file]));
 if(!entries.length)return null;
 const match=entries.length===1&&entries[0].match(/^100(?:644|755) blob ([a-f0-9]{40})\t([\s\S]+)$/u);
 if(!match||match[2]!==file)guardIssue('GIT_TREE_PATH_UNSUPPORTED','Expected an exact regular file in the Git tree',file);
 return readGitBlob(root,match[1]);
}
const text=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes||Buffer.alloc(0));
function machineChangesAreLogged(root,file,before,after,reads) {
 const logs=readWorkflowLogs(root);
 for(const entry of logs)reads.read(entry.path);
 const current=parseWorkflowDocument(text(after),file),old=parseWorkflowDocument(text(before),file);
 for(const [id,record] of current.records) {
  if(old.records.has(id)&&canonicalJson(old.records.get(id))===canonicalJson(record))continue;
  if(!logs.some(e=>e.data.phase==='committed'&&e.data.intent==='apply'&&e.data.files.some(f=>f.path===file&&
    canonicalJson(parseWorkflowDocument(decode(f.after).toString('utf8'),file).records.get(id)||null)===canonicalJson(record))))
    guardIssue('GIT_UNLOGGED_RECORD','Proposed Git content contains an uncommitted semantic record',file);
 }
 for(const id of old.records.keys())if(!current.records.has(id))guardIssue('GIT_REMOVED_RECORD','Proposed Git content removes a workflow record',file);
}
function inspectPaths(root,files,gate,context,reads) {
 const scope=gate.closeout?gate.policy.closeout_paths:gate.policy.write_paths;
 let syncTargets;
 for(const file of files) {
  const absolute=projectPath(root,file),stat=fs.lstatSync(absolute,{throwIfNoEntry:false});
  if(stat&&!stat.isFile())guardIssue('GIT_NONREGULAR_PATH','Git path must be a regular file',file);
  if(stat?.nlink>1)guardIssue('GIT_HARD_LINK','Git write targets cannot include hard-linked files',file);
  const machine=/^docs\/iterations\/[^/]+\/(?:scope|tasks|verification)\.md$/u.test(file)||file==='docs/workflow/state.yaml';
  const framework=file==='.ai-workflow/manifest.json'||file==='.gitattributes';
  if(gate.closeout&&file.startsWith('docs/project/specs/')) {
   syncTargets??=specReceipt(root,gate).data.targets;
   const target=syncTargets.find(t=>t.path===file);
   if(!target||target.before_sha256!==digestBytes(headBytes(root,context.head_commit,file))||target.after_sha256!==digestBytes(reads.read(file)))
    guardIssue('GIT_SPEC_OUTPUT_MISMATCH','Specification is not the exact result of this task synchronization',file);
   continue;
  }
  if(!machine&&!framework&&!inFileScope(file,scope))guardIssue('GIT_PATH_OUTSIDE_TASK','Git content is outside the current confirmed task scope',file);
  if(protectedFile(file)&&!machine&&!framework)guardIssue('GIT_PROTECTED_PATH','Git content includes protected collaboration or framework resources',file);
  const working=reads.read(file);
  const before=machine||framework||iterationDefinition(file)?headBytes(root,context.head_commit,file):null;
  if(machine&&file.endsWith('.md'))machineChangesAreLogged(root,file,before,working,reads);
  if((file==='docs/workflow/state.yaml'||framework)&&worktreeBlob(root,file)!==headBlob(root,context.head_commit,file)) {
   const logs=readWorkflowLogs(root);for(const e of logs)reads.read(e.path);
   if(!logs.some(e=>e.data.phase==='committed'&&e.data.files.some(f=>f.path===file&&f.after_sha256===digestBytes(working))))
    guardIssue('GIT_UNLOGGED_METADATA','Changed Git metadata is not a committed workflow output',file);
  }
  // Definition changes are covered by the confirmed plan artifacts and the bound task definition
  // digest, which taskGate rechecks against the current files. Comparing against HEAD would reject
  // the documented task revision flow.
if(files.length>1000)guardIssue('GIT_PATH_LIMIT','Git path inventory exceeds its supported limit',null,'unknown');
 }
 if(files.length) {
  const attrs=query(root,['check-attr','-z','filter','working-tree-encoding','--',...files]).split('\0');
  for(let i=2;i<attrs.length;i+=3)if(attrs[i]&&!['unset','unspecified'].includes(attrs[i]))guardIssue('GIT_FILTER_UNSUPPORTED','External content filters or working-tree encodings are unsupported',null,'unknown');
 }
}
function sourceClean(root,context,reads,{allowedMetadata=[]}={}) {
 const staged=names(query(root,['diff','--no-ext-diff','--no-textconv','--name-only','-z','--cached',context.head_commit]));
 if(staged.length||context.untracked.length)guardIssue('GIT_CANDIDATE_UNSAVED','Candidate has staged or untracked changes');
 const changed=[];
 for(const entry of context.entries) {
  const working=reads.read(entry.path);
  if(working!==null&&worktreeBlob(root,entry.path)===entry.oid)continue;
  if(!allowedMetadata.includes(entry.path))guardIssue('GIT_CANDIDATE_UNSAVED','Candidate has unsaved source or document changes',entry.path);
  changed.push(entry.path);
 }
 return changed;
}
function inspectCandidateCoverage(root,gate,context,artifacts,specPaths=[]) {
 const main=context.refs.get('refs/heads/'+gate.policy.workspace.main_branch);
 if(!main)guardIssue('GIT_MAIN_UNAVAILABLE','Cannot identify the task baseline without the declared main branch',null,'unknown');
 const base=query(root,['merge-base',main,context.head_commit]).trim();
 const changed=names(query(root,['diff-tree','--no-commit-id','--name-only','-r','-z',base,context.head_commit]));
 const workflow=new Set(['docs/workflow/state.yaml','.ai-workflow/manifest.json','.gitattributes',
  ...['scope','design','tasks','verification'].map(name=>`${gate.task.iteration}/${name}.md`)]);
 for(const file of changed) {
  projectPath(root,file);
  if(workflow.has(file)||specPaths.includes(file))continue;
  if(protectedFile(file))guardIssue('GIT_PROTECTED_PATH','Candidate contains a protected path',file);
  if(gate.closeout&&file.endsWith('.md')&&inFileScope(file,gate.policy.closeout_paths))continue;
  if(!inFileScope(file,gate.policy.write_paths))guardIssue('GIT_PATH_OUTSIDE_TASK','Candidate includes a path outside the confirmed task',file);
  if(artifacts&&!artifacts.some(a=>a.kind==='git'?a.scope.some(p=>file===p||file.startsWith(p+'/')):a.kind==='file'&&a.path===file))
   guardIssue('GIT_CANDIDATE_UNREVIEWED_PATH','Candidate includes a path not covered by product checks and review',file);
 }
}
function specReceipt(root,gate) {
 const receipts=[...gate.view.getDoc(gate.task.iteration+'/verification.md').records.values()].filter(r=>r.kind==='spec_sync'&&r.task===gate.task.id);
 if(receipts.length!==1)guardIssue('GIT_SPEC_CLOSEOUT_MISSING','Final integration requires its specification synchronization receipt');
 const receipt=receipts[0],entry=verifyCommittedSpecReceipt(root,receipt);
 const bytes=gate.view.readFile(entry.path);
 if(!bytes?.equals(entry.bytes))guardIssue('GIT_SPEC_RECEIPT_CHANGED','Specification synchronization journal changed');
 return receipt;
}
function specCloseout(root,gate,context) {
 const receipt=specReceipt(root,gate);
 const paths=gate.inventory.find(i=>i.root==='docs/project/specs').paths;
 for(const file of paths)if(worktreeBlob(root,file)!==headBlob(root,context.head_commit,file))guardIssue('GIT_SPEC_UNSAVED','Synchronized specifications are not in the fixed candidate',file);
 for(const target of receipt.data.targets)if(digestBytes(gate.view.readFile(target.path))!==target.after_sha256)guardIssue('GIT_SPEC_CLOSEOUT_CHANGED','Synchronized specification differs from the receipt',target.path);
 return receipt.data.targets.map(target=>target.path);
}
export async function inspectGitOperation(projectRoot,input,options={}) {
 const root=guardRoot(projectRoot),request=validateGuardRequest(input),reads=options.reads||createOperationReader(root),observed=options.observed||{};
 const operation=request.operation;
 if(!operation.kind.startsWith('git.'))guardIssue('GIT_OPERATION_UNSUPPORTED','Expected a supported structured Git operation',null,'unknown');
 guardDirectory(root,operation.cwd);
 const gate=taskGate(root,request,reads,observed,{mode:'git'}),context=inspectGitOperationContext(root,{reads});
 const publicContext=()=>({git_common_dir:context.git_common_dir,worktree_root:context.worktree_root,branch:context.branch,head_commit:context.head_commit,index_sha256:context.index_sha256});
 observed.git=publicContext();let auth;
 if(operation.kind==='git.push'&&operation.target_branch===gate.policy.workspace.main_branch)guardIssue('GIT_MAIN_PUSH_FORBIDDEN','Direct main-branch pushes are not supported; use the integration gate');
 if(operation.kind==='git.integrate') {
  if(operation.target_branch!==gate.policy.workspace.main_branch)guardIssue('GIT_INTEGRATION_TARGET','Integration must target the confirmed main branch');
  if(typeof options.platformObserver!=='function')guardIssue('GIT_PLATFORM_OBSERVATION_MISSING','Final integration requires a controlled platform observer',null,'unknown');
  auth=authorization(root,request,gate,context,{target:operation.target_branch});
 }else auth=authorization(root,request,gate,context,{remote:operation.kind==='git.push'?operation.remote_name:null,target:operation.target_branch||context.branch});
 if(operation.remote_url&&operation.remote_url!==auth.url)guardIssue('GIT_REMOTE_CHANGED','Requested remote URL differs from actual and authorized Git configuration');
 observed.git.remote_url=auth.url;
 if(['git.stage','git.commit'].includes(operation.kind)) {
  if(operation.kind==='git.commit'&&operation.index_sha256!==context.index_sha256)guardIssue('GIT_INDEX_CHANGED','Actual index differs from the supplied commit before image');
  const files=operation.kind==='git.stage'?names(query(root,['ls-files','--cached','--others','--exclude-standard','-z','--',...operation.paths])):
    names(query(root,['diff','--no-ext-diff','--no-textconv','--name-only','-z','--cached',context.head_commit]));
  if(operation.kind==='git.commit') {
   if(!isDeepStrictEqual([...new Set(files)].sort(),[...operation.paths].sort()))guardIssue('GIT_INDEX_SCOPE_MISMATCH','Commit paths do not exactly describe the actual staged changes');
   const indexByPath=new Map(context.entries.map(e=>[e.path,e]));
   for(const file of operation.paths) {
    const entry=indexByPath.get(file),working=reads.read(file);
    if(!entry&&working===null)continue;
    if(!entry||working===null||worktreeBlob(root,file)!==entry.oid)guardIssue('GIT_INDEX_WORKTREE_MISMATCH','Staged bytes differ from the current authorized worktree image',file);
   }
  }
  if(operation.kind==='git.stage')for(const p of operation.paths)if(!inFileScope(p,gate.closeout?gate.policy.closeout_paths:gate.policy.write_paths)&&!/^docs\/iterations\/[^/]+\/(?:scope|tasks|verification)\.md$|^docs\/workflow\/state\.yaml$/u.test(p)&&!['.gitattributes','.ai-workflow/manifest.json'].includes(p)&&!(gate.closeout&&files.includes(p)&&p.startsWith('docs/project/specs/')))guardIssue('GIT_STAGE_SCOPE','Stage request is broader than its confirmed paths',p);
  inspectPaths(root,[...new Set(files)],gate,context,reads);
 }else {
  if(operation.candidate_commit!==context.head_commit)guardIssue('GIT_CANDIDATE_CHANGED','Requested candidate is not the actual task branch HEAD');
  if(operation.kind==='git.push') {
   sourceClean(root,context,reads);
   if(operation.target_branch!==context.branch)guardIssue('GIT_PUSH_TARGET','Task push must name the actual task branch');
   if(operation.intent==='progress_backup') {
    if(!['paused','blocked'].includes(gate.position.status)||!gate.position.checkpoint_ref)guardIssue('GIT_BACKUP_POSITION','Progress backup requires an explicit paused or blocked checkpoint');
    inspectCandidateCoverage(root,gate,context,null);
   } else {
    const {artifacts}=assertWorkflowPrerequisites(inspectCandidatePrerequisites(gate.view,{task:gate.task,position:gate.position,requireAcceptance:gate.closeout}));
    inspectCandidateCoverage(root,gate,context,artifacts,gate.closeout?specCloseout(root,gate,context):[]);
   }
  }else {
   if(!gate.closeout)guardIssue('GIT_ACCEPTANCE_REQUIRED','Final integration requires accepted closeout');
   const {artifacts}=assertWorkflowPrerequisites(inspectCandidatePrerequisites(gate.view,{task:gate.task,position:gate.position,requireAcceptance:true}));
   const base=context.refs.get('refs/heads/'+operation.target_branch);
   if(!base||base!==operation.base_commit)guardIssue('GIT_MAIN_CHANGED','Current main branch differs from the integration before image');
   observed.git.base_commit=base;inspectCandidateCoverage(root,gate,context,artifacts,specCloseout(root,gate,context));
   const check=gate.view.getRef(operation.integration_check_ref,'check'),expected={kind:'git.integration',git_common_dir:context.git_common_dir,remote_url:auth.url,target_branch:operation.target_branch,base_commit:base,candidate_commit:context.head_commit,pr:operation.pr};
   if(check.iteration!==gate.task.iteration||check.task!==gate.task.id||check.data.result!=='passed'||!isDeepStrictEqual(check.data.operation_context,expected)||!check.data.artifacts.every(a=>checkArtifact(root,a,{read:reads.read}).valid)||!check.data.evidence.every(a=>checkArtifact(root,a,{read:reads.read}).valid))guardIssue('GIT_INTEGRATION_CHECK_STALE','Final integration check does not match the actual current pair');
   const changed=sourceClean(root,context,reads,{allowedMetadata:[gate.task.iteration+'/verification.md','docs/workflow/state.yaml',gate.task.iteration+'/tasks.md']});
   if(changed.length) {
    const logs=readWorkflowLogs(root);for(const e of logs)reads.read(e.path);
    const receipt=logs.find(e=>e.data.phase==='committed'&&e.data.request.action==='record'&&e.data.request.data.record?.id===check.id&&
      e.data.files.every(f=>digestBytes(reads.read(f.path))===f.after_sha256&&digestBytes(headBytes(root,context.head_commit,f.path))===f.before_sha256));
    if(!receipt)guardIssue('GIT_INTEGRATION_METADATA_UNSAVED','Only the exact final-check semantic output may remain outside the fixed candidate');
   }
   let platform;
   try{platform=await options.platformObserver({projectRoot:root,git_common_dir:context.git_common_dir,remote_url:auth.url,target_branch:operation.target_branch,pr:operation.pr,base_commit:base,candidate_commit:context.head_commit});}
   catch{guardIssue('GIT_PLATFORM_OBSERVATION_FAILED','Platform observation failed',null,'unknown');}
   if(platform?.status!=='observed')guardIssue('GIT_PLATFORM_OBSERVATION_UNKNOWN','Platform did not provide current PR facts',null,'unknown');
   if(platform.state!=='open'||platform.remote_url!==auth.url||platform.target_branch!==operation.target_branch||platform.base_commit!==base||platform.candidate_commit!==context.head_commit||platform.pr!==operation.pr)guardIssue('GIT_PLATFORM_OBJECT_MISMATCH','Platform PR or main branch does not match the actual integration request');
  }
 }
 const verify=()=>{if(inspectGitOperationContext(root,{reads}).signature!==context.signature||remoteUrl(root,auth.remote)!==auth.url)guardIssue('GIT_FACT_CHANGED','Git facts changed during operation inspection');};
 const refs=[...context.refs].filter(([r])=>r==='refs/heads/'+context.branch||r==='refs/heads/'+gate.policy.workspace.main_branch).map(([ref,commit])=>({kind:'git-ref',git_common_dir:context.git_common_dir,ref,commit}));
 if(!options.reads){verify();reads.verify();}
 return {gate,verify,read_set:refs,observed};
}
