import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, cpSync, mkdtempSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

export function registerSkillPackageTests(source, skillName, licenseDigests) {
source = resolve(source);

test(`${skillName}: discovery metadata and uniform two-file package`, () => {
  const entries = readdirSync(source, { withFileTypes: true });
  assert.deepEqual(entries.map(entry => entry.name).sort(), ['NOTICE.md', 'SKILL.md']);
  assert.ok(entries.every(entry => entry.isFile() && !entry.isSymbolicLink()), 'Package contains regular files only');
  const markdown = readFileSync(join(source, 'SKILL.md'), 'utf8');
  const frontmatter = markdown.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
  assert.ok(frontmatter, 'Missing closed YAML frontmatter');
  const name = frontmatter[1].match(/^name: ([a-z0-9]+(?:-[a-z0-9]+)*)\r?$/m)?.[1];
  assert.ok(name && name.length <= 64, 'Invalid discoverable name');
  assert.equal(name, source.split(/[\\/]/).at(-1), 'Folder and skill names must agree');
  const description = JSON.parse(frontmatter[1].match(/^description: (".*")\r?$/m)?.[1] || 'null');
  assert.ok(typeof description === 'string' && description.length > 0 && description.length <= 1024);
  // This checks the scalar forms actually used here, not arbitrary YAML.
});

test(`${skillName}: portable local resources`, () => {
  assert.ok(existsSync(join(source, 'SKILL.md')), 'The skill entrypoint must exist');
  const project = mkdtempSync(join(tmpdir(), 'ai-workflow-skill-package-'));
  const installed = join(project, '.agents/skills', skillName);
  cpSync(source, installed, { recursive: true, errorOnExist: true, force: false });
  let visited = 0;
  function visit(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      assert.ok(!entry.isSymbolicLink(), 'Bundle must not depend on a machine-local symlink');
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.md')) {
        // Fenced license/source examples are literal text, not package resource links.
        const prose = readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
        for (const match of prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
          if (/^https:\/\//.test(match[1])) continue;
          const [local, fragment] = match[1].split('#');
          const target = local ? resolve(dirname(file), decodeURIComponent(local)) : file;
          const rel = relative(installed, target);
          assert.ok(!rel.startsWith('..') && !/^([a-z]:|\/)/i.test(rel), `External resource: ${local}`);
          assert.ok(existsSync(target), `Missing packaged resource: ${local}`);
          if (fragment) {
            const body = readFileSync(target, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
            const headings = [...body.matchAll(/^#{1,6} (.+)\r?$/gm)].map(m => m[1].trim().toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-'));
            assert.ok(headings.includes(decodeURIComponent(fragment)), `Missing packaged heading: ${match[1]}`);
          }
          visited++;
        }
      }
    }
  }
  visit(installed);
  assert.ok(visited > 0, 'Attribution and any supporting resources must travel with the skill');
});

test(`${skillName}: complete upstream licenses in NOTICE`, () => {
  const notice = readFileSync(join(source, 'NOTICE.md'), 'utf8').replaceAll('\r\n', '\n');
  const actual = [...notice.matchAll(/```text\n(MIT License\n[\s\S]+?)```/g)].map(m => createHash('sha256').update(m[1], 'utf8').digest('hex'));
  assert.deepEqual(actual.sort(), Object.values(licenseDigests).sort(), 'Every upstream license must survive intact in NOTICE');
});
}
