import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, cpSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { project, resourcePackage, snapshot } from '../helpers/installation.mjs';
import { projectPath } from '../../src/project-paths.mjs';
import { createNavigationBlock, parseManagedBlock, replaceManagedBlock } from '../../src/managed-blocks.mjs';
import { planInstallation, initializeProject, checkInstallation } from '../../src/installation.mjs';
import { validateStateYaml } from '../../src/state.mjs';

let packageRoot; before(async () => { packageRoot = await resourcePackage(); });
const conflict = fn => assert.throws(fn, error => ['CONFLICT', 'INCOMPLETE'].includes(error.code));

test('installation: portable target paths reject links and case aliases without writes', () => {
  const root = project(), outside = project(); mkdirSync(join(root, 'Docs'));
  assert.equal(projectPath(root, '目录 with space/new.md'), join(root, '目录 with space/new.md'));
  for (const path of ['../outside', 'a/../b', 'docs/x.md', 'a/NUL.md', 'a:stream']) conflict(() => projectPath(root, path));
  symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  conflict(() => projectPath(root, 'linked/new.md'));
});

test('installation: managed blocks preserve outside bytes and reject changed or malformed markers', () => {
  const outside = Buffer.from('\ufeffUser rules\r\n'), block = createNavigationBlock('0.3.0-dev.1');
  const initial = replaceManagedBlock(outside, 'agents', null, block);
  assert.ok(initial.subarray(0, outside.length).equals(outside));
  assert.ok(parseManagedBlock(initial, 'agents').bytes.equals(block));
  const changedOutside = Buffer.concat([initial, Buffer.from('\r\nExtra user text\r\n')]);
  const restored = replaceManagedBlock(changedOutside, 'agents', block, null);
  assert.ok(restored.includes(outside)); assert.ok(restored.includes(Buffer.from('Extra user text')));
  conflict(() => replaceManagedBlock(initial, 'agents', Buffer.from('different'), block));
  for (const text of ['<!-- ai-workflow:begin -->', '<!-- ai-workflow:end -->', block.toString() + block.toString()]) conflict(() => parseManagedBlock(Buffer.from(text), 'agents'));
});

test('installation: preview never writes and initial state contains no acceptance', () => {
  const root = project(); writeFileSync(join(root, 'AGENTS.md'), 'Existing rules\r\n');
  const before = snapshot(root, true), plan = planInstallation({ packageRoot, projectRoot: root });
  assert.ok(plan.files.some(file => file.path === 'docs/workflow/state.yaml'));
  assert.deepEqual(snapshot(root, true), before);
  const result = initializeProject({ packageRoot, projectRoot: root });
  assert.equal(result.action, 'initialized'); assert.equal(result.client_validation, 'not_run');
  assert.equal(checkInstallation(root).resources, 'valid');
  const state = validateStateYaml(readFileSync(join(root, 'docs/workflow/state.yaml'), 'utf8'));
  assert.equal(state.revision, 0); assert.equal(state.current_task, null);
  assert.equal(state.status, 'not_started'); assert.deepEqual(state.confirmation_refs, []);
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /^Existing rules\r\n/);
});

test('installation: rerun preserves progress, business docs and other skills byte for byte', () => {
  const root = project(); mkdirSync(join(root, '.agents/skills/other'), { recursive: true });
  writeFileSync(join(root, '.agents/skills/other/SKILL.md'), 'user skill');
  initializeProject({ packageRoot, projectRoot: root });
  const stateFile = join(root, 'docs/workflow/state.yaml');
  const state = validateStateYaml(readFileSync(stateFile, 'utf8')); state.revision = 12;
  writeFileSync(stateFile, JSON.stringify(state));
  writeFileSync(join(root, 'docs/iterations/000-foundation/tasks.md'), 'User progress');
  const before = snapshot(root, true);
  assert.equal(initializeProject({ packageRoot, projectRoot: root }).action, 'unchanged');
  assert.deepEqual(snapshot(root, true), before);
});

test('installation: missing resources require explicit repair, changed resources and missing state stop', () => {
  const root = project(); initializeProject({ packageRoot, projectRoot: root });
  const skill = join(root, '.agents/skills/workflow-guide/NOTICE.md'); rmSync(skill);
  conflict(() => initializeProject({ packageRoot, projectRoot: root }));
  assert.equal(initializeProject({ packageRoot, projectRoot: root, mode: 'repair' }).action, 'repaired');
  assert.equal(checkInstallation(root).resources, 'valid');
  writeFileSync(skill, 'User changes'); const before = snapshot(root, true);
  conflict(() => initializeProject({ packageRoot, projectRoot: root, mode: 'repair' }));
  assert.deepEqual(snapshot(root, true), before);
  rmSync(join(root, 'docs/workflow/state.yaml'));
  conflict(() => initializeProject({ packageRoot, projectRoot: root, mode: 'repair' }));
});

test('installation: unmanaged docs, old markers, unknown manifests and extra owned files are not adopted', () => {
  for (const prepare of [
    root => { mkdirSync(join(root, 'docs/workflow'), { recursive: true }); writeFileSync(join(root, 'docs/workflow/state.yaml'), 'old progress'); },
    root => writeFileSync(join(root, 'AGENTS.md'), createNavigationBlock('old')),
    root => { mkdirSync(join(root, '.ai-workflow')); writeFileSync(join(root, '.ai-workflow/manifest.json'), '{}'); },
  ]) {
    const root = project(); prepare(root); const before = snapshot(root, true);
    conflict(() => initializeProject({ packageRoot, projectRoot: root })); assert.deepEqual(snapshot(root, true), before);
  }
  const root = project(); initializeProject({ packageRoot, projectRoot: root });
  writeFileSync(join(root, '.agents/skills/workflow-guide/unknown.md'), 'unknown');
  conflict(() => checkInstallation(root));
});

test('installation: dot-prefixed descendants cannot place a project inside its source package', async () => {
  const source = await resourcePackage(), root = join(source, '..project'); mkdirSync(root);
  const original = snapshot(source, true);
  conflict(() => initializeProject({ packageRoot: source, projectRoot: root }));
  assert.deepEqual(snapshot(source, true), original);
});

test('installation: missing checkpoint, confirmation and blocker files stop initialization', () => {
  const root = project(); initializeProject({ packageRoot, projectRoot: root });
  const file = join(root, 'docs/workflow/state.yaml'), initial = validateStateYaml(readFileSync(file, 'utf8'));
  const ref = { path: 'docs/iterations/000-foundation/missing.md', record_id: 'record-1' };
  for (const patch of [{ status: 'paused', checkpoint_ref: ref }, { confirmation_refs: [ref] }, { status: 'blocked', blocker_refs: [ref] }]) {
    writeFileSync(file, JSON.stringify({ ...initial, ...patch })); const original = snapshot(root, true);
    conflict(() => checkInstallation(root)); conflict(() => initializeProject({ packageRoot, projectRoot: root }));
    assert.deepEqual(snapshot(root, true), original);
  }
});

test('installation: navigation growth beyond the text limit fails during read-only planning', () => {
  const root = project(); writeFileSync(join(root, 'AGENTS.md'), Buffer.alloc(1024 * 1024, 'x'));
  const original = snapshot(root, true);
  conflict(() => planInstallation({ packageRoot, projectRoot: root }));
  assert.deepEqual(snapshot(root, true), original);
});

test('installation: recovery also rejects a project containing the protected source package', async () => {
  const root = project(); mkdirSync(join(root, 'docs'));
  const source = await resourcePackage(join(root, 'docs/workflow')), failed = project();
  const fs = await import('node:fs');
  const io = { ...fs, renameSync(from, to) { if (to === join(failed, '.ai-workflow/runtime/cli.mjs')) throw Object.assign(new Error('failure'), { code: 'EIO' }); return fs.renameSync(from, to); } };
  assert.throws(() => initializeProject({ packageRoot: source, projectRoot: failed, io }));
  for (const path of ['.ai-workflow', '.agents']) cpSync(join(failed, path), join(root, path), { recursive: true });
  const operations = join(root, '.ai-workflow/.local/operations'), file = join(operations, readdirSync(operations)[0], 'journal.json');
  const journal = JSON.parse(readFileSync(file)); journal.project_root = realpathSync.native(root); writeFileSync(file, JSON.stringify(journal));
  const original = snapshot(root, true);
  assert.throws(() => initializeProject({ packageRoot: source, projectRoot: root, mode: 'resume' }), error => error.code === 'CONFLICT');
  assert.deepEqual(snapshot(root, true), original);
});
