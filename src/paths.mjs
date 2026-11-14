import { lstatSync, readdirSync } from 'node:fs';
import { resolve, parse, join, relative, isAbsolute, sep } from 'node:path';
import { WorkflowError } from './errors.mjs';
const fail = message => { throw new WorkflowError('PACKAGE_INVALID', message); };

export function isWithin(parent, child) {
  const path = relative(parent, child);
  return !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
}

export function assertPortablePath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || /[\\:\x00-\x1f\x7f<>"|?*%]/u.test(value)) fail('Invalid portable relative path');
  const segments = value.split('/');
  if (segments.some(s => !s || s === '.' || s === '..' || /[.\s]$/u.test(s) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(s))) fail('Unsafe relative path');
  return value;
}

export function assertSafeRoot(root) {
  const absolute = resolve(root), parsed = parse(absolute);
  if (process.platform === 'win32' && absolute.startsWith('\\\\')) fail('Network paths are not supported');
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, segment);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) fail('Package root must contain only real directories');
  }
  return absolute;
}

export function resolveRegularFile(root, relativePath) {
  assertPortablePath(relativePath); let current = assertSafeRoot(root);
  const segments = relativePath.split('/');
  for (const [i, segment] of segments.entries()) {
    current = join(current, segment); const stat = lstatSync(current, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink() || (i === segments.length - 1 ? !stat.isFile() : !stat.isDirectory())) fail('Missing or linked package resource: ' + relativePath);
  }
  return current;
}

export function listRegularFiles(root) {
  root = assertSafeRoot(root); const files = [], identities = new Set();
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + entry.name; assertPortablePath(name);
      const key = name.normalize('NFC').toLowerCase();
      if (identities.has(key)) fail('Case or Unicode collision: ' + name); identities.add(key);
      if (entry.isSymbolicLink()) fail('Linked resource: ' + name);
      if (entry.isDirectory()) visit(join(directory, entry.name), name + '/');
      else if (entry.isFile()) files.push(name);
      else fail('Non-regular resource: ' + name);
    }
  }
  visit(root); return files.sort();
}
