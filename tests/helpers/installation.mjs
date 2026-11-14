import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { buildPackage } from '../../scripts/build.mjs';

export const project = () => mkdtempSync(join(tmpdir(), 'iterlane project 中文 '));
export async function resourcePackage(packageRoot = join(project(), 'package')) {
  await buildPackage(packageRoot); return packageRoot;
}
export function snapshot(root, local = false) {
  const entries = {};
  function scan(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (!local && path === '.ai-workflow/.local') continue;
      if (entry.isDirectory()) scan(join(dir, entry.name), path + '/');
      else if (entry.isFile()) entries[path] = createHash('sha256').update(readFileSync(join(dir, entry.name))).digest('hex');
    }
  }
  scan(root); return entries;
}
