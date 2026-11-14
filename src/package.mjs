import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertPortablePath, listRegularFiles, resolveRegularFile } from './paths.mjs';
import { WorkflowError } from './errors.mjs';
import templateLayout from '../templates/manifest.json' with { type: 'json' };
import metadata from '../package.json' with { type: 'json' };
import stateSchema from '../schemas/state-v1.schema.json' with { type: 'json' };
import navigation from '../templates/navigation.json' with { type: 'json' };
export const skillNames = Object.freeze(['build-foundation', 'clarify-design', 'debug-issue', 'discuss-design', 'execute-task', 'handle-incident', 'plan-tasks', 'release-work', 'review-work', 'test-work', 'workflow-guide']);
const fail = message => { throw new WorkflowError('PACKAGE_INVALID', message); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function checkPackage(root) {
  const manifestFile = resolveRegularFile(root, 'resource-manifest.json');
  let manifest; try {
    const bytes = readFileSync(manifestFile); if (bytes.length > 4 * 1024 * 1024) fail('Resource manifest is too large');
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch { fail('Resource manifest is missing or invalid'); }
  if (!exactKeys(manifest, ['manifest_version', 'kind', 'package', 'files']) || manifest.manifest_version !== 1 || manifest.kind !== 'ai-workflow-resource-package') fail('Unsupported resource manifest');
  const meta = manifest.package;
  if (!exactKeys(meta, ['name', 'version', 'state_schemas']) || typeof meta.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(meta.name) || typeof meta.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(meta.version) || JSON.stringify(meta.state_schemas) !== '[1]') fail('Invalid package metadata');
  if (meta.name !== metadata.name || meta.version !== metadata.version) fail('Resource package does not match this runtime identity');
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 10000) fail('Invalid resource inventory');
  const identities = new Set();
  for (const entry of manifest.files) {
    if (!exactKeys(entry, ['path', 'bytes', 'sha256']) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail('Invalid resource inventory entry');
    assertPortablePath(entry.path); const identity = entry.path.normalize('NFC').toLowerCase();
    if (identity === 'resource-manifest.json' || identities.has(identity)) fail('Duplicate or self-referencing inventory'); identities.add(identity);
    const file = resolveRegularFile(root, entry.path), bytes = readFileSync(file);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) fail('Resource content changed: ' + entry.path);
  }
  const actual = listRegularFiles(root).filter(path => path !== 'resource-manifest.json');
  const expected = manifest.files.map(entry => entry.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('Resource inventory contains missing or unlisted files');
  const mandatory = ['package.json', 'bin/iterlane.mjs', 'runtime/cli.mjs', 'resources/schemas/state-v1.schema.json', 'resources/sources/catalog.yaml', 'resources/sources/README.md', 'resources/templates/manifest.json', 'resources/templates/navigation.json', 'dependency-manifest.json', 'THIRD_PARTY_NOTICES.md', 'README.md'];
  for (const path of [...templateLayout.empty_files, ...templateLayout.seed_files, ...templateLayout.directory_placeholders]) mandatory.push('resources/templates/project/' + path);
  for (const name of skillNames) mandatory.push(`resources/skills/${name}/SKILL.md`, `resources/skills/${name}/NOTICE.md`);
  for (const name of mandatory) if (!expected.includes(name)) fail('Missing required package resource: ' + name);
  let distributedSchema; try { distributedSchema = JSON.parse(readFileSync(join(root, 'resources/schemas/state-v1.schema.json'), 'utf8')); } catch { fail('Invalid packaged state schema'); }
  if (!isDeepStrictEqual(distributedSchema, stateSchema)) fail('Packaged state schema differs from runtime schema');
  let distributedNavigation; try { distributedNavigation = JSON.parse(readFileSync(join(root, 'resources/templates/navigation.json'), 'utf8')); } catch { fail('Invalid packaged navigation template'); }
  if (!isDeepStrictEqual(distributedNavigation, navigation)) fail('Packaged navigation differs from runtime template');
  let distributedLayout; try { distributedLayout = JSON.parse(readFileSync(join(root, 'resources/templates/manifest.json'), 'utf8')); } catch { fail('Invalid packaged template layout'); }
  if (!isDeepStrictEqual(distributedLayout, templateLayout)) fail('Packaged template layout differs from runtime layout');
  if (!expected.some(name => name.startsWith('resources/templates/project/'))) fail('Project templates are missing');
  let pkg; try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); } catch { fail('Invalid package.json'); }
  if (pkg.name !== meta.name || pkg.version !== meta.version || pkg.license !== metadata.license || pkg.type !== 'module' || !exactKeys(pkg.bin, [meta.name]) || pkg.bin[meta.name] !== 'bin/iterlane.mjs') fail('Package identity does not match inventory');
  if (pkg.license !== 'UNLICENSED' && !expected.includes('LICENSE')) fail('Root license is missing');
  return { name: meta.name, version: meta.version, files: expected.length, state_schemas: meta.state_schemas };
}
