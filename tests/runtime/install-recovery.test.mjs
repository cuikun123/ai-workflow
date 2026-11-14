import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { project, resourcePackage, snapshot } from '../helpers/installation.mjs';
import { initializeProject, checkInstallation } from '../../src/installation.mjs';

let packageRoot; before(async () => { packageRoot = await resourcePackage(); });
const journalFile = root => {
  const folder = join(root, '.ai-workflow/.local/operations');
  return join(folder, fs.readdirSync(folder)[0], 'journal.json');
};
function interrupted(root, target) {
  let fired = false;
  const io = { ...fs, renameSync(from, to) {
    if (!fired && to === join(root, target)) { fired = true; throw Object.assign(new Error('Injected filesystem failure'), { code: 'EIO' }); }
    return fs.renameSync(from, to);
  } };
  assert.throws(() => initializeProject({ packageRoot, projectRoot: root, io }), error => error.code === 'EIO');
  assert.equal(fired, true);
  assert.throws(() => checkInstallation(root), error => error.code === 'INCOMPLETE');
}

test('install recovery: each resource, block, document, state and manifest boundary can resume', () => {
  for (const target of ['.ai-workflow/runtime/cli.mjs', 'AGENTS.md', '.gitignore', 'docs/iterations/000-foundation/scope.md', 'docs/workflow/state.yaml', '.ai-workflow/manifest.json']) {
    const root = project(); interrupted(root, target);
    assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed', target);
    assert.equal(checkInstallation(root).resources, 'valid', target);
  }
});

test('install recovery: undo preserves user additions and text outside owned blocks', () => {
  const root = project(); fs.writeFileSync(join(root, 'AGENTS.md'), 'Original rules\r\n');
  interrupted(root, '.ai-workflow/manifest.json');
  fs.appendFileSync(join(root, 'AGENTS.md'), '\r\nNew user rules\r\n');
  fs.writeFileSync(join(root, 'docs/my-new.md'), 'Keep user document');
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'undo' }).action, 'undone');
  const agents = fs.readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('Original rules\r\n')); assert.ok(agents.includes('New user rules'));
  assert.ok(!agents.includes('ai-workflow:begin'));
  assert.equal(fs.readFileSync(join(root, 'docs/my-new.md'), 'utf8'), 'Keep user document');
  assert.equal(fs.existsSync(join(root, 'docs/workflow/state.yaml')), false);
  assert.equal(fs.existsSync(join(root, '.agents/skills/workflow-guide/SKILL.md')), false);
});

test('install recovery: changed data stops both resume and undo before any further writes', () => {
  const root = project(); interrupted(root, '.ai-workflow/manifest.json');
  fs.writeFileSync(join(root, 'docs/iterations/000-foundation/tasks.md'), 'New user progress');
  for (const mode of ['resume', 'undo']) {
    const original = snapshot(root, true);
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode }), error => error.code === 'CONFLICT');
    assert.deepEqual(snapshot(root, true), original);
  }
});

test('install recovery: bad journal paths, altered payloads and mismatched locks are never executed', () => {
  for (const mutate of [
    data => { data.files[0].path = '../outside'; },
    data => { data.files[0].after = Buffer.from('Different resource').toString('base64'); },
    data => { data.extra_permission = 'approved'; },
  ]) {
    const root = project(); interrupted(root, '.ai-workflow/runtime/cli.mjs');
    const file = journalFile(root), data = JSON.parse(fs.readFileSync(file)); mutate(data); fs.writeFileSync(file, JSON.stringify(data));
    const original = snapshot(root, true);
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }));
    assert.deepEqual(snapshot(root, true), original);
  }
  const root = project(); interrupted(root, '.ai-workflow/runtime/cli.mjs');
  fs.writeFileSync(join(root, '.ai-workflow/.local/write.lock'), '{}'); const original = snapshot(root, true);
  assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }));
  assert.deepEqual(snapshot(root, true), original);
});

async function pausedWorker(root, trigger, mode = 'init') {
  const helperRoot = project(), signal = join(helperRoot, 'ready'), script = join(helperRoot, 'worker.mjs');
  const moduleUrl = new URL('../../src/installation.mjs', import.meta.url).href;
  fs.writeFileSync(script, `import * as fs from 'node:fs';\nimport {initializeProject} from ${JSON.stringify(moduleUrl)};\nconst [packageRoot,projectRoot,signal,trigger,mode]=process.argv.slice(2); let lockFd; const pause=()=>{fs.writeFileSync(signal,'ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);};\ninitializeProject({packageRoot,projectRoot,mode,io:{...fs,openSync(path,...args){const fd=fs.openSync(path,...args);if(path.endsWith('write.lock'))lockFd=fd;return fd;},closeSync(fd){fs.closeSync(fd);if(trigger==='retaken'&&fd===lockFd)pause();},renameSync(from,to){const journal=to.endsWith('journal.json')?JSON.parse(fs.readFileSync(from)):null;const normalized=to.split(String.fromCharCode(92)).join('/');const before=(trigger==='bootstrap'&&journal?.phase==='prepared')||(trigger==='resource_temp'&&normalized.endsWith('/runtime/cli.mjs'))||(trigger==='journal_temp'&&journal?.phase==='applying');if(before)pause();fs.renameSync(from,to);if((trigger==='committed'&&journal?.phase==='committed')||(trigger==='agents'&&to.endsWith('AGENTS.md')))pause();}}});\n`);
  const child = spawn(process.execPath, [script, packageRoot, root, signal, trigger, mode], { windowsHide: true, stdio: 'ignore' });
  const done = once(child, 'exit');
  for (let attempt = 0; attempt < 1000 && !fs.existsSync(signal); attempt++) {
    if (child.exitCode !== null) throw new Error('Worker exited before its real write boundary');
    await delay(20);
  }
  if (!fs.existsSync(signal)) { child.kill('SIGKILL'); await done; throw new Error('Worker did not reach its boundary'); }
  return { child, done };
}

test('install recovery: another live process cannot write and actual termination before journal update resumes', async () => {
  const root = project(), { child, done } = await pausedWorker(root, 'agents');
  try {
    const original = snapshot(root, true);
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root }), error => error.code === 'INCOMPLETE');
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }), error => error.code === 'INCOMPLETE');
    assert.deepEqual(snapshot(root, true), original);
  } finally { child.kill('SIGKILL'); await done; }
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed');
  assert.equal(checkInstallation(root).resources, 'valid');
});

test('install recovery: termination before a durable journal blocks without adopting metadata', async () => {
  const root = project(), { child, done } = await pausedWorker(root, 'bootstrap');
  child.kill('SIGKILL'); await done;
  const original = snapshot(root, true);
  assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }), error => error.code === 'INCOMPLETE');
  assert.deepEqual(snapshot(root, true), original);
  assert.equal(fs.existsSync(join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(join(root, 'docs/workflow/state.yaml')), false);
});

test('install recovery: termination after commit only completes lock cleanup, never resets business state', async () => {
  const root = project(), { child, done } = await pausedWorker(root, 'committed');
  child.kill('SIGKILL'); await done;
  const file = join(root, 'docs/workflow/state.yaml');
  const bytes = fs.readFileSync(file);
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed');
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(checkInstallation(root).resources, 'valid');
  assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'undo' }), error => error.code === 'INCOMPLETE');
});

test('install recovery: native read-only target rejects replacement and preserves original bytes', () => {
  assert.equal(process.platform, 'win32', 'This supported-host check requires native Windows');
  const root = project(), agents = join(root, 'AGENTS.md'), original = Buffer.from('Read-only user rules\r\n');
  fs.writeFileSync(agents, original); fs.chmodSync(agents, 0o444);
  try {
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root }), error => ['EPERM', 'EACCES', 'EBUSY'].includes(error.code));
    assert.deepEqual(fs.readFileSync(agents), original);
    assert.throws(() => checkInstallation(root), error => error.code === 'INCOMPLETE');
  } finally { fs.chmodSync(agents, 0o666); }
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed');
});

test('install recovery: native Windows file-sharing lock blocks rename without deleting the target', async () => {
  assert.equal(process.platform, 'win32', 'This supported-host check requires native Windows');
  const root = project(), agents = join(root, 'AGENTS.md'), helperRoot = project(), signal = join(helperRoot, 'locked');
  const original = Buffer.from('Exclusively opened user rules\r\n'); fs.writeFileSync(agents, original);
  const powershell = "$ErrorActionPreference='Stop'; $stream=[IO.File]::Open($env:ITERLANE_LOCKED_FILE,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None); try {[IO.File]::WriteAllText($env:ITERLANE_LOCK_SIGNAL,'ready'); [Console]::ReadLine() | Out-Null} finally {$stream.Dispose()}";
  let child, done, fired = false;
  const io = { ...fs, renameSync(from, to) {
    if (!fired && to === agents) {
      fired = true;
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(powershell, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, ITERLANE_LOCKED_FILE: agents, ITERLANE_LOCK_SIGNAL: signal } });
      done = once(child, 'exit');
      for (let attempt = 0; attempt < 500 && !fs.existsSync(signal); attempt++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      assert.equal(fs.existsSync(signal), true, 'Native helper did not acquire FileShare.None');
    }
    return fs.renameSync(from, to);
  } };
  try {
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root, io }), error => ['EPERM', 'EACCES', 'EBUSY'].includes(error.code));
    assert.equal(fired, true);
  } finally { if (child) { child.stdin.end('\n'); await done; } }
  assert.deepEqual(fs.readFileSync(agents), original);
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed');
});

test('install recovery: tampered block before-images cannot replace outside user content', () => {
  for (const path of ['AGENTS.md', '.gitignore']) {
    const root = project(); fs.writeFileSync(join(root, path), 'ORIGINAL USER CONTENT\r\n');
    interrupted(root, '.ai-workflow/manifest.json');
    const file = journalFile(root), journal = JSON.parse(fs.readFileSync(file));
    journal.files.find(entry => entry.path === path).before = Buffer.from('INJECTED CONTENT\r\n').toString('base64');
    fs.writeFileSync(file, JSON.stringify(journal)); const original = snapshot(root, true);
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'undo' }), error => error.code === 'CONFLICT');
    assert.deepEqual(snapshot(root, true), original);
  }
});

test('install recovery: termination while retaking a recovery lock remains recoverable', async () => {
  const root = project(); interrupted(root, '.ai-workflow/runtime/cli.mjs');
  const { child, done } = await pausedWorker(root, 'retaken', 'resume'); child.kill('SIGKILL'); await done;
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed');
  assert.equal(checkInstallation(root).resources, 'valid');
});

test('install recovery: resource and journal temporary-file termination can resume', async () => {
  for (const trigger of ['resource_temp', 'journal_temp']) {
    const root = project(), { child, done } = await pausedWorker(root, trigger); child.kill('SIGKILL'); await done;
    assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'resume' }).action, 'resumed', trigger);
    assert.equal(checkInstallation(root).resources, 'valid');
  }
});

test('install recovery: externally changed temporary bytes are preserved before resume or undo', async () => {
  const root = project(), { child, done } = await pausedWorker(root, 'resource_temp'); child.kill('SIGKILL'); await done;
  const dir = join(root, '.ai-workflow/runtime'), name = fs.readdirSync(dir).find(name => name.startsWith('cli.mjs.tmp-'));
  assert.ok(name); fs.writeFileSync(join(dir, name), 'FOREIGN TEMPORARY DATA');
  const original = snapshot(root, true);
  for (const mode of ['resume', 'undo']) {
    assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode }), error => error.code === 'CONFLICT');
    assert.deepEqual(snapshot(root, true), original);
  }
});

test('install recovery: undo of an interrupted repair reports the original incomplete installation', () => {
  const root = project(); initializeProject({ packageRoot, projectRoot: root });
  const target = join(root, '.agents/skills/workflow-guide/NOTICE.md'); fs.unlinkSync(target);
  const originalState = fs.readFileSync(join(root, 'docs/workflow/state.yaml'));
  const io = { ...fs, renameSync(from, to) { if (to === target) throw Object.assign(new Error('repair interrupted'), { code: 'EIO' }); return fs.renameSync(from, to); } };
  assert.throws(() => initializeProject({ packageRoot, projectRoot: root, mode: 'repair', io }));
  const result = initializeProject({ packageRoot, projectRoot: root, mode: 'undo' });
  assert.equal(result.action, 'undone'); assert.equal(result.resources, 'incomplete');
  assert.equal(fs.existsSync(join(root, '.ai-workflow/manifest.json')), true);
  assert.deepEqual(fs.readFileSync(join(root, 'docs/workflow/state.yaml')), originalState);
});
