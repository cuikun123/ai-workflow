import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Mechanical part of the AGENTS.md documentation rules; reading quality still needs a human pass.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(join(repo, path), 'utf8');
const humanGuides = ['README.md', 'docs/README.md', 'docs/quickstart.md', 'docs/usage.md', 'docs/releasing.md',
  'scripts/README.md', 'skills/README.md', 'SECURITY.md', 'examples/README.md', 'examples/bookmarks/README.md', 'CONTRIBUTING.md'];
const navigation = ['README.md', 'docs/README.md'];

// Prose lines outside fenced code and tables, with link targets removed.
function prose(text) {
  let code = false;
  return text.split(/\r?\n/u).filter(line => {
    if (line.startsWith('```')) { code = !code; return false; }
    return !code && !line.startsWith('|');
  }).map(line => line.replace(/\]\([^)]*\)/gu, ']'));
}

test('document rules: human guides contain no internal decision or plan codes', () => {
  for (const path of humanGuides) {
    const text = read(path);
    assert.doesNotMatch(text, /(?<![A-Za-z0-9])D\d{2,3}(?![0-9])/u, path + ' references a decision number');
    assert.doesNotMatch(text, /(?<![A-Za-z0-9])C[1-7](?![0-9])/u, path + ' references an internal plan code');
    assert.doesNotMatch(text, /%LOCALAPPDATA%|ai-workflow-validation|C:[\\/]Users[\\/]/u, path + ' references local maintenance evidence');
  }
});

test('document rules: human guide paragraphs stay short enough to scan', () => {
  for (const path of humanGuides) for (const line of prose(read(path))) {
    assert.ok([...line].length <= 150, path + ' has a paragraph longer than 150 characters: ' + line.slice(0, 40));
  }
});

test('document rules: navigation pages carry no progress or acceptance status', () => {
  for (const path of navigation) {
    assert.doesNotMatch(read(path), /已验收|待验收|验收通过|已撤回|进行中/u, path + ' contains status text');
  }
});

test('document rules: handoff stays a short current snapshot', () => {
  const lines = read('docs/handoff.md').split(/\r?\n/u).filter(line => line.trim());
  assert.ok(lines.length <= 40, 'docs/handoff.md has ' + lines.length + ' non-empty lines; rewrite it as a snapshot');
  assert.doesNotMatch(read('docs/handoff.md'), /\b[0-9a-f]{64}\b/u, 'docs/handoff.md must not carry SHA256 evidence');
});
