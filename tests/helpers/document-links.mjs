import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {markdownLines, heading} from '../../src/spec-docs.mjs';

const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/gu, '-');
export function brokenDocumentLinks(root, entries = ['README.md', 'docs/README.md']) {
  root = resolve(root);
  const pending = entries.map(path => resolve(root, path)), seen = new Set(), issues = [];
  while (pending.length) {
    const path = pending.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    if (!existsSync(path)) { issues.push(relative(root, path) + ': missing document'); continue; }
    const rows = markdownLines(readFileSync(path, 'utf8')).rows.filter(row => !row.hidden);
    for (const row of rows) for (const match of row.line.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/gu)) {
      const link = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(link)) continue;
      const [local, fragment] = link.split('#'), target = local ? resolve(dirname(path), decodeURIComponent(local)) : path;
      const rel = relative(root, target);
      if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(target)) {
        issues.push(relative(root, path) + ': missing target ' + link); continue;
      }
      if (target.endsWith('.md')) {
        if (fragment) {
          const body = readFileSync(target, 'utf8'), anchors = new Set(), counts = new Map();
          for (const item of markdownLines(body).rows.filter(row => !row.hidden)) {
            const h = heading(item.line);
            if (h) { const key = slug(h.title), count = counts.get(key) || 0; anchors.add(key + (count ? '-' + count : '')); counts.set(key, count + 1); }
            for (const id of item.line.matchAll(/<a\s+id="([^"]+)"/gu)) anchors.add(id[1]);
          }
          if (!anchors.has(decodeURIComponent(fragment))) issues.push(relative(root, path) + ': missing heading ' + link);
        }
        pending.push(target);
      }
    }
  }
  return issues;
}
