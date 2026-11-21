import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {WorkflowError} from './errors.mjs';
import {assertPortablePath} from './paths.mjs';
import {validateGuardBranch} from './guard-declarations.mjs';

const commit=s=>typeof s==='string'&&/^[a-f0-9]{40}$/u.test(s);
const ref=s=>{if(typeof s!=='string'||!s.startsWith('refs/'))return false;try{validateGuardBranch(s);return true;}catch{return false;}};
const paths=values=>values.every(p=>{try{assertPortablePath(p);return true;}catch{return false;}});
const same=(args,expected)=>JSON.stringify(args)===JSON.stringify(expected);
function allowed(a) {
 if(!Array.isArray(a)||!a.length||a.some(v=>typeof v!=='string'))return false;
 if(a[0]==='rev-parse')return same(a,['rev-parse','--show-toplevel'])||same(a,['rev-parse','--path-format=absolute','--git-common-dir'])||same(a,['rev-parse','--path-format=absolute','--git-path','index'])||a.length===3&&a[1]==='--verify'&&(a[2]==='HEAD'||ref(a[2]));
 if(a[0]==='symbolic-ref')return same(a,['symbolic-ref','--quiet','--short','HEAD']);
 if(a[0]==='cat-file')return a.length===3&&a[1]==='-t'&&commit(a[2]);
 if(a[0]==='for-each-ref')return same(a,['for-each-ref','--format=%(refname) %(objectname)','refs/heads','refs/remotes']);
 if(a[0]==='ls-tree')return a[1]==='-r'&&a[2]==='-z'&&a[3]==='--full-tree'&&commit(a[4])&&(a.length===5||a[5]==='--'&&paths(a.slice(6)));
 if(a[0]==='ls-files') {
  const i=a.indexOf('--'),flags=a.slice(1,i<0?a.length:i);
  return [['--stage','-z'],['--others','-z'],['--others','--exclude-standard','-z'],['--cached','--others','--exclude-standard','-z']].some(v=>same(flags,v))&&(i<0||paths(a.slice(i+1)));
 }
 if(a[0]==='check-attr') {const b=a[1]==='--cached'?a.slice(2):a.slice(1),i=b.indexOf('--');return i===3&&same(b.slice(0,3),['-z','filter','working-tree-encoding'])&&(paths(b.slice(i+1))||same(b.slice(i+1),['.']));}
 if(a[0]==='hash-object')return a.length===4&&a[2]==='--'&&a[1].startsWith('--path=')&&paths([a[1].slice('--path='.length),a[3]])||a.length===5&&a[1]==='--no-filters'&&a[3]==='--'&&a[2].startsWith('--path=')&&paths([a[2].slice('--path='.length),a[4]]);
 if(a[0]==='diff-tree')return same(a.slice(0,5),['diff-tree','--no-commit-id','--name-only','-r','-z'])&&a.length===7&&commit(a[5])&&commit(a[6]);
 if(a[0]==='merge-base')return a.length===3&&commit(a[1])&&commit(a[2]);
 if(a[0]==='diff'&&a[1]==='--no-ext-diff'&&a[2]==='--no-textconv') {
  if(a[3]==='--quiet')return a[4]==='--'&&paths(a.slice(5))||commit(a[4])&&a[5]==='--'&&paths(a.slice(6));
  return a[3]==='--name-only'&&a[4]==='-z'&&a.length===7&&a[5]==='--cached'&&commit(a[6]);
 }
 if(a[0]==='config')return a.length===3&&a[1]==='--get-all'&&/^remote\.[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.(?:url|pushurl)$/u.test(a[2]);
 if(a[0]==='remote')return same(a,['remote'])||a.length===5&&same(a.slice(0,4),['remote','get-url','--push','--all'])&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(a[4]);
 return false;
}
export function gitExecutable() {
 for(const directory of (process.env.PATH||process.env.Path||'').split(path.delimiter)) {
  if(!directory||!path.isAbsolute(directory))continue;
  const file=path.join(directory,process.platform==='win32'?'git.exe':'git');
  if(fs.lstatSync(file,{throwIfNoEntry:false})?.isFile())return fs.realpathSync.native(file);
 }
 throw new WorkflowError('INCOMPLETE','Host Git executable is unavailable');
}
function runRead(root,args,encoding,maxBuffer) {
 const env={...process.env};for(const key of Object.keys(env))if(/^GIT_/iu.test(key))delete env[key];
 Object.assign(env,{GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_NO_REPLACE_OBJECTS:'1'});
 return spawnSync(gitExecutable(),['--literal-pathspecs','-C',root,'-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.quotepath=false','-c','diff.renames=false',...args],
  {encoding,env,windowsHide:true,timeout:5000,maxBuffer});
}
export function readGit(root,args) {
 if(!allowed(args))throw new WorkflowError('USAGE','Git reader only accepts recognized read-only argument shapes');
 return runRead(root,args,'utf8',16*1024*1024);
}
export function readGitBlob(root,oid) {
 if(!commit(oid))throw new WorkflowError('USAGE','Git blob reader requires an exact object ID');
 const r=runRead(root,['cat-file','blob',oid],'buffer',8*1024*1024);
 if(r.error||r.status!==0)throw new WorkflowError('INCOMPLETE','Staged Git blob cannot be read');
 return r.stdout;
}
