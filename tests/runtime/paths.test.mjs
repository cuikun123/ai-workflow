import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertPortablePath, resolveRegularFile } from '../../src/paths.mjs';
import * as pathTools from '../../src/paths.mjs';

test('paths: accept portable Unicode and space paths and reject Windows aliases', () => {
  assert.equal(assertPortablePath('目录 with space/file.md'), '目录 with space/file.md');
  for (const path of ['', '../a', 'a/./b', '/a', 'C:a', 'a\\b', 'a//b', 'a/NUL.md', 'con', 'a/COM1.txt', 'a/LPT9', 'a/trailing.', 'a/trailing ', 'a/stream:ads', 'a/?', 'a/\u0000', 'a/%2e%2e/b']) {
    assert.throws(() => assertPortablePath(path), error => error.code === 'PACKAGE_INVALID');
  }
});

test('paths: reject symbolic-link directories and files without following them', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-paths-'));
  const outside = mkdtempSync(join(tmpdir(), 'workflow-outside-'));
  writeFileSync(join(outside, 'secret.txt'), 'do not read');
  mkdirSync(join(root, 'safe')); writeFileSync(join(root, 'safe/a.txt'), 'ok');
  assert.equal(resolveRegularFile(root, 'safe/a.txt'), join(root, 'safe/a.txt'));
  symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => resolveRegularFile(root, 'linked/secret.txt'), error => error.code === 'PACKAGE_INVALID');
  assert.throws(() => resolveRegularFile(root, 'missing.txt'), error => error.code === 'PACKAGE_INVALID');
});

test('paths: containment distinguishes parent segments from legitimate dot-prefixed names', () => {
  const root = mkdtempSync(join(tmpdir(), 'iterlane containment ')), child = join(root, '..project');
  assert.equal(pathTools.isWithin(root, child), true);
  assert.equal(pathTools.isWithin(child, root), false);
  assert.equal(pathTools.isWithin(root, root), true);
});
