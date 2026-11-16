import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, mkdirSync, symlinkSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { checkPackage, skillNames } from '../../src/package.mjs';
import { snapshot } from '../helpers/installation.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'workflow distribution 中文 '));
const dist = join(scratch, 'bundle');
const run = (file, args, options = {}) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000, ...options });
const build = () => run(join(repo, 'scripts/build.mjs'), ['--out', dist], { cwd: repo });
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');

test('distribution: build complete package then run offline after real npm pack/extract', () => {
  const built = build(); assert.equal(built.status, 0, built.stdout + built.stderr);
  assert.equal(checkPackage(dist).state_schemas[0], 1);
  const manifest = JSON.parse(readFileSync(join(dist, 'resource-manifest.json'), 'utf8'));
  assert.equal(manifest.files.filter(x => /^resources\/skills\/[^/]+\/SKILL.md$/.test(x.path)).length, 11);
  for (const name of skillNames) assert.equal(hash(join(dist, 'resources/skills', name, 'SKILL.md')), hash(join(repo, 'skills', name, 'SKILL.md')));
  const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const packed = run(npmCli, ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], { cwd: dist });
  assert.equal(packed.status, 0, packed.stdout + packed.stderr);
  const tarball = join(scratch, JSON.parse(packed.stdout)[0].filename);
  const extracted = join(scratch, 'extracted'); mkdirSync(extracted);
  const unpacked = spawnSync('tar', ['-xzf', tarball, '-C', extracted], { encoding: 'utf8', windowsHide: true });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  const root = join(extracted, 'package'), cli = join(root, 'bin/iterlane.mjs');
  const original = hash(join(root, 'resource-manifest.json'));
  const env = { ...process.env, NODE_PATH: '', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' };
  const checked = run(cli, ['check', '--json'], { cwd: scratch, env });
  assert.equal(checked.status, 0, checked.stdout + checked.stderr); assert.equal(JSON.parse(checked.stdout).ok, true);
  const file = join(scratch, 'state.yaml');
  writeFileSync(file, JSON.stringify({ schema_version: 1, revision: 0, current_iteration: null, current_task: null, phase: null, status: 'not_started', waiting_for: null, checkpoint_ref: null, confirmation_refs: [], blocker_refs: [], basis: [], updated_at: '2026-11-13T00:00:00Z' }));
  const validated = run(cli, ['validate', '--state', file, '--json'], { cwd: scratch, env });
  assert.equal(validated.status, 0, validated.stdout + validated.stderr);
  assert.equal(JSON.parse(validated.stdout).data.references_verified, false);
  assert.equal(hash(join(root, 'resource-manifest.json')), original);
  const notices = readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  for (const name of ['yaml', 'ajv', 'fast-uri', 'fast-deep-equal', 'json-schema-traverse', 'require-from-string']) assert.ok(notices.includes(name));
  assert.ok(!readdirSync(root).includes('node_modules'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'MIT');
  assert.equal(hash(join(root, 'LICENSE')), hash(join(repo, 'LICENSE')));
});

test('distribution: package integrity rejects corruption, omissions, extras and malicious inventory', () => {
  assert.equal(build().status, 0);
  const scenarios = [
    root => writeFileSync(join(root, 'resources/skills/workflow-guide/SKILL.md'), 'changed'),
    root => rmSync(join(root, 'resources/schemas/state-v1.schema.json')),
    root => writeFileSync(join(root, 'unexpected.txt'), 'extra'),
    root => { const f = join(root, 'resource-manifest.json'), m = JSON.parse(readFileSync(f)); m.files[0].path = '../outside'; writeFileSync(f, JSON.stringify(m)); },
    root => { const f = join(root, 'resource-manifest.json'), m = JSON.parse(readFileSync(f)); m.files.push(m.files[0]); writeFileSync(f, JSON.stringify(m)); },
    root => writeFileSync(join(root, 'resource-manifest.json'), '{}'),
    root => { const f = join(root, 'resource-manifest.json'), m = JSON.parse(readFileSync(f)); const path = 'resources/templates/project/AGENTS.md'; rmSync(join(root, path)); m.files = m.files.filter(x => x.path !== path); writeFileSync(f, JSON.stringify(m)); },
    root => { const f = join(root, 'resource-manifest.json'), m = JSON.parse(readFileSync(f)); const path = 'resources/skills/workflow-guide/NOTICE.md'; rmSync(join(root, path)); m.files = m.files.filter(x => x.path !== path); writeFileSync(f, JSON.stringify(m)); },
    root => { const f = join(root, 'resource-manifest.json'), m = JSON.parse(readFileSync(f)); const path = 'resources/templates/navigation.json'; rmSync(join(root, path)); m.files = m.files.filter(x => x.path !== path); writeFileSync(f, JSON.stringify(m)); },
    root => { rmSync(join(root, 'resources/skills/workflow-guide'), { recursive: true }); symlinkSync(join(repo, 'skills/workflow-guide'), join(root, 'resources/skills/workflow-guide'), process.platform === 'win32' ? 'junction' : 'dir'); },
  ];
  for (const [i, alter] of scenarios.entries()) {
    const root = join(scratch, `damaged-${i}`); cpSync(dist, root, { recursive: true }); alter(root);
    assert.throws(() => checkPackage(root), error => error.code === 'PACKAGE_INVALID');
    const cli = run(join(root, 'bin/iterlane.mjs'), ['check', '--json']);
    assert.equal(cli.status, 4, cli.stdout + cli.stderr);
    assert.equal(JSON.parse(cli.stdout).error.code, 'PACKAGE_INVALID');
  }
});

test('distribution: deterministic rebuild refuses unrelated directories and source overwrites', () => {
  assert.equal(build().status, 0); const before = hash(join(dist, 'resource-manifest.json'));
  assert.equal(build().status, 0); assert.equal(hash(join(dist, 'resource-manifest.json')), before);
  const unrelated = join(scratch, 'user data'); mkdirSync(unrelated); writeFileSync(join(unrelated, 'keep.txt'), 'keep');
  assert.notEqual(run(join(repo, 'scripts/build.mjs'), ['--out', unrelated], { cwd: repo }).status, 0);
  assert.equal(readFileSync(join(unrelated, 'keep.txt'), 'utf8'), 'keep');
  assert.notEqual(run(join(repo, 'scripts/build.mjs'), ['--out', repo], { cwd: repo }).status, 0);
});

test('distribution: internally consistent manifests cannot disguise mixed runtime identities or schemas', () => {
  assert.equal(build().status, 0);
  const scenarios = [
    { path: 'package.json', change: pkg => { pkg.version = '0.4.0'; }, manifest: m => { m.package.version = '0.4.0'; } },
    { path: 'resources/schemas/state-v1.schema.json', change: schema => { schema.properties.schema_version.const = 2; } },
    { path: 'package.json', change: pkg => { pkg.bin = {}; } },
    { path: 'package.json', change: pkg => { pkg.license = 'UNLICENSED'; } },
    { path: 'resources/templates/navigation.json', change: lines => { lines[1] = 'Changed navigation'; } },
    { path: 'resources/templates/manifest.json', change: layout => { layout.empty_files = []; } },
  ];
  for (const [i, scenario] of scenarios.entries()) {
    const root = join(scratch, `mixed-${i}`); cpSync(dist, root, { recursive: true });
    const file = join(root, scenario.path), data = JSON.parse(readFileSync(file, 'utf8'));
    scenario.change(data); writeFileSync(file, JSON.stringify(data));
    const manifestFile = join(root, 'resource-manifest.json'), manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const entry = manifest.files.find(entry => entry.path === scenario.path);
    entry.bytes = readFileSync(file).length; entry.sha256 = hash(file); scenario.manifest?.(manifest);
    writeFileSync(manifestFile, JSON.stringify(manifest));
    assert.throws(() => checkPackage(root), error => error.code === 'PACKAGE_INVALID', `mixed-${i}`);
    const result = run(join(root, 'bin/iterlane.mjs'), ['check', '--json']);
    assert.equal(result.status, 4, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).error.code, 'PACKAGE_INVALID');
  }
});

test('distribution: real npm artifact initializes and checks a project offline without source dependencies', () => {
  assert.equal(build().status, 0);
  const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const packed = run(npmCli, ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], { cwd: dist });
  assert.equal(packed.status, 0, packed.stderr);
  const extracted = join(scratch, 'installed-from-artifact'); mkdirSync(extracted);
  const unpacked = spawnSync('tar', ['-xzf', join(scratch, JSON.parse(packed.stdout)[0].filename), '-C', extracted], { encoding: 'utf8', windowsHide: true });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  const root = join(scratch, '业务 中文 project'); mkdirSync(root);
  const env = { ...process.env, NODE_PATH: '', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1' };
  const cli = join(extracted, 'package/bin/iterlane.mjs');
  const init = run(cli, ['init', '--project', root, '--json'], { cwd: scratch, env });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.equal(JSON.parse(init.stdout).data.client_validation, 'not_run');
  const installed = join(root, '.ai-workflow/bin/iterlane.mjs');
  const before = snapshot(root, true);
  assert.equal(run(installed, ['check', '--json'], { cwd: scratch, env }).status, 0);
  const state = run(installed, ['validate', '--state', join(root, 'docs/workflow/state.yaml'), '--json'], { cwd: scratch, env });
  assert.equal(state.status, 0, state.stdout + state.stderr); assert.equal(JSON.parse(state.stdout).data.acceptance_verified, false);
  const repeat = run(cli, ['init', '--project', root, '--json'], { cwd: scratch, env });
  assert.equal(repeat.status, 0, repeat.stdout + repeat.stderr); assert.equal(JSON.parse(repeat.stdout).data.action, 'unchanged');
  assert.deepEqual(snapshot(root, true), before);
  assert.deepEqual(readdirSync(join(root, '.ai-workflow/resources/skills')), ['_shared']);
});
