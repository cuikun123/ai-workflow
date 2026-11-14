import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { assertPortablePath, assertSafeRoot } from './paths.mjs';
import { WorkflowError } from './errors.mjs';

const conflict = message => { throw new WorkflowError('CONFLICT', message); };
export function projectPath(root, path) {
  try { root = assertSafeRoot(root); assertPortablePath(path); } catch { conflict('Project paths must stay inside real local directories'); }
  let current = root, missing = false;
  const segments = path.split('/');
  for (const [index, segment] of segments.entries()) {
    if (!missing) {
      const aliases = fs.readdirSync(current).filter(name => name.normalize('NFC').toLowerCase() === segment.normalize('NFC').toLowerCase());
      if (aliases.some(name => name !== segment)) conflict('Case or Unicode alias in project path: ' + path);
    }
    current = join(current, segment);
    const stat = missing ? undefined : fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) { missing = true; continue; }
    if (stat.isSymbolicLink() || (index < segments.length - 1 && !stat.isDirectory())) conflict('Linked or invalid project path: ' + path);
    if (!stat.isDirectory() && !stat.isFile()) conflict('Non-regular project entry: ' + path);
  }
  return current;
}
export function readProjectFile(root, path, limit = 8 * 1024 * 1024) {
  const file = projectPath(root, path), stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || stat.size > limit) conflict('Expected a bounded regular file: ' + path);
  return fs.readFileSync(file);
}
export function ensureProjectDirectory(root, path, io = fs, created = []) {
  let prefix = '';
  for (const segment of path.split('/')) {
    prefix = prefix ? prefix + '/' + segment : segment;
    const file = projectPath(root, prefix), stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) conflict('Expected a directory: ' + prefix);
    if (!stat) { io.mkdirSync(file); created.push(prefix); }
  }
}
export function ensureParent(root, path, io = fs, created = []) {
  const parent = path.slice(0, path.lastIndexOf('/'));
  if (path.includes('/')) ensureProjectDirectory(root, parent, io, created);
  return dirname(projectPath(root, path));
}
