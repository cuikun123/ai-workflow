import {win32,posix} from 'node:path';
import {assertPortablePath} from './paths.mjs';
import {WorkflowError} from './errors.mjs';

const invalid=message=>{throw new WorkflowError('STATE_INVALID',message);};
export const isGuardUnicodeText=value=>typeof value==='string'&&!/[\uD800-\uDFFF]/u.test(value);
const unicodeValues=value=>{if(typeof value==='string'){if(!isGuardUnicodeText(value))invalid('Guard declarations contain an isolated Unicode surrogate');return;}if(value&&typeof value==='object')for(const child of Object.values(value))unicodeValues(child);};
export function validateGuardRelativePath(value,{cwd=false}={}){
 if(cwd&&value==='.')return value;
 try{assertPortablePath(value);}catch{invalid('Guard path must be a portable project-relative path');}
 return value;
}
export function validateGuardAbsolutePath(value){
 if(typeof value!=='string'||/[\x00-\x1f\x7f]/u.test(value)||value.startsWith('\\\\')||value.startsWith('//')||!(win32.isAbsolute(value)||posix.isAbsolute(value)))invalid('Guard workspace and executable paths must be absolute local paths');
 const rest=value.replace(/^[A-Za-z]:[\\/]/u,'').replace(/^\//u,'');
 if(!rest||rest.split(/[\\/]/u).some(s=>!s||s==='.'||s==='..'||/[.\s]$/u.test(s)))invalid('Guard absolute path contains an alias or unsafe segment');
 return value;
}
export function validateGuardBranch(value){
 if(typeof value!=='string'||!value||value==='@'||value.startsWith('-')||value.startsWith('/')||value.endsWith('/')||value.endsWith('.')||value.includes('//')||value.includes('..')||value.includes('@{')||/[\x00-\x20\x7f~^:?*[\]\\]/u.test(value)||value.split('/').some(s=>s.startsWith('.')||s.endsWith('.lock')))invalid('Guard branch name is unsafe');
 return value;
}
const protectedCloseout=value=>{const path=value.normalize('NFC').toLowerCase();return path==='agents.md'||path==='claude.md'||/^\.git(?:\/|$)|^\.agents(?:\/|$)|^\.ai-workflow(?:\/|$)|^\.pi(?:\/|$)|^docs\/workflow(?:\/|$)|^docs\/project\/(?:specs|foundation)(?:\/|$)|^docs\/iterations\/[^/]+\/(?:scope|design|tasks)\.md$/u.test(path);};
export function validateGuardDeclarations(record){
 const data=record.data;
 for(const value of [data.guard_policy,data.operation_scope,data.operation_context])unicodeValues(value);
 if(data.guard_policy){
  const p=data.guard_policy;
  validateGuardAbsolutePath(p.workspace.worktree_root);validateGuardAbsolutePath(p.workspace.git_common_dir);
  validateGuardBranch(p.workspace.task_branch);validateGuardBranch(p.workspace.main_branch);
  if(p.workspace.task_branch===p.workspace.main_branch)invalid('Guard task branch must differ from the main branch');
  for(const entry of p.write_paths)validateGuardRelativePath(entry.path);
  for(const entry of p.closeout_paths){
   validateGuardRelativePath(entry.path);
   const identity=entry.path.normalize('NFC').toLowerCase();
   if(protectedCloseout(entry.path)||entry.recursive&&['docs','docs/project','docs/iterations'].includes(identity)||entry.recursive&&/^docs\/iterations\/[^/]+$/u.test(identity))invalid('Closeout paths cannot include protected workflow or definition documents');
  }
  for(const command of p.commands){validateGuardAbsolutePath(command.executable);validateGuardRelativePath(command.cwd,{cwd:true});}
 }
 const git=data.operation_scope?.git||data.operation_context;
 if(git){validateGuardAbsolutePath(git.git_common_dir);if(git.worktree_root)validateGuardAbsolutePath(git.worktree_root);for(const field of ['source_branch','target_branch'])if(git[field])validateGuardBranch(git[field]);}
 return record;
}
