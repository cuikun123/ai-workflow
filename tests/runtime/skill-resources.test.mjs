import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSkillPackageStructure } from '../helpers/skill-package.mjs';
test('skills: nested references, templates and scripts can accompany the two required files', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow skill resources '));
  for (const file of ['SKILL.md', 'NOTICE.md']) writeFileSync(join(root, file), 'required');
  for (const folder of ['references', 'templates', 'scripts']) { mkdirSync(join(root, folder)); writeFileSync(join(root, folder, 'resource.txt'), 'resource'); }
  assert.doesNotThrow(() => assertSkillPackageStructure(root));
  const outside = mkdtempSync(join(tmpdir(), 'workflow skill outside '));
  symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => assertSkillPackageStructure(root));
});
