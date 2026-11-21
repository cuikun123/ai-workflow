import fs from 'node:fs';
import path from 'node:path';
import {readGit} from './git-read.mjs';
import {isDeepStrictEqual} from 'node:util';
import {guardAbsoluteFile,guardRoot,guardDirectory,guardIssue} from './operation-files.mjs';
import {sha256} from './package.mjs';

const portable=p=>p.replaceAll('\\','/');
export function findGuardExecutable(name) {
  for(const directory of (process.env.PATH||process.env.Path||'').split(path.delimiter)) {
    if(!directory||!path.isAbsolute(directory)) continue;
    for(const suffix of process.platform==='win32'?['.exe']:['']) {
      const file=path.join(directory,name+suffix);
      // Host PATH entries commonly use different Windows casing. Resolve the trusted
      // discovery result to its actual identity; model-supplied paths still reject aliases.
      try{if(fs.lstatSync(file,{throwIfNoEntry:false})?.isFile()) return guardAbsoluteFile(fs.realpathSync.native(file));}catch{}
    }
  }
  guardIssue('EXECUTABLE_UNAVAILABLE','Required host executable is unavailable',null,'unknown');
}
function gitRead(root,executable,args) {
  const r=readGit(root,args);
  if(r.error||r.status!==0) guardIssue('GIT_IDENTITY_UNAVAILABLE','Actual repository identity could not be read',null,'unknown');
  return r.stdout.trim();
}
export function observeGuardWorkspace(root,readAbsolute) {
  const executable=findGuardExecutable('git');readAbsolute(executable);
  const top=guardRoot(gitRead(root,executable,['rev-parse','--show-toplevel']));
  if(top!==root) guardIssue('WRONG_WORKTREE','Actual Git worktree does not match the project root');
  const common=guardRoot(gitRead(root,executable,['rev-parse','--path-format=absolute','--git-common-dir']));
  const branch=gitRead(root,executable,['symbolic-ref','--quiet','--short','HEAD']);
  const head=gitRead(root,executable,['rev-parse','--verify','HEAD']);
  if(!/^[a-f0-9]{40}$/u.test(head)) guardIssue('UNSUPPORTED_GIT_IDENTITY','Repository does not use a supported commit identity',null,'unknown');
  return {git_common_dir:portable(common),worktree_root:portable(top),branch,head_commit:head};
}
export function inspectWorkspacePolicy(root,policy,observed) {
  const wanted=policy.workspace;
  if(guardRoot(wanted.worktree_root)!==root||guardRoot(wanted.git_common_dir)!==guardRoot(observed.git_common_dir)||
    wanted.task_branch!==observed.branch||observed.branch===wanted.main_branch)
    guardIssue('WORKSPACE_SCOPE_MISMATCH','Current worktree, repository or task branch differs from the confirmed task');
}
export function inspectCommand(root,operation,policy,readAbsolute) {
  guardDirectory(root,operation.cwd);
  const file=guardAbsoluteFile(operation.executable),digest=readAbsolute(file);
  const name=path.basename(file).toLowerCase().replace(/\.(?:exe|cmd|bat)$/u,'');
  const declaration=policy.commands.find(c=>path.resolve(c.executable)===file&&isDeepStrictEqual(c.argv,operation.argv)&&c.cwd===operation.cwd);
  if(declaration&&declaration.executable_sha256!==digest) guardIssue('EXECUTABLE_CHANGED','Executable content changed after task confirmation');
  let gitDigest=null;try{gitDigest=readAbsolute(findGuardExecutable('git'));}catch{}
  if(name==='git'||digest===gitDigest) guardIssue('GIT_COMMAND_REQUIRES_GUARD','Git commands require their structured operation guard',null,'unknown');
  const nodeDigest=readAbsolute(guardAbsoluteFile(process.execPath)),isNode=digest===nodeDigest;
  const shells=['cmd','powershell','pwsh','bash','sh','zsh','fish','wsl','env','busybox','cscript','wscript'];
  let isShell=shells.includes(name)||/\.(?:cmd|bat|ps1|sh)$/iu.test(file);
  if(!isNode&&!isShell) for(const shell of shells) {
    let shellFile=null;try{shellFile=findGuardExecutable(shell);}catch{}
    if(shellFile&&readAbsolute(shellFile)===digest) {isShell=true;break;}
  }
  if(isShell)
    guardIssue('SHELL_UNSUPPORTED','Shell commands and interpreter wrappers are not supported',null,'unknown');
  if(name==='iterlane'||operation.argv.some(a=>/(?:^|[\\/])(?:\.ai-workflow[\\/].*|iterlane\.(?:mjs|cjs|js))$/iu.test(a)))
    guardIssue('WORKFLOW_COMMAND_REQUIRES_GUARD','Framework commands require a structured query or semantic operation',null,'unknown');
  if(isNode&&operation.argv.some(a=>/^(?:-e|-p|-r|--eval|--print|--require|--import|--loader|--experimental-loader)(?:=|$)|^-[epr]./u.test(a)))
    guardIssue('INLINE_INTERPRETER_UNSUPPORTED','Inline code and nested interpreter loading are not supported',null,'unknown');
  if(!isNode) {
    // A task declaration is permission scope, never proof of an executable's category.
    // Only known native engineering tools discovered by the controlled host may use
    // this branch. Unknown binaries (including other renamed shell versions) fail closed.
    const nativeTools=['go','cargo','rustc','cmake','ninja','gcc','g++','clang','clang++','cl','msbuild','java','javac','dotnet','where'];
    let hostFile=null;if(nativeTools.includes(name))try{hostFile=findGuardExecutable(name);}catch{}
    if(!hostFile||readAbsolute(hostFile)!==digest) guardIssue('EXECUTABLE_CATEGORY_UNKNOWN','Actual executable identity is not a recognized host engineering tool',null,'unknown');
  }
  if(!declaration) guardIssue('COMMAND_UNDECLARED','Executable, literal arguments and directory do not match a confirmed engineering command',null,'unknown');
  return {executable_sha256:digest};
}
