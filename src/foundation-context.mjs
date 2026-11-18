import fs from 'node:fs';
import {TextDecoder, isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {projectPath, readProjectFile} from './project-paths.mjs';
import {initialFoundationPaths} from './managed-blocks.mjs';
import {readInstallationManifest, inspectInstallationResources} from './installation.mjs';
import {assertNoPendingOperation,scanOperations} from './install-journal.mjs';
import {assertNoPendingVersions} from './version-log.mjs';
import {assertPortablePath} from './paths.mjs';
import {inspectSkillResources} from './skill-resources.mjs';
import {canonicalJson} from './workflow-docs.mjs';
import {WorkflowError} from './errors.mjs';

export const foundationRoot='docs/project/foundation';
const limits={files:256,directories:1000,fileBytes:1024*1024,contextBytes:4*1024*1024};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const stamp=stat=>stat&&({dev:stat.dev,ino:stat.ino,size:stat.size,mtimeNs:stat.mtimeNs,ctimeNs:stat.ctimeNs});
const fail=(code,diagnostic,message,path=null)=>{throw new WorkflowError(code,message,[{code:diagnostic,message,path}]);};
const bootstrapPaths=['.agents/skills/workflow-guide/SKILL.md',
  ...['manifest.json','references/work-contract.md','references/write-contract.md','references/routing.md',
    'references/rules.json','references/capabilities.json'].map(path=>'.ai-workflow/resources/skills/_shared/'+path)].sort();

function readText(root,path,read=path=>readProjectFile(root,path)){
  const actual=projectPath(root,path),stat=fs.lstatSync(actual,{throwIfNoEntry:false,bigint:true});
  if(!stat)fail('INCOMPLETE','MISSING_CONTEXT_FILE','Required context file is missing',path);
  if(!stat.isFile())fail('CONFLICT','INVALID_CONTEXT_FILE','Context input is not a regular file',path);
  if(stat.size>limits.fileBytes)fail('CONFLICT','CONTEXT_TOO_LARGE','Context file exceeds 1 MiB',path);
  const bytes=read(path);
  if(bytes===null)fail('INCOMPLETE','MISSING_CONTEXT_FILE','Context input disappeared',path);
  if(bytes.length>limits.fileBytes)fail('CONFLICT','CONTEXT_TOO_LARGE','Context file exceeds 1 MiB',path);
  let text;try{text=decoder.decode(bytes);}catch{fail('CONFLICT','INVALID_CONTEXT_UTF8','Context input is not valid UTF-8',path);}
  return {path,sha256:hash(bytes),text,bytes:bytes.length,stamp:stamp(stat)};
}

export function foundationMembers(root){
  for(const path of initialFoundationPaths){const actual=projectPath(root,path),stat=fs.lstatSync(actual,{throwIfNoEntry:false});
    if(!stat||!stat.isFile())fail('INCOMPLETE','MISSING_FOUNDATION','Required foundation file is missing',path);}
  const files=[],identities=new Set();let directories=0;
  function visit(folder){
    const actual=projectPath(root,folder),stat=fs.lstatSync(actual);
    if(!stat.isDirectory())fail('CONFLICT','INVALID_FOUNDATION','Foundation path is not a directory',folder);
    if(++directories>limits.directories)fail('CONFLICT','FOUNDATION_LIMIT','Foundation directory limit exceeded',folder);
    for(const entry of fs.readdirSync(actual,{withFileTypes:true})){
      const path=folder+'/'+entry.name,id=path.normalize('NFC').toLowerCase();
      if(identities.has(id))fail('CONFLICT','INVALID_FOUNDATION','Aliased foundation entry',path);identities.add(id);
      const file=projectPath(root,path),info=fs.lstatSync(file);
      if(info.isDirectory())visit(path);
      else if(!info.isFile())fail('CONFLICT','INVALID_FOUNDATION','Foundation entry is not regular',path);
      else if(/\.md$/iu.test(path)){files.push(path);if(files.length>limits.files)fail('CONFLICT','FOUNDATION_LIMIT','Foundation document limit exceeded',path);}
    }
  }
  visit(foundationRoot);return files.sort();
}

export function readFoundationSnapshot(root,{read=path=>readProjectFile(root,path)}={}){
  const paths=foundationMembers(root),contents=[];let bytes=0;
  for(const path of paths){const item=readText(root,path,read);bytes+=item.bytes;if(bytes>limits.contextBytes)fail('CONFLICT','CONTEXT_TOO_LARGE','Foundation content exceeds 4 MiB',path);contents.push(item);}
  return {entries:contents.map(({path,sha256})=>({path,sha256})),contents,bytes};
}

export function makeFoundationInventory(paths){return {root:foundationRoot,paths:[...paths],sha256:hash(Buffer.from(JSON.stringify(paths)))};}
export function validateFoundationInventory(value){
  if(!value||Object.keys(value).sort().join(',')!=='paths,root,sha256'||value.root!==foundationRoot||!Array.isArray(value.paths)||value.paths.length>limits.files||!isDeepStrictEqual(value.paths,[...value.paths].sort())||value.sha256!==hash(Buffer.from(JSON.stringify(value.paths))))fail('INCOMPLETE','INVALID_FOUNDATION_INVENTORY','Foundation inventory is invalid');
  const aliases=new Set();for(const path of value.paths){assertPortablePath(path);const id=path.normalize('NFC').toLowerCase();if(!path.startsWith(foundationRoot+'/')||!/\.md$/iu.test(path)||aliases.has(id))fail('INCOMPLETE','INVALID_FOUNDATION_INVENTORY','Invalid foundation inventory member',path);aliases.add(id);}
  if(initialFoundationPaths.some(path=>!value.paths.includes(path)))fail('INCOMPLETE','INVALID_FOUNDATION_INVENTORY','Foundation inventory lacks a required base file');return value;
}

function installation(root,read){
  let manifest;
  try{manifest=readInstallationManifest(root,{read});}catch(error){throw new WorkflowError('PACKAGE_INVALID','Installed framework identity is invalid',error.details?.length?error.details:[{code:'INVALID_INSTALLATION',message:error.message,path:'.ai-workflow/manifest.json'}]);}
  if(!manifest)fail('INCOMPLETE','NO_FRAMEWORK_INSTALLATION','Project does not have an installed framework');
  const resources=inspectInstallationResources(root,manifest,{read});
  if(resources.missing.length||resources.changed.length||resources.extra.length||resources.missingBlocks.length||resources.issues.length)
    fail('PACKAGE_INVALID','INVALID_INSTALLATION','Installed framework resources or navigation changed');
  const skills=inspectSkillResources(root,{installed:true});if(!skills.valid)throw new WorkflowError('PACKAGE_INVALID','Installed framework methods are inconsistent',skills.issues);
  return manifest;
}
const identity=manifest=>({name:manifest.package.name,version:manifest.package.version,source_manifest_sha256:manifest.package.source_manifest_sha256});

export function inspectProjectContext(projectRoot,{read=path=>readProjectFile(projectRoot,path),allowPendingWorkflow=false}={}){
  projectPath(projectRoot,'AGENTS.md');const root=fs.realpathSync.native(projectRoot);
  const pending=()=>{if(!allowPendingWorkflow)assertNoPendingOperation(root);else{assertNoPendingVersions(root);if(scanOperations(root).some(op=>!['committed','rolled_back'].includes(op.data.phase)))fail('INCOMPLETE','PENDING_INSTALLATION','Installation requires recovery');}};
  pending();const manifest=installation(root,read),contents=[];
  for(const path of [...bootstrapPaths,'AGENTS.md'])contents.push(readText(root,path,read));
  const foundation=readFoundationSnapshot(root,{read});contents.push(...foundation.contents);
  if(contents.reduce((sum,item)=>sum+item.bytes,0)>limits.contextBytes)fail('CONFLICT','CONTEXT_TOO_LARGE','Project context exceeds 4 MiB');
  pending();const ending=installation(root,read);
  if(!isDeepStrictEqual(identity(manifest),identity(ending)))fail('CONFLICT','CONTEXT_CHANGED_DURING_READ','Framework identity changed while reading');
  if(!isDeepStrictEqual(foundation.entries.map(e=>e.path),foundationMembers(root)))fail('CONFLICT','CONTEXT_CHANGED_DURING_READ','Foundation membership changed while reading');
  for(const item of contents)if(readText(root,item.path,read).sha256!==item.sha256)fail('CONFLICT','CONTEXT_CHANGED_DURING_READ','Project context changed while reading',item.path);
  // Content rereads can themselves overlap external edits of earlier inputs.
  // Probe membership and initial file identities/timestamps after every reread.
  // This rejects observable changes; it is not an atomic filesystem snapshot.
  if(!isDeepStrictEqual(foundation.entries.map(e=>e.path),foundationMembers(root)))fail('CONFLICT','CONTEXT_CHANGED_DURING_READ','Foundation membership changed while reading');
  for(const item of contents){const stat=fs.lstatSync(projectPath(root,item.path),{throwIfNoEntry:false,bigint:true});
    if(!stat?.isFile()||!isDeepStrictEqual(item.stamp,stamp(stat)))fail('CONFLICT','CONTEXT_CHANGED_DURING_READ','Project context file changed while reading',item.path);}
  pending();
  const value={context_version:1,project_root:root,framework:{...identity(manifest),files:contents.filter(e=>bootstrapPaths.includes(e.path)).map(({path,sha256})=>({path,sha256}))},
    project_rules:{path:'AGENTS.md',sha256:contents.find(e=>e.path==='AGENTS.md').sha256},foundation:foundation.entries};
  // Keep the full manifest in verified reads and identity, only omit its model-facing prose.
  return {...value,snapshot_sha256:hash(Buffer.from(canonicalJson(value))),contents:contents.filter(e=>e.path!=='.ai-workflow/resources/skills/_shared/manifest.json').sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(({path,text})=>({path,text})),semantic_completeness_verified:false};
}

export function guardProjectContext(root,expectedSnapshot){
  if(typeof expectedSnapshot!=='string'||!/^[a-f0-9]{64}$/u.test(expectedSnapshot))throw new WorkflowError('USAGE','Context guard requires an exact SHA256 snapshot');
  try{const current=inspectProjectContext(root);return {context_version:1,freshness:current.snapshot_sha256===expectedSnapshot?'fresh':'stale',expected_snapshot:expectedSnapshot,
    snapshot_sha256:current.snapshot_sha256,issues:current.snapshot_sha256===expectedSnapshot?[]:[{code:'CONTEXT_CHANGED',message:'Current context differs from the supplied snapshot',path:null}],semantic_completeness_verified:false};}
  catch(error){return {context_version:1,freshness:'unknown',expected_snapshot:expectedSnapshot,snapshot_sha256:null,error_code:error.code||'IO',issues:error.details?.length?error.details:[{code:error.code||'IO',message:error.message,path:null}],semantic_completeness_verified:false};}
}
