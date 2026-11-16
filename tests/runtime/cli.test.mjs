import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resourcePackage, project, snapshot } from '../helpers/installation.mjs';
const entry = fileURLToPath(new URL('../../bin/iterlane.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', windowsHide: true });
test('cli: help and version expose the implemented tool interfaces', () => {
  const help = run(['--help']); assert.equal(help.status, 0);
  assert.match(help.stdout, /check/); assert.match(help.stdout, /validate/); assert.match(help.stdout, /init/); assert.match(help.stdout, /upgrade/); assert.match(help.stdout, /rollback/);
  assert.equal(run(['--version']).status, 0);
});
test('cli: invalid commands and options return JSON errors with exit 2', () => {
  for (const args of [['init'], ['validate'], ['validate', '--state'], ['check', '--state', 'x'], ['validate', '--state', 'x', '--state', 'y'], ['--version', 'extra'], ['check', '--wat'], ['--version', '--json']]) {
    const result = run([...args, '--json']); assert.equal(result.status, 2, result.stderr);
    assert.equal(JSON.parse(result.stdout).error.code, 'USAGE');
  }
});
test('cli: missing runtime dependencies return package errors, not raw module traces', () => {
  const source = fileURLToPath(new URL('../../', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'workflow missing deps '));
  for (const path of ['bin', 'src', 'schemas', 'templates']) cpSync(join(source, path), join(dir, path), { recursive: true });
  cpSync(join(source, 'package.json'), join(dir, 'package.json'));
  const state = join(dir, 'input.yaml'); writeFileSync(state, '{}');
  const result = spawnSync(process.execPath, [join(dir, 'bin/iterlane.mjs'), 'validate', '--state', state, '--json'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, NODE_PATH: '' } });
  assert.equal(result.status, 4, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).error.code, 'PACKAGE_INVALID');
  assert.equal(result.stderr, '');
});
test('cli: invalid YAML produces structured state error without modifying input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workflow cli 中文 ')), file = join(dir, 'state.yaml');
  writeFileSync(file, 'bad: yaml');
  const result = run(['validate', '--state', file, '--json']);
  assert.equal(result.status, 5); assert.equal(JSON.parse(result.stdout).error.code, 'STATE_INVALID');
  assert.equal(readFileSync(file, 'utf8'), 'bad: yaml');
});
test('cli: invalid UTF-8 is rejected without changing input bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow utf8 ')), file = join(root, 'state.yaml');
  const bytes = Buffer.from([0xff, 0xfe, 0x61]); writeFileSync(file, bytes);
  const result = run(['validate', '--state', file, '--json']);
  assert.equal(result.status, 5); assert.equal(JSON.parse(result.stdout).error.code, 'STATE_INVALID');
  assert.deepEqual(readFileSync(file), bytes);
});

test('cli: initialization modes require an explicit target and reject conflicting flags', () => {
  for (const args of [
    ['init'], ['init', '--preview'], ['init', '--project', 'x', '--repair', '--resume'],
    ['init', '--project', 'x', '--preview', '--undo'], ['init', '--project', 'x', '--project', 'y'],
    ['check', '--package', 'x', '--project', 'y'], ['validate', '--project', 'x'],
  ]) {
    const result = run([...args, '--json']); assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).error.code, 'USAGE');
  }
});

test('cli: packaged preview is read only, init succeeds and installed entry finds its own project', async () => {
  const packageRoot = await resourcePackage(), root = project(), cli = join(packageRoot, 'bin/iterlane.mjs');
  const invoke = (file, args, cwd) => spawnSync(process.execPath, [file, ...args, '--json'], { cwd, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const original = snapshot(root, true), preview = invoke(cli, ['init', '--project', root, '--preview']);
  assert.equal(preview.status, 0, preview.stdout + preview.stderr); assert.equal(JSON.parse(preview.stdout).data.action, 'preview');
  assert.deepEqual(snapshot(root, true), original);
  const initialized = invoke(cli, ['init', '--project', root]);
  assert.equal(initialized.status, 0, initialized.stdout + initialized.stderr);
  assert.equal(JSON.parse(initialized.stdout).data.client_validation, 'not_run');
  const installed = join(root, '.ai-workflow/bin/iterlane.mjs'), other = project();
  const checked = invoke(installed, ['check'], other);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr); assert.equal(JSON.parse(checked.stdout).data.resources, 'valid');
  assert.equal(invoke(installed, ['init', '--project', other], other).status, 2);
  assert.deepEqual(snapshot(other, true), {});
});
