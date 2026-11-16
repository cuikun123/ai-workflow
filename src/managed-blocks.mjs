import { TextDecoder } from 'node:util';
import { WorkflowError } from './errors.mjs';
import navigation from '../templates/navigation.json' with { type: 'json' };
import { skillNames } from './package.mjs';
import { assertPortablePath } from './paths.mjs';
const markers = {
  agents: ['<!-- ai-workflow:begin -->', '<!-- ai-workflow:end -->'],
  ignore: ['# iterlane:begin', '# iterlane:end'],
  attributes: ['# iterlane:attributes:begin', '# iterlane:attributes:end'],
};
export const initialBasisPaths = ['docs/project/overview.md', 'docs/iterations/000-foundation/scope.md', 'docs/iterations/000-foundation/tasks.md', 'docs/iterations/000-foundation/verification.md'];
const conflict = message => { throw new WorkflowError('CONFLICT', message); };
const bounded = bytes => { if (bytes.length > 1024 * 1024) conflict('Generated managed text exceeds 1 MiB'); return bytes; };
export function parseManagedBlock(bytes, kind) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 1024 * 1024 || !markers[kind]) conflict('Invalid managed text file');
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { conflict('Managed text must be valid UTF-8'); }
  const [begin, end] = markers[kind].map(value => Buffer.from(value));
  const start = bytes.indexOf(begin), endStart = bytes.indexOf(end);
  if (start === -1 && endStart === -1) return null;
  if (start === -1 || endStart < start + begin.length || bytes.indexOf(begin, start + begin.length) !== -1 || bytes.indexOf(end, endStart + end.length) !== -1) conflict('Missing, repeated or nested managed markers');
  for (const [position, marker] of [[start, begin], [endStart, end]]) {
    if ((position && bytes[position - 1] !== 10) || (position + marker.length < bytes.length && ![10, 13].includes(bytes[position + marker.length]))) conflict('Managed markers must occupy complete lines');
  }
  return { start, end: endStart + end.length, bytes: bytes.subarray(start, endStart + end.length) };
}
export function replaceManagedBlock(current, kind, expected, replacement) {
  const bytes = current || Buffer.alloc(0), block = parseManagedBlock(bytes, kind);
  if (expected === null ? block !== null : !block || !block.bytes.equals(expected)) conflict('Managed block changed; outside content was preserved');
  if (replacement !== null && !parseManagedBlock(replacement, kind)?.bytes.equals(replacement)) conflict('Invalid replacement block');
  if (block) return bounded(Buffer.concat([bytes.subarray(0, block.start), replacement || Buffer.alloc(0), bytes.subarray(block.end)]));
  if (replacement === null) return bytes;
  const separator = bytes.length && bytes.at(-1) !== 10 ? Buffer.from('\n') : Buffer.alloc(0);
  return bounded(Buffer.concat([bytes, separator, replacement, Buffer.from('\n')]));
}
export function createNavigationBlock(version) {
  return Buffer.from(navigation.map(line => line.replaceAll('{{framework_version}}', version)).join('\n'));
}
export const createIgnoreBlock = () => Buffer.from('# iterlane:begin\n/.ai-workflow/.local/\n# iterlane:end');
export function validateStateDocumentPaths(paths) {
  if (!Array.isArray(paths) || paths.length > 1000) conflict('Invalid state document paths');
  const seen = new Set();
  for (const path of paths) { assertPortablePath(path); const id=path.normalize('NFC').toLowerCase(); if (!/^docs\/(?:project|iterations|workflow|releases)\/.+\.(?:md|yaml|json)$/u.test(path) || seen.has(id)) conflict('State protection must name unique exact docs files'); seen.add(id); }
  return paths;
}
export function createAttributesBlock(documentPaths=initialBasisPaths) {
  validateStateDocumentPaths(documentPaths);
  const fixed = ['.ai-workflow/**', ...skillNames.map(name => '.agents/skills/' + name + '/**'), 'AGENTS.md', '.gitignore', '.gitattributes', 'docs/workflow/state.yaml'];
  const extra=[...new Set(documentPaths)].filter(path=>!fixed.includes(path));
  const literal=path=>{const value='/'+path.replace(/([*?\[\]])/gu,'\\$1'); return /[\s\\]/u.test(value)?JSON.stringify(value):value;};
  return Buffer.from(['# iterlane:attributes:begin', ...fixed.map(path => '/' + path + ' -text'), ...extra.map(path=>literal(path)+' -text'), '# iterlane:attributes:end'].join('\n'));
}
