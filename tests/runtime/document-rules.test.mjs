import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {basename, dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {heading, markdownLines} from '../../src/spec-docs.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const scanRoot = process.env.ITERLANE_DOC_ROOT ? resolve(process.env.ITERLANE_DOC_ROOT) : repo;

function markdownFiles(directory = scanRoot) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['.git', '.artifacts', 'node_modules', 'dist', 'build'].includes(entry.name)) return [];
      return markdownFiles(path);
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [path] : [];
  });
}

function isHumanDocument(path) {
  const name = relative(scanRoot, path).replaceAll('\\', '/');
  if (/(?:^|-)notice\.md$/iu.test(basename(name)) || basename(name).toLowerCase() === 'third_party_notices.md') return false;
  if (name.startsWith('tests/') && (name.split('/').includes('fixtures') || name.endsWith('/scenarios.md'))) return false;
  if (/(?:^|\/)skills\//u.test(name) && name !== 'skills/README.md') return false;
  return true;
}

const humanDocs = markdownFiles().filter(isHumanDocument);
const docText = path => readFileSync(path, 'utf8');
function readerDocumentLinkIssues() {
  const issues = [];
  const withinRepo = path => {
    const rel = relative(scanRoot, path);
    return !rel.startsWith('..') && !isAbsolute(rel);
  };
  for (const source of humanDocs) {
    const rows = markdownLines(docText(source)).rows.filter(row => !row.hidden);
    for (const row of rows) for (const match of row.line.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/gu)) {
      const link = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(link)) continue;
      const [local, fragment] = link.split('#');
      const target = local ? resolve(dirname(source), decodeURIComponent(local)) : source;
      if (!withinRepo(target) || !existsSync(target)) {
        issues.push(relative(scanRoot, source) + ': missing target ' + link);
        continue;
      }
      if (!fragment || !target.endsWith('.md')) continue;
      const anchors = new Set(), counts = new Map();
      for (const targetRow of markdownLines(docText(target)).rows.filter(targetRow => !targetRow.hidden)) {
        const h = heading(targetRow.line);
        if (h) {
          const slug = h.title.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/gu, '-');
          const count = counts.get(slug) || 0;
          anchors.add(slug + (count ? '-' + count : ''));
          counts.set(slug, count + 1);
        }
        for (const anchor of targetRow.line.matchAll(/<a\s+id="([^"]+)"/gu)) anchors.add(anchor[1]);
      }
      if (!anchors.has(decodeURIComponent(fragment))) issues.push(relative(scanRoot, source) + ': missing heading ' + link);
    }
  }
  return issues;
}

test('document rules: scope includes reader docs and excludes machine-only Markdown', () => {
  if (scanRoot !== repo) {
    assert.ok(humanDocs.length, 'generated package should contain human-readable Markdown');
    assert.ok(humanDocs.some(path => /(?:^|\/)docs\//u.test(relative(scanRoot, path).replaceAll('\\', '/'))));
    return;
  }
  const paths = new Set(humanDocs.map(path => relative(scanRoot, path).replaceAll('\\', '/')));
  for (const path of [
    'AGENTS.md', 'README.md', 'CHANGELOG.md', 'docs/handoff.md', 'docs/decisions.md',
    'docs/roadmap.md', 'docs/design/workflow.md', 'tests/README.md', 'skills/README.md',
    'scripts/README.md', 'templates/project/AGENTS.md', 'schemas/README.md',
  ]) assert.ok(paths.has(path), path + ' must be checked');
  for (const path of [
    'tests/work-testing/scenarios.md', 'tests/task-execution/scenarios.md',
    'skills/execute-task/SKILL.md', 'skills/execute-task/references/implementation.md',
    'skills/execute-task/NOTICE.md', 'sources/openspec-NOTICE.md', 'sources/NOTICE.md',
  ]) assert.ok(!paths.has(path), path + ' must be excluded');
});

test('document rules: framework release versions appear only in designated pages', () => {
  const semver = /(?<![\d.])\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?![\d.])/gu;
  const allowed = new Set(['docs/releasing.md', 'skills/README.md', 'docs/skills.md']);
  const issues = [];
  for (const path of humanDocs) {
    const name = relative(scanRoot, path).replaceAll('\\', '/');
    if (allowed.has(name)) continue;
    if (semver.test(docText(path))) issues.push(name);
    semver.lastIndex = 0;
  }
  assert.deepEqual(issues, [], 'release versions found outside docs/releasing.md and skills/README.md: ' + issues.join(', '));
});

test('document rules: handoff stays within its line limit and carries no hashes', () => {
  if (scanRoot !== repo) return;
  const text = docText(join(scanRoot, 'docs/handoff.md'));
  const lines = text.split(/\r?\n/u).filter(line => line.trim());
  assert.ok(lines.length <= 40, 'docs/handoff.md has ' + lines.length + ' non-empty lines');
  assert.ok(!/\b[0-9a-f]{7,64}\b/iu.test(text), 'docs/handoff.md contains a hash');
});

test('document rules: human docs contain no internal tracking identifiers', () => {
  const internal = /(?<![A-Za-z0-9])(?:D\d{2,3}|C[1-7]|P\d{2}|U[1-5]|T\d+|#[0-9]{3,}|[0-9a-f]{7,64}|[0-9a-f]{8}-[0-9a-f-]{27})(?![A-Za-z0-9])/giu;
  const occurrences = [];
  for (const path of humanDocs) for (const [index, line] of docText(path).split(/\r?\n/u).entries()) {
    for (const match of line.matchAll(internal)) occurrences.push({path: relative(scanRoot, path), line: index + 1, value: match[0]});
  }
  const counts = occurrences.reduce((groups, occurrence) => {
    groups[occurrence.path] = (groups[occurrence.path] || 0) + 1;
    return groups;
  }, {});
  assert.ok(!occurrences.length, occurrences.length + ' internal identifier occurrences across documents: ' + Object.entries(counts).map(([path, count]) => path + ' (' + count + ')').join(', '));
});

test('document rules: headings use an unbroken hierarchy', () => {
  const issues = [];
  for (const path of humanDocs) {
    let inCode = false, previous = 0;
    for (const [index, line] of docText(path).split(/\r?\n/u).entries()) {
      if (line.trimStart().startsWith('```')) { inCode = !inCode; continue; }
      if (inCode) continue;
      const heading = /^(#{1,6})\s/u.exec(line);
      if (!heading) continue;
      const level = heading[1].length;
      if (previous && level > previous + 1) issues.push(relative(scanRoot, path) + ':' + (index + 1) + ': heading skips a level');
      previous = level;
    }
  }
  assert.deepEqual(issues, [], issues.join('\n'));
});

test('document rules: navigation pages contain no progress or acceptance status', () => {
  const navigation = humanDocs.filter(path => ['README.md', 'docs/README.md'].includes(relative(scanRoot, path).replaceAll('\\', '/')));
  const status = /已验收|待验收|验收通过|已撤回|进行中/u;
  for (const path of navigation) assert.ok(!status.test(docText(path)), relative(scanRoot, path) + ' contains progress status');
});

test('document rules: local links and page anchors resolve', () => {
  const issues = readerDocumentLinkIssues();
  assert.deepEqual(issues, [], issues.slice(0, 30).join('\n'));
});

test('document rules: link labels describe their destination', () => {
  const vague = /^(?:这里|此处|点击|点这里|更多|链接|here|click here|read more)$/iu;
  const issues = [];
  for (const path of humanDocs) for (const row of markdownLines(docText(path)).rows.filter(row => !row.hidden)) {
    for (const match of row.line.matchAll(/\[([^\]\n]+)\]\([^\s)]+\)/gu)) {
      if (vague.test(match[1].trim())) issues.push(relative(scanRoot, path));
    }
  }
  assert.ok(!issues.length, 'generic link labels found in ' + [...new Set(issues)].join(', '));
});

test('document rules: test guide omits internal names, abbreviations, counts, and local paths', () => {
  if (scanRoot !== repo) return;
  const text = docText(join(scanRoot, 'tests/README.md'));
  assert.ok(!/(?<![A-Za-z0-9])(?:D\d{2,3}|C[1-7]|P\d{2}|U[1-5]|T\d+|#[0-9]{3,}|[0-9a-f]{7,64}|[0-9a-f]{8}-[0-9a-f-]{27})(?![A-Za-z0-9])/iu.test(text), 'tests/README.md contains an internal identifier');
  assert.ok(!/(?:^|[\s(`])tests\/[^\s)`]+|\b[\w.-]+\.test\.(?:mjs|js)\b/imu.test(text), 'tests/README.md contains a test path or file name');
  assert.ok(!/\b[A-Z]{2,}\b/u.test(text), 'tests/README.md contains an abbreviation');
  assert.ok(!/\b\d+\s*\/\s*\d+\b|\b\d+\s*(?:项|份|个|次|条|字节|毫秒|秒|小时)\b/u.test(text), 'tests/README.md contains a test count');
  assert.ok(!/%LOCALAPPDATA%|ai-workflow-validation|[A-Z]:[\\/][^\s)`]+/u.test(text), 'tests/README.md contains a local path');
});
