import {equalBytes,durableWrite,takeNewLock,releaseLock} from './project-writes.mjs';
import {assertNoPendingWorkflow} from './workflow-log.mjs';
import {validateVersionJournal,assertNoPendingVersions} from './version-log.mjs';
import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { projectPath, readProjectFile, ensureProjectDirectory, ensureParent } from './project-paths.mjs';
import { parseManagedBlock, replaceManagedBlock } from './managed-blocks.mjs';
import { WorkflowError } from './errors.mjs';
import metadata from '../package.json' with { type: 'json' };
import layout from '../templates/manifest.json' with { type: 'json' };
import { skillNames, sha256 } from './package.mjs';
import {exampleFiles} from './example-resources.mjs';

const local = '.ai-workflow/.local', lockPath = local + '/write.lock';
export const encode = value => value === null ? null : value.toString('base64');
export const decode = value => value === null ? null : Buffer.from(value, 'base64');
export {equalBytes} from './project-writes.mjs';
const incomplete = message => { throw new WorkflowError('INCOMPLETE', message); };
const exact = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).sort().join(',') === [...keys].sort().join(',');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
function validTarget(path,example) {
  return typeof path === 'string' && ((path.startsWith('.ai-workflow/') && !path.startsWith(local + '/')) || skillNames.some(name => path.startsWith('.agents/skills/' + name + '/')) || ['AGENTS.md', '.gitignore', '.gitattributes', 'docs/workflow/state.yaml', ...layout.empty_files, ...layout.directory_placeholders].includes(path) || example==='bookmarks'&&exampleFiles.includes(path));
}
export function validateInstallationJournal(root,data,expectedVersion=metadata.version){return validateJournal(root,data,expectedVersion);}
function validateJournal(root, data,expectedVersion=metadata.version) {
  const example=data.journal_version===3;
  if (!exact(data, ['journal_version', 'operation_id', 'project_root', 'nonce', 'package', 'installation_id', 'action', 'created_at', 'phase', 'intent', 'created_dirs', 'files', 'temporary',...(example?['example']:[])]) || ![1,3].includes(data.journal_version) || example&&(data.example!=='bookmarks'||data.action!=='initialized') || !uuid(data.operation_id) || !uuid(data.nonce) || !uuid(data.installation_id) || data.project_root !== root || !['initialized', 'repaired'].includes(data.action) || !['apply', 'undo'].includes(data.intent) || !['prepared', 'applying', 'blocked', 'committed', 'rolled_back'].includes(data.phase)) incomplete('Unknown or inconsistent operation journal');
  const pkg = data.package;
  if (!exact(pkg, ['name', 'version', 'source_manifest_sha256', 'state_schemas']) || pkg.name !== metadata.name || pkg.version !== expectedVersion || typeof pkg.source_manifest_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pkg.source_manifest_sha256) || JSON.stringify(pkg.state_schemas) !== '[1]') incomplete('Journal belongs to an unsupported package');
  if (typeof data.created_at !== 'string' || !Number.isFinite(Date.parse(data.created_at)) || new Date(data.created_at).toISOString() !== data.created_at) incomplete('Invalid journal timestamp');
  if (!Array.isArray(data.files) || !data.files.length || data.files.length > 10000 || !Array.isArray(data.created_dirs) || data.created_dirs.length > 10000) incomplete('Invalid journal inventory');
  const paths = new Set();
  for (const entry of data.files) {
    if (!exact(entry, ['path', 'kind', 'before', 'before_sha256', 'after', 'status']) || !validTarget(entry.path,example?data.example:null) || !['file', 'agents', 'ignore', 'attributes'].includes(entry.kind) || !['pending', 'applied', 'undone'].includes(entry.status)) incomplete('Invalid journal target');
    projectPath(root, entry.path); const key = entry.path.normalize('NFC').toLowerCase();
    if (paths.has(key)) incomplete('Duplicate journal target'); paths.add(key);
    for (const [key, value] of [['before', entry.before], ['after', entry.after]]) {
      if (key === 'before' && value === null) continue;
      if (typeof value !== 'string' || value.length > 12 * 1024 * 1024 || Buffer.from(value, 'base64').toString('base64') !== value) incomplete('Invalid journal image');
    }
    if (entry.before_sha256 !== (entry.before === null ? null : sha256(decode(entry.before)))) throw new WorkflowError('CONFLICT', 'Journal preimage integrity differs; original existence and bytes must be preserved');
  }
  for (const path of data.created_dirs) {
    if (typeof path !== 'string' || !data.files.some(entry => entry.path.startsWith(path + '/')) && !path.startsWith(local)) incomplete('Invalid journal directory ownership');
    projectPath(root, path);
  }
  if (data.temporary !== null) {
    const temp = data.temporary;
    if (!exact(temp, ['target', 'path', 'data', 'bytes', 'sha256']) || !data.files.some(file => file.path === temp.target) || temp.path !== temp.target + '.tmp-' + data.operation_id || typeof temp.data !== 'string' || temp.data.length > 12 * 1024 * 1024 || encode(decode(temp.data)) !== temp.data || temp.bytes !== decode(temp.data).length || temp.sha256 !== sha256(decode(temp.data))) incomplete('Invalid temporary write ownership');
    projectPath(root, temp.path);
  }
  return data;
}
export function scanOperations(root,{onError}={}) {
  const dir = projectPath(root, local + '/operations'), stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat) return [];
  if (!stat.isDirectory()) incomplete('Operation history is not a real directory');
  return fs.readdirSync(dir).map(id => {
    const safePath=uuid(id)?local+'/operations/'+id+'/journal.json':local+'/operations';try{
    if (!uuid(id)) incomplete('Unknown operation entry');
    const path = local + '/operations/' + id + '/journal.json', bytes = readProjectFile(root, path,64*1024*1024);
    if (!bytes) incomplete('Operation metadata was interrupted before a valid journal');
    let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { incomplete('Operation journal is damaged'); }
    if(data.journal_version===2&&data.kind==='framework-version'){validateVersionJournal(root,data);return null;}
    if(bytes.length>8*1024*1024)incomplete('Installation journal exceeds supported size');
    validateJournal(root, data); if (data.operation_id !== id) incomplete('Operation identity does not match its directory');
    return { path, bytes, data };
    }catch(error){if(!onError)throw error;onError(error,safePath);return null;}
  }).filter(Boolean);
}
export function assertNoPendingOperation(root) {
  assertNoPendingVersions(root);
  if (readProjectFile(root, lockPath) !== null) incomplete('Project write lock is present; inspect or explicitly resume the operation');
  if (scanOperations(root).some(op => !['committed', 'rolled_back'].includes(op.data.phase))) incomplete('An initialization operation is incomplete; use explicit resume or undo');
  assertNoPendingWorkflow(root);
}

function registerTemporary(journal, entry, bytes) {
  journal.temporary = { target: entry.path, path: entry.path + '.tmp-' + journal.operation_id, data: encode(bytes), bytes: bytes.length, sha256: sha256(bytes) };
  return journal.temporary.path;
}
function inspectTemporary(root, journal) {
  if (journal.temporary === null) return;
  const actual = readProjectFile(root, journal.temporary.path);
  if (actual === null) return;
  const expected = decode(journal.temporary.data);
  if (actual.length > expected.length || !actual.equals(expected.subarray(0, actual.length))) throw new WorkflowError('CONFLICT', 'Temporary data changed; it was preserved');
}
function cleanTemporary(root, journal, io) {
  inspectTemporary(root, journal);
  if (journal.temporary && readProjectFile(root, journal.temporary.path) !== null) io.unlinkSync(projectPath(root, journal.temporary.path));
  journal.temporary = null;
}
export function applyInstallationPlan(plan, { io = fs } = {}) {
  const root = plan.root, operationId = randomUUID(), created = [], lock = takeNewLock(root, operationId, io, created);
  const journalPath = local + '/operations/' + operationId + '/journal.json';
  let saved = null, journal;
  const save = () => {
    const bytes = Buffer.from(JSON.stringify(journal, null, 2) + '\n');
    durableWrite(root, journalPath, bytes, saved, io, created); saved = bytes;
  };
  try {
    ensureParent(root, journalPath, io, created);
    journal = { journal_version: plan.example?3:1,...(plan.example?{example:plan.example}:{}), operation_id: operationId, project_root: root, nonce: lock.owner.nonce, package: plan.package, installation_id: plan.installationId, action: plan.action, created_at: plan.createdAt, phase: 'prepared', intent: 'apply', temporary: null, created_dirs: created, files: plan.files.map(file => ({ path: file.path, kind: file.kind, before: encode(file.before), before_sha256: file.before === null ? null : sha256(file.before), after: encode(file.after), status: 'pending' })) };
    save(); journal.phase = 'applying'; save();
    for (const entry of journal.files) {
      if (entry.path === '.ai-workflow/manifest.json') plan.verify();
      let current = readProjectFile(root, entry.path), after = decode(entry.after);
      if (entry.kind !== 'file') {
        const beforeBlock = parseManagedBlock(decode(entry.before) || Buffer.alloc(0), entry.kind)?.bytes || null;
        const afterBlock = parseManagedBlock(after, entry.kind).bytes;
        after = replaceManagedBlock(current, entry.kind, beforeBlock, afterBlock);
        entry.before = encode(current); entry.before_sha256 = current === null ? null : sha256(current); entry.after = encode(after); save();
      } else if (!equalBytes(current, decode(entry.before))) throw new WorkflowError('CONFLICT', 'Planned file changed: ' + entry.path);
      ensureParent(root, entry.path, io, created); save();
      const temporary = registerTemporary(journal, entry, after); save();
      durableWrite(root, entry.path, after, current, io, created, temporary);
      journal.temporary = null; entry.status = 'applied'; save();
    }
    plan.verify(); journal.phase = 'committed'; save(); releaseLock(root, lock.bytes, io);
    return { action: plan.action, project: root, version: plan.package.version, client_validation: 'not_run' };
  } catch (error) {
    if (journal && saved && journal.phase !== 'committed') { journal.phase = 'blocked'; try { save(); } catch { /* A changed/damaged journal remains untouched. */ } }
    try { releaseLock(root, lock.bytes, io); } catch { /* Preserve a lock whose ownership is uncertain. */ }
    throw error;
  }
}

function classify(root, entry, mode) {
  const current = readProjectFile(root, entry.path), before = decode(entry.before), after = decode(entry.after);
  let post, pre;
  if (entry.kind === 'file') { post = equalBytes(current, after); pre = equalBytes(current, before); }
  else {
    const currentBlock = parseManagedBlock(current || Buffer.alloc(0), entry.kind)?.bytes || null;
    post = equalBytes(currentBlock, parseManagedBlock(after, entry.kind)?.bytes || null);
    pre = equalBytes(currentBlock, parseManagedBlock(before || Buffer.alloc(0), entry.kind)?.bytes || null);
  }
  if (post) return 'applied';
  if (pre && (mode === 'undo' || entry.status !== 'applied')) return 'pending';
  throw new WorkflowError('CONFLICT', 'Operation target changed; it was preserved: ' + entry.path);
}
export function recoverInstallation(root, mode, prepare, { io = fs,preview=false,operationId } = {}) {
  const operations = scanOperations(root), bytes = readProjectFile(root, lockPath);
  let owner;
  if (bytes) {
    try { owner = JSON.parse(bytes.toString('utf8')); } catch { incomplete('Write lock is damaged'); }
    if (!exact(owner, ['lock_version', 'operation_id', 'nonce', 'pid', 'project_root', 'created_at']) || owner.lock_version !== 1 || !uuid(owner.operation_id) || !uuid(owner.nonce) || !Number.isSafeInteger(owner.pid) || owner.pid < 1 || owner.project_root !== root) incomplete('Write lock ownership is unknown');
    try { process.kill(owner.pid, 0); incomplete('The recorded writer is still alive; lock was preserved'); }
    catch (error) { if (error.code !== 'ESRCH') incomplete('Writer is alive or its termination cannot be verified'); }
  }
  const pending = operations.filter(op => !['committed', 'rolled_back'].includes(op.data.phase));
  const operation = owner ? operations.find(op => op.data.operation_id === owner.operation_id) : pending[0];
  if (!operation || pending.length > 1 || owner && owner.nonce !== operation.data.nonce || operation.data.phase === 'rolled_back' || mode === 'undo' && operation.data.phase === 'committed') incomplete('No safely recoverable operation was found');
  if(operationId&&operation.data.operation_id!==operationId)throw new WorkflowError('CONFLICT','Requested installation operation differs');
  if (operation.data.intent === 'undo' && mode !== 'undo') incomplete('A partial undo must be continued with undo');
  const plan = prepare(operation.data), journal = operation.data;
  inspectTemporary(root, journal);
  if (journal.phase !== 'committed') for (const entry of journal.files) classify(root, entry, mode);
  else plan.verify();
  if(preview)return {action:'preview',kind:'installation',operation_id:journal.operation_id,mode,targets:journal.files.map(entry=>({path:entry.path,kind:entry.kind,action:journal.phase==='committed'?'verify':mode==='undo'?'restore':'resume'})),lock_action:owner?'release_verified_owner':'none',acceptance_verified:false};
  if (owner) releaseLock(root, bytes, io);
  const lock = takeNewLock(root, journal.operation_id, io, journal.created_dirs, journal.nonce);
  let saved = operation.bytes;
  const save = () => { const next = Buffer.from(JSON.stringify(journal, null, 2) + '\n'); durableWrite(root, operation.path, next, saved, io, journal.created_dirs); saved = next; };
  try {
    journal.nonce = lock.owner.nonce;
    cleanTemporary(root, journal, io);
    if (journal.phase === 'committed') { save(); releaseLock(root, lock.bytes, io); return { action: 'resumed', project: root, version: journal.package.version, client_validation: 'not_run' }; }
    journal.intent = mode === 'undo' ? 'undo' : 'apply'; journal.phase = 'applying'; save();
    for (const entry of mode === 'undo' ? [...journal.files].reverse() : journal.files) {
      const state = classify(root, entry, mode), current = readProjectFile(root, entry.path), before = decode(entry.before), after = decode(entry.after);
      if (mode === 'undo') {
        if (state === 'applied') {
          if (entry.kind === 'file') {
            if (!equalBytes(readProjectFile(root, entry.path), after)) throw new WorkflowError('CONFLICT', 'Target changed during undo');
            if (before === null) io.unlinkSync(projectPath(root, entry.path)); else { const temporary = registerTemporary(journal, entry, before); save(); durableWrite(root, entry.path, before, current, io, journal.created_dirs, temporary); }
          } else {
            const post = parseManagedBlock(after, entry.kind).bytes, pre = parseManagedBlock(before || Buffer.alloc(0), entry.kind)?.bytes || null;
            const restored = equalBytes(current, after) && before !== null ? before : replaceManagedBlock(current, entry.kind, post, pre);
            if (before === null && equalBytes(current, after)) io.unlinkSync(projectPath(root, entry.path)); else { const temporary = registerTemporary(journal, entry, restored); save(); durableWrite(root, entry.path, restored, current, io, journal.created_dirs, temporary); }
          }
        }
        journal.temporary = null; entry.status = 'undone'; save();
      } else {
        if (entry.path === '.ai-workflow/manifest.json') plan.verify();
        if (state === 'pending') {
          let next = after;
          if (entry.kind !== 'file') {
            next = replaceManagedBlock(current, entry.kind, parseManagedBlock(before || Buffer.alloc(0), entry.kind)?.bytes || null, parseManagedBlock(after, entry.kind).bytes);
            entry.before = encode(current); entry.before_sha256 = current === null ? null : sha256(current); entry.after = encode(next); save();
          }
          ensureParent(root, entry.path, io, journal.created_dirs); save();
          const temporary = registerTemporary(journal, entry, next); save();
          durableWrite(root, entry.path, next, current, io, journal.created_dirs, temporary);
        }
        journal.temporary = null; entry.status = 'applied'; save();
      }
    }
    const retainedDirectories = [];
    if (mode === 'undo') {
      for (const path of [...new Set(journal.created_dirs)].reverse()) {
        if (path === '.ai-workflow' || path.startsWith(local)) continue;
        try { io.rmdirSync(projectPath(root, path)); } catch (error) { if (['ENOTEMPTY', 'EEXIST'].includes(error.code)) retainedDirectories.push(path); else if (error.code !== 'ENOENT') throw error; }
      }
      journal.phase = 'rolled_back';
    } else { plan.verify(); journal.phase = 'committed'; }
    save(); releaseLock(root, lock.bytes, io);
    return { action: mode === 'undo' ? 'undone' : 'resumed', project: root, version: journal.package.version, client_validation: 'not_run', resources: mode === 'undo' ? journal.action === 'repaired' ? 'incomplete' : 'not_installed' : 'valid', retained_directories: retainedDirectories };
  } catch (error) {
    if (!['committed', 'rolled_back'].includes(journal.phase)) { journal.phase = 'blocked'; try { save(); } catch { /* Preserve changed journal contents. */ } }
    try { releaseLock(root, lock.bytes, io); } catch { /* Preserve uncertain ownership. */ }
    throw error;
  }
}
