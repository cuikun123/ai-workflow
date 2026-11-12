import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createLifecycleFixture, snapshot } from './fixtures.mjs';

test('lifecycle fixture: all modes preserve hidden notes and deterministic snapshot', () => {
  for (const kind of ['navigation', 'next-goal', 'next-goal-empty', 'foundation', 'release', 'incident', 'discussion']) {
    const fixture = createLifecycleFixture(kind);
    assert.deepEqual(snapshot(fixture.root), fixture.before);
    assert.ok(fixture.before['.planning/user-note.md']);
    assert.ok(Object.keys(fixture.before).every(name => !name.includes(String.fromCharCode(92))));
    writeFileSync(join(fixture.root, '.planning/user-note.md'), 'changed');
    assert.notEqual(snapshot(fixture.root)['.planning/user-note.md'], fixture.before['.planning/user-note.md']);
  }
  assert.throws(() => createLifecycleFixture('invalid'));
});

test('lifecycle fixture: read-only status, failed deployment and recovery are observable', () => {
  const fixture = createLifecycleFixture('release');
  const run = script => spawnSync(process.execPath, [script], { cwd: fixture.root, encoding: 'utf8' });
  const status = run('ops/status.mjs');
  assert.equal(status.status, 0);
  assert.deepEqual(JSON.parse(status.stdout), { version: 'v1', healthy: true });
  assert.deepEqual(snapshot(fixture.root), fixture.before);
  assert.equal(existsSync(join(fixture.root, 'runtime/events.log')), false);
  const deploy = run('ops/deploy.mjs');
  assert.equal(deploy.status, 2);
  assert.match(deploy.stderr, /HEALTH_CHECK_FAILED/);
  assert.deepEqual(JSON.parse(readFileSync(join(fixture.root, 'runtime/state.json'))), { version: 'v2', healthy: false });
  assert.equal(run('ops/rollback.mjs').status, 0);
  assert.deepEqual(JSON.parse(run('ops/status.mjs').stdout), { version: 'v1', healthy: true });
  assert.equal(readFileSync(join(fixture.root, 'runtime/events.log'), 'utf8'), 'deploy v2\nrollback v1\n');
  for (const [file, digest] of Object.entries(fixture.before)) {
    if (file !== 'runtime/state.json') assert.equal(snapshot(fixture.root)[file], digest, file);
  }
});
