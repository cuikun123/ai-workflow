import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTestEvents } from '../../scripts/check-results.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const summary = (file, passed = 1) => ({ type: 'test:summary', data: { file, success: true, counts: { tests: passed, passed, failed: 0, cancelled: 0, skipped: 0, todo: 0 } } });

test('ci: zero tests, missing required suites, skips, failures and todos fail the gate', () => {
  const suite = ['tests/runtime/state.test.mjs'];
  assert.throws(() => evaluateTestEvents([], suite));
  const passed = [{ type: 'test:pass', data: { file: suite[0], name: 'valid', nesting: 0 } }, summary(suite[0]), summary(undefined)];
  assert.equal(evaluateTestEvents(passed, suite).passed, 1);
  for (const event of [
    { type: 'test:pass', data: { file: suite[0], skip: true } },
    { type: 'test:pass', data: { file: suite[0], todo: true } },
    { type: 'test:fail', data: { file: suite[0] } },
  ]) assert.throws(() => evaluateTestEvents([...passed, event], suite));
  assert.throws(() => evaluateTestEvents(passed, ['tests/missing.test.mjs']));
  assert.throws(() => evaluateTestEvents([summary(suite[0], 0), summary(undefined, 0)], suite));
  assert.throws(() => evaluateTestEvents(passed.filter(e => e.type !== 'test:summary'), suite));
});

test('ci: real per-file summaries attribute helper-registered tests and reject empty required files', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow ci events '));
  const required = join(root, 'package.test.mjs'), empty = join(root, 'empty.test.mjs');
  writeFileSync(join(root, 'helper.mjs'), "import test from 'node:test'; export function register() { test('registered by helper', () => {}); }\n");
  writeFileSync(required, "import { register } from './helper.mjs'; register();\n");
  writeFileSync(empty, 'export {};\n');
  const runner = join(root, 'runner.mjs');
  writeFileSync(runner, "import { run } from 'node:test'; for await (const event of run({files:process.argv.slice(2),concurrency:1})) console.log(JSON.stringify(event));\n");
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [runner, required, empty], { encoding: 'utf8', windowsHide: true, env });
  assert.equal(result.status, 0, result.stderr);
  const events = result.stdout.trim().split('\n').map(JSON.parse);
  assert.ok(events.some(e => e.type === 'test:pass' && e.data.file.endsWith('helper.mjs')), result.stdout);
  assert.equal(evaluateTestEvents(events, [required]).passed, 1);
  assert.throws(() => evaluateTestEvents(events, [required, empty]));
});

test('ci: nested same-name tests cannot replace a required suite', () => {
  const events = [summary('tests/old/tests/runtime/state.test.mjs'), summary(undefined)];
  assert.throws(() => evaluateTestEvents(events, ['tests/runtime/state.test.mjs']));
});
