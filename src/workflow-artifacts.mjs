import * as fs from 'node:fs';import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {readProjectFile,projectPath} from './project-paths.mjs';import {sha256} from './package.mjs';
import {validateArtifactShape,parseWorkflowDocument,definitionDigest,canonicalJson} from './workflow-docs.mjs';

export const artifactsKey=artifacts=>canonicalJson(artifacts.map(a=>a.kind==='git'?{...a,scope:[...a.scope].sort()}:a).sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b))));
function git(root,args){
  const env={...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1'};
  for(const key of Object.keys(env))if(/^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_|CONFIG_PARAMETERS)/u.test(key))delete env[key];
  return spawnSync('git',['--literal-pathspecs','-C',root,'-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.quotepath=false',...args],{encoding:'utf8',env,windowsHide:true,timeout:5000,maxBuffer:16*1024*1024});
}
export function checkArtifact(root,artifact,{read=path=>readProjectFile(root,path,8*1024*1024),current=true}={}){
  validateArtifactShape(artifact);
  if(artifact.kind!=='git'){
    const bytes=read(artifact.path);if(bytes===null)return {valid:false,reason:'Artifact file is missing'};
    let digest;if(artifact.kind==='file')digest=sha256(bytes);else{let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return {valid:false,reason:'Definition is not UTF-8'};}digest=definitionDigest(parseWorkflowDocument(text,artifact.path));}
    return {valid:digest===artifact.sha256,reason:digest===artifact.sha256?null:'Artifact content version differs',actual_sha256:digest};
  }
  const top=git(root,['rev-parse','--show-toplevel']);
  if(top.status!==0)return {valid:false,reason:'Git repository is unavailable'};
  const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
  if(!same(resolve(top.stdout.trim()),fs.realpathSync.native(root)))return {valid:false,reason:'Git evidence belongs to another project root'};
  const object=git(root,['cat-file','-t',artifact.commit]);if(object.status!==0||object.stdout.trim()!=='commit')return {valid:false,reason:'Git commit is missing or unsupported'};
  const tree=git(root,['ls-tree','-r','-z','--full-tree',artifact.commit,'--',...artifact.scope]);
  if(tree.status!==0||!tree.stdout)return {valid:false,reason:'Git scope has no tracked source'};
  const paths=[];for(const item of tree.stdout.split('\0').filter(Boolean)){const match=item.match(/^(100644|100755) blob [a-f0-9]{40}\t([\s\S]+)$/u);if(!match)return {valid:false,reason:'Git source includes a link, submodule or unsupported object'};projectPath(root,match[2]);paths.push(match[2]);}
  if(artifact.scope.some(scope=>!paths.some(path=>path===scope||path.startsWith(scope+'/'))))return {valid:false,reason:'An explicit Git scope is missing'};
  if(!current)return {valid:true,reason:null,validation:'historical_commit_exists'};
  const index=git(root,['ls-files','--stage','-z','--',...artifact.scope]);if(index.status!==0)return {valid:false,reason:'Git index could not be read'};
  for(const item of index.stdout.split('\0').filter(Boolean)){const match=item.match(/^(100644|100755) [a-f0-9]{40} 0\t([\s\S]+)$/u);if(!match)return {valid:false,reason:'Git index includes an unresolved, linked or unsupported source'};projectPath(root,match[2]);paths.push(match[2]);}
  // Without exclude rules --others also includes ignored files: explicit scopes cover them.
  const untracked=git(root,['ls-files','--others','-z','--',...artifact.scope]);if(untracked.status!==0||untracked.stdout)return {valid:false,reason:'Untracked source exists inside the accepted Git scope'};
  for(const cached of [false,true]){const attrs=git(root,['check-attr',...(cached?['--cached']:[]),'-z','filter','working-tree-encoding','--',...new Set([...paths,...artifact.scope])]);
    if(attrs.status!==0)return {valid:false,reason:'Git attributes could not be read'};
    const fields=attrs.stdout.split('\0');for(let i=2;i<fields.length;i+=3)if(fields[i]&&!['unspecified','unset'].includes(fields[i]))return {valid:false,reason:'Custom filter or working-tree-encoding needs external verification'};
  }
  const diff=git(root,['diff','--no-ext-diff','--no-textconv','--quiet',artifact.commit,'--',...artifact.scope]);
  return {valid:diff.status===0,reason:diff.status===0?null:'Working source differs from the accepted Git commit',validation:'scoped_commit_and_worktree'};
}
