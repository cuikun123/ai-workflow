import * as fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {projectPath,readProjectFile,ensureProjectDirectory,ensureParent} from './project-paths.mjs';
import {WorkflowError} from './errors.mjs';
const local='.ai-workflow/.local',lockPath=local+'/write.lock';
const incomplete=message=>{throw new WorkflowError('INCOMPLETE',message);};
export const equalBytes=(a,b)=>a===null||b===null?a===b:a.equals(b);
export function durableWrite(root, path, bytes, before, io, created, registeredTemporary = null) {
  ensureParent(root, path, io, created);
  const readLimit=Math.max(8*1024*1024,bytes.length,before?.length||0);
  if (!equalBytes(readProjectFile(root, path,readLimit), before)) throw new WorkflowError('CONFLICT', 'File changed before write: ' + path);
  const temporary = registeredTemporary || path + '.tmp-' + randomUUID(), absolute = projectPath(root, temporary);
  let fd, ownTemporary = false;
  try {
    fd = io.openSync(absolute, 'wx', 0o600); ownTemporary = true; io.writeFileSync(fd, bytes); io.fsyncSync(fd); io.closeSync(fd); fd = undefined;
    if (!equalBytes(readProjectFile(root, temporary,readLimit), bytes) || !equalBytes(readProjectFile(root, path,readLimit), before)) throw new WorkflowError('CONFLICT', 'File changed during preparation: ' + path);
    io.renameSync(absolute, projectPath(root, path));
    if (!equalBytes(readProjectFile(root, path,readLimit), bytes)) throw new WorkflowError('IO', 'Written file failed readback: ' + path);
  } finally {
    if (fd !== undefined) io.closeSync(fd);
    try { if (ownTemporary && equalBytes(readProjectFile(root, temporary,readLimit), bytes)) io.unlinkSync(projectPath(root, temporary)); } catch { /* Keep uncertain temporary content. */ }
  }
}

export function takeNewLock(root, operationId, io, created, nonce = randomUUID()) {
  ensureProjectDirectory(root, local, io, created);
  const owner = { lock_version: 1, operation_id: operationId, nonce, pid: process.pid, project_root: root, created_at: new Date().toISOString() };
  const bytes = Buffer.from(JSON.stringify(owner)), path = projectPath(root, lockPath);
  let fd;
  try { fd = io.openSync(path, 'wx', 0o600); io.writeFileSync(fd, bytes); io.fsyncSync(fd); }
  catch (error) { if (error.code === 'EEXIST') incomplete('Another writer holds the project lock'); throw error; }
  finally { if (fd !== undefined) io.closeSync(fd); }
  return { owner, bytes };
}
export function releaseLock(root, bytes, io) {
  if (!equalBytes(readProjectFile(root, lockPath), bytes)) incomplete('Write lock ownership changed; lock was preserved');
  io.unlinkSync(projectPath(root, lockPath));
}

