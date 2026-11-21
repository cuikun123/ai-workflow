import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {assertSafeRoot} from './paths.mjs';
import {projectPath} from './project-paths.mjs';
import {validateGuardAbsolutePath} from './guard-declarations.mjs';
import {parseWorkflowDocument} from './workflow-docs.mjs';
import {sha256} from './package.mjs';
import {WorkflowError} from './errors.mjs';

export function guardIssue(code,message,file=null,decision='deny') {
  throw new WorkflowError(decision==='unknown'?'INCOMPLETE':'CONFLICT',message,[{code,message,path:file}]);
}
const identity=s=>s.normalize('NFC').toLowerCase();
export function guardRoot(value) {
  validateGuardAbsolutePath(value);
  if(!path.isAbsolute(value)) guardIssue('UNSUPPORTED_HOST_PATH','Path is not absolute on this host',null,'unknown');
  let root;
  try{root=assertSafeRoot(value);}catch{guardIssue('PROJECT_ROOT_UNSAFE','Project and executable directories must be real local directories');}
  const parsed=path.parse(root);let current=parsed.root;
  for(const segment of root.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    if(fs.readdirSync(current).some(name=>identity(name)===identity(segment)&&name!==segment))
      guardIssue('PATH_ALIAS','Case or Unicode alias in absolute path');
    current=path.join(current,segment);
  }
  if(path.resolve(fs.realpathSync.native(root))!==root) guardIssue('PATH_ALIAS','Absolute path resolves to an alias');
  return root;
}
export function guardAbsoluteFile(value) {
  validateGuardAbsolutePath(value);
  if(!path.isAbsolute(value)) guardIssue('UNSUPPORTED_HOST_PATH','Executable is not absolute on this host',null,'unknown');
  const root=guardRoot(path.dirname(value)),absolute=projectPath(root,path.basename(value));
  const stat=fs.lstatSync(absolute,{throwIfNoEntry:false});
  if(!stat?.isFile()) guardIssue('EXECUTABLE_UNAVAILABLE','Executable must be an existing regular file',value,'unknown');
  return absolute;
}
export function guardDirectory(root,relative) {
  const absolute=relative==='.'?root:projectPath(root,relative),stat=fs.lstatSync(absolute,{throwIfNoEntry:false});
  if(!stat?.isDirectory()) guardIssue('WORKING_DIRECTORY_MISSING','Actual working directory is missing',relative,'unknown');
  return absolute;
}
export const inFileScope=(file,entries)=>entries.some(e=>file===e.path||e.recursive&&file.startsWith(e.path+'/'));
export const iterationDefinition=file=>/^docs\/iterations\/[^/]+\/(?:scope|design|tasks)\.md$/u.test(identity(file));
export function protectedFile(file) {
  const p=identity(file);
  return /(?:^|\/)(?:agents|claude)\.md$/u.test(p)||p==='.gitattributes'||
    /^(?:\.git|\.agents|\.ai-workflow|\.pi|\.claude|\.codex)(?:\/|$)|^docs\/workflow(?:\/|$)|^docs\/project\/(?:specs|foundation)(?:\/|$)/u.test(p);
}
export function inspectFileChanges(root,changes,read,{workflowInput=false}={}) {
  const entries=[];
  for(const change of changes) {
    projectPath(root,change.path);
    const before=read(change.path),digest=before===null?null:sha256(before);
    if(before!==null&&fs.lstatSync(projectPath(root,change.path)).nlink>1) guardIssue('HARD_LINK_WRITE_UNSUPPORTED','A file with multiple hard links cannot be changed through this interface',change.path);
    if(digest!==change.before_sha256) guardIssue('FILE_PREIMAGE_CHANGED','Actual file does not match the supplied before image',change.path);
    const inputPath=/^\.ai-workflow\/\.local\/inputs\/[^/]+\.json$/u.test(change.path);
    if(protectedFile(change.path)&&!(workflowInput&&inputPath)) guardIssue('PROTECTED_DIRECT_WRITE','This file can only be changed through its controlled workflow',change.path);
    const markdown=/\.md$/iu.test(change.path);
    if(markdown) {
      if(change.after?.encoding==='opaque') guardIssue('MARKDOWN_TEXT_REQUIRED','Markdown changes require full UTF-8 text',change.path,'unknown');
      let oldText='';
      try{if(before!==null) oldText=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(before);}
      catch{guardIssue('INVALID_MARKDOWN_UTF8','Existing Markdown cannot be inspected as UTF-8',change.path,'unknown');}
      const managed=/^docs\/iterations\/[^/]+\/(?:scope|design|tasks|verification)\.md$/u.test(change.path),maxBytes=managed?1024*1024:8*1024*1024;
      if(Buffer.byteLength(oldText)>maxBytes||Buffer.byteLength(change.after?.text||'')>maxBytes) guardIssue('MANAGED_DOCUMENT_LIMIT','Managed workflow Markdown exceeds its supported byte limit',change.path,'unknown');
      const beforeDoc=parseWorkflowDocument(oldText,change.path,{maxBytes}),afterDoc=parseWorkflowDocument(change.after?.text||'',change.path,{maxBytes});
      const blocks=d=>[...d.spans.values()].map(s=>d.text.slice(s.start,s.end));
      if(!isDeepStrictEqual(blocks(beforeDoc),blocks(afterDoc))) guardIssue('MACHINE_RECORD_CHANGED','Direct writes cannot add, remove or alter workflow records',change.path);
      entries.push({change,before,beforeDoc,afterDoc});
    } else entries.push({change,before,beforeDoc:null,afterDoc:null});
  }
  return entries;
}
export function inspectTaskFileScope(entries,policy,{closeout=false}={}) {
  const scope=closeout?policy.closeout_paths:policy.write_paths;
  for(const {change,beforeDoc,afterDoc} of entries) {
    if(!inFileScope(change.path,scope)) guardIssue('FILE_OUTSIDE_TASK','Path is outside the confirmed task scope',change.path);
    if(iterationDefinition(change.path)) guardIssue('DEFINITION_DIRECT_WRITE','Approved iteration definitions require the revision workflow',change.path);
    if(closeout&&(!beforeDoc||!afterDoc||change.after===null)) guardIssue('CLOSEOUT_TEXT_ONLY','Closeout permits ordinary document prose only',change.path);
  }
}
