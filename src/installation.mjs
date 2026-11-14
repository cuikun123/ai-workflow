import * as fs from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { stringify } from 'yaml';
import metadata from '../package.json' with { type: 'json' };
import layout from '../templates/manifest.json' with { type: 'json' };
import stateSchema from '../schemas/state-v1.schema.json' with { type: 'json' };
import navigation from '../templates/navigation.json' with { type: 'json' };
import { checkPackage, sha256, skillNames } from './package.mjs';
import { isWithin } from './paths.mjs';
import { validateStateYaml } from './state.mjs';
import { projectPath, readProjectFile } from './project-paths.mjs';
import { createNavigationBlock, createIgnoreBlock, createAttributesBlock, initialBasisPaths, parseManagedBlock, replaceManagedBlock } from './managed-blocks.mjs';
import { applyInstallationPlan, assertNoPendingOperation, scanOperations, recoverInstallation, decode, equalBytes } from './install-journal.mjs';
import { WorkflowError } from './errors.mjs';

const manifestPath = '.ai-workflow/manifest.json';
const roots = skillNames.map(name => '.agents/skills/' + name);
const blockBlueprint = () => [
  { path: 'AGENTS.md', kind: 'agents', bytes: createNavigationBlock(metadata.version) },
  { path: '.gitignore', kind: 'ignore', bytes: createIgnoreBlock() },
  { path: '.gitattributes', kind: 'attributes', bytes: createAttributesBlock() },
];
const blockRecords = () => blockBlueprint().map(({ path, kind, bytes }) => ({ path, kind, sha256: sha256(bytes) }));
const fail = (message, code = 'CONFLICT') => { throw new WorkflowError(code, message); };
const exact = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).sort().join(',') === [...keys].sort().join(',');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const managed = path => (path.startsWith('.ai-workflow/') && !path.startsWith('.ai-workflow/.local/') && path !== manifestPath) || roots.some(root => path.startsWith(root + '/'));
function canonicalRoot(root) {
  if (typeof root !== 'string' || !root) fail('An explicit existing project directory is required');
  projectPath(root, 'AGENTS.md'); return fs.realpathSync.native(root);
}
const installedLauncher = Buffer.from('#!/usr/bin/env node\nimport {fileURLToPath} from "node:url";\ntry { const {runCli}=await import("../runtime/cli.mjs"); process.exitCode=await runCli(process.argv.slice(2),{projectRoot:fileURLToPath(new URL("../../",import.meta.url))}); } catch { process.stdout.write(JSON.stringify({ok:false,error:{code:"PACKAGE_INVALID",message:"Installed runtime could not start",details:[]}})+"\\n"); process.exitCode=4; }\n');

function blueprint(packageRoot) {
  checkPackage(packageRoot);
  const bytes = fs.readFileSync(join(packageRoot, 'resource-manifest.json')), source = JSON.parse(bytes);
  const files = source.files.map(entry => ({
    path: entry.path.startsWith('resources/skills/') ? '.agents/' + entry.path.slice('resources/'.length) : '.ai-workflow/' + entry.path,
    after: entry.path === 'bin/iterlane.mjs' ? installedLauncher : fs.readFileSync(join(packageRoot, entry.path)), kind: 'file',
  }));
  const pkg = { name: metadata.name, version: metadata.version, source_manifest_sha256: sha256(bytes), state_schemas: [1] };
  return { files, package: pkg };
}
function validateManifest(root, manifest) {
  if (!exact(manifest, ['manifest_version', 'kind', 'installation_id', 'package', 'skill_roots', 'files', 'blocks']) || manifest.manifest_version !== 1 || manifest.kind !== 'iterlane-project-installation' || !uuid(manifest.installation_id)) fail('Invalid installation manifest');
  const pkg = manifest.package;
  if (!exact(pkg, ['name', 'version', 'source_manifest_sha256', 'state_schemas']) || pkg.name !== metadata.name || pkg.version !== metadata.version || !digest(pkg.source_manifest_sha256) || JSON.stringify(pkg.state_schemas) !== '[1]' || JSON.stringify(manifest.skill_roots) !== JSON.stringify(roots)) fail('Unknown or mixed installed framework version');
  if (!Array.isArray(manifest.files) || manifest.files.length > 10000 || !manifest.files.length) fail('Invalid installed resource list');
  const ids = new Set();
  for (const entry of manifest.files) {
    if (!exact(entry, ['path', 'bytes', 'sha256']) || typeof entry.path !== 'string' || !managed(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > 8 * 1024 * 1024 || !digest(entry.sha256)) fail('Invalid installed resource record');
    projectPath(root, entry.path); const id = entry.path.normalize('NFC').toLowerCase();
    if (ids.has(id)) fail('Duplicate installed resource'); ids.add(id);
  }
  const required = ['package.json', 'bin/iterlane.mjs', 'runtime/cli.mjs', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'dependency-manifest.json', 'resources/schemas/state-v1.schema.json', 'resources/sources/catalog.yaml', 'resources/sources/README.md', 'resources/templates/manifest.json', 'resources/templates/navigation.json'].map(path => '.ai-workflow/' + path);
  for (const path of [...layout.empty_files, ...layout.seed_files, ...layout.directory_placeholders]) required.push('.ai-workflow/resources/templates/project/' + path);
  for (const root of roots) required.push(root + '/SKILL.md', root + '/NOTICE.md');
  if (required.some(path => !ids.has(path.toLowerCase()))) fail('Required installed resource is unlisted');
  if (!Array.isArray(manifest.blocks) || manifest.blocks.length !== blockBlueprint().length) fail('Invalid managed block records');
  for (const [index, { kind, path, bytes }] of blockBlueprint().entries()) {
    const entry = manifest.blocks[index];
    if (!exact(entry, ['path', 'kind', 'sha256']) || entry.path !== path || entry.kind !== kind || entry.sha256 !== sha256(bytes)) fail('Managed block identity differs from this runtime');
  }
  return manifest;
}
function readManifest(root) {
  const bytes = readProjectFile(root, manifestPath); if (!bytes) return null;
  let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { fail('Installation manifest is damaged'); }
  return validateManifest(root, data);
}
function inventory(root) {
  const files = [];
  function scan(path) {
    const absolute = projectPath(root, path), stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) return;
    if (!stat.isDirectory()) fail('Expected an installed resource directory: ' + path);
    for (const name of fs.readdirSync(absolute)) {
      const child = path + '/' + name;
      if (child === '.ai-workflow/.local') { projectPath(root, child); continue; }
      const file = projectPath(root, child), entry = fs.lstatSync(file);
      if (entry.isDirectory()) scan(child); else if (entry.isFile()) { if (child !== manifestPath) files.push(child); } else fail('Non-regular installed resource');
    }
  }
  scan('.ai-workflow'); for (const path of roots) scan(path); return files;
}
function inspect(root, manifest) {
  const missing = [], changed = [];
  for (const entry of manifest.files) {
    const bytes = readProjectFile(root, entry.path);
    if (!bytes) missing.push(entry.path); else if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) changed.push(entry.path);
  }
  const expected = new Set(manifest.files.map(entry => entry.path)), extra = inventory(root).filter(path => !expected.has(path));
  const missingBlocks = [];
  for (const entry of manifest.blocks) {
    const bytes = readProjectFile(root, entry.path, 1024 * 1024), block = bytes && parseManagedBlock(bytes, entry.kind);
    if (!block) missingBlocks.push(entry); else if (sha256(block.bytes) !== entry.sha256) changed.push(entry.path);
  }
  const stateBytes = readProjectFile(root, 'docs/workflow/state.yaml');
  if (!stateBytes) fail('Existing project state is missing; init cannot reset progress', 'INCOMPLETE');
  let state; try { state = validateStateYaml(stateBytes.toString('utf8')); } catch { fail('Existing project state is invalid; state recovery is a separate task', 'INCOMPLETE'); }
  for (const entry of state.basis) if (readProjectFile(root, entry.path) === null) fail('Progress input is missing: ' + entry.path, 'INCOMPLETE');
  for (const entry of [...state.confirmation_refs, ...state.blocker_refs, ...(state.checkpoint_ref ? [state.checkpoint_ref] : [])]) if (readProjectFile(root, entry.path) === null) fail('Progress reference file is missing: ' + entry.path, 'INCOMPLETE');
  if (state.current_iteration !== null) {
    const path = projectPath(root, state.current_iteration), stat = fs.lstatSync(path, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) fail('Current iteration is missing', 'INCOMPLETE');
  }
  if (!missing.length && !changed.length) {
    let schema, pkg, nav, templateLayout;
    try { schema = JSON.parse(readProjectFile(root, '.ai-workflow/resources/schemas/state-v1.schema.json')); pkg = JSON.parse(readProjectFile(root, '.ai-workflow/package.json')); nav = JSON.parse(readProjectFile(root, '.ai-workflow/resources/templates/navigation.json')); templateLayout = JSON.parse(readProjectFile(root, '.ai-workflow/resources/templates/manifest.json')); } catch { fail('Installed schema or package metadata is invalid'); }
    if (!isDeepStrictEqual(schema, stateSchema) || !isDeepStrictEqual(nav, navigation) || !isDeepStrictEqual(templateLayout, layout) || pkg.name !== metadata.name || pkg.version !== metadata.version || pkg.license !== metadata.license || !exact(pkg.bin, [metadata.name]) || pkg.bin[metadata.name] !== 'bin/iterlane.mjs') fail('Installed metadata differs from this runtime');
  }
  return { missing, changed, extra, missingBlocks, state };
}
export function checkInstallation(projectRoot) {
  const root = canonicalRoot(projectRoot); assertNoPendingOperation(root);
  const manifest = readManifest(root); if (!manifest) fail('No installation manifest', 'INCOMPLETE');
  const result = inspect(root, manifest);
  if (result.changed.length || result.extra.length) fail('Installed resources changed or contain unlisted files');
  if (result.missing.length || result.missingBlocks.length) fail('Installed resources or navigation are missing', 'INCOMPLETE');
  return { name: metadata.name, version: metadata.version, resources: 'valid', managed_files: manifest.files.length, state: 'structure_valid', state_revision: result.state.revision, references_verified: false, acceptance_verified: false, client_validation: 'not_run' };
}

function stateBytes(createdAt, business) {
  const paths = initialBasisPaths;
  const state = { schema_version: 1, revision: 0, current_iteration: 'docs/iterations/000-foundation', current_task: null, phase: 'clarify', status: 'not_started', waiting_for: null, checkpoint_ref: null, confirmation_refs: [], blocker_refs: [], basis: paths.map(path => ({ path, sha256: sha256(business.find(file => file.path === path).after) })), updated_at: createdAt };
  const bytes = Buffer.from(stringify(state)); validateStateYaml(bytes.toString('utf8')); return bytes;
}
export function planInstallation({ packageRoot, projectRoot, mode = 'init' }) {
  if (!['init', 'repair'].includes(mode)) fail('This mode requires an incomplete operation', 'INCOMPLETE');
  const root = canonicalRoot(projectRoot), source = blueprint(packageRoot);
  if (isWithin(root, fs.realpathSync.native(packageRoot)) || isWithin(fs.realpathSync.native(packageRoot), root)) fail('Package and project directories must not overlap');
  assertNoPendingOperation(root); const existing = readManifest(root), createdAt = new Date().toISOString();
  let files, installationId = existing?.installation_id || randomUUID(), manifest;
  if (existing) {
    if (existing.package.source_manifest_sha256 !== source.package.source_manifest_sha256) fail('Same version has a different source package; automatic replacement is refused');
    const inspection = inspect(root, existing);
    if (inspection.changed.length || inspection.extra.length) fail('Changed or unlisted resources cannot be overwritten');
    if (!inspection.missing.length && !inspection.missingBlocks.length) return { action: 'unchanged', root, files: [], package: source.package };
    if (mode !== 'repair') fail('Missing resources require explicit repair', 'INCOMPLETE');
    files = inspection.missing.map(path => {
      const file = source.files.find(file => file.path === path), entry = existing.files.find(entry => entry.path === path);
      if (!file || sha256(file.after) !== entry.sha256 || file.after.length !== entry.bytes) fail('Missing resource has no matching source');
      return { ...file, before: null };
    });
    for (const entry of inspection.missingBlocks) {
      const before = readProjectFile(root, entry.path, 1024 * 1024), block = blockBlueprint().find(block => block.kind === entry.kind).bytes;
      files.push({ path: entry.path, kind: entry.kind, before, after: replaceManagedBlock(before, entry.kind, null, block) });
    }
    manifest = existing;
  } else {
    if (mode === 'repair') fail('Repair cannot adopt an unknown installation');
    const previous = scanOperations(root), framework = fs.lstatSync(projectPath(root, '.ai-workflow'), { throwIfNoEntry: false });
    if (framework && (!previous.length || previous.some(op => op.data.phase !== 'rolled_back' || op.data.package?.source_manifest_sha256 !== source.package.source_manifest_sha256) || inventory(root).length)) fail('Unknown framework metadata was preserved', 'INCOMPLETE');
    for (const path of roots) if (fs.existsSync(projectPath(root, path)) && !previous.length) fail('An existing skill directory is not owned by this installation');
    files = source.files.map(file => ({ ...file, before: null }));
    for (const file of files) if (readProjectFile(root, file.path) !== null) fail('Resource target already exists: ' + file.path);
    for (const { path, kind, bytes: block } of blockBlueprint()) {
      const before = readProjectFile(root, path, 1024 * 1024);
      if (before && parseManagedBlock(before, kind)) fail('Unowned managed block already exists');
      files.push({ path, kind, before, after: replaceManagedBlock(before, kind, null, block) });
    }
    const business = [...layout.empty_files, ...layout.directory_placeholders].map(path => ({ path, kind: 'file', before: null, after: fs.readFileSync(join(packageRoot, 'resources/templates/project', path)) }));
    business.push({ path: 'docs/workflow/state.yaml', kind: 'file', before: null, after: stateBytes(createdAt, business) });
    for (const file of business) if (readProjectFile(root, file.path) !== null) fail('Business target already exists: ' + file.path);
    files.push(...business);
    manifest = { manifest_version: 1, kind: 'iterlane-project-installation', installation_id: installationId, package: source.package, skill_roots: roots, files: source.files.map(file => ({ path: file.path, bytes: file.after.length, sha256: sha256(file.after) })), blocks: blockRecords() };
  }
  validateManifest(root, manifest);
  files.push({ path: manifestPath, kind: 'file', before: readProjectFile(root, manifestPath), after: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  const verify = () => {
    const result = inspect(root, manifest);
    if (result.missing.length || result.changed.length || result.extra.length || result.missingBlocks.length) fail('Installation readback did not match the prepared resources', 'INCOMPLETE');
  };
  return { action: existing ? 'repaired' : 'initialized', root, package: source.package, installationId, createdAt, files, manifest, verify };
}
export function initializeProject(options) {
  if (['resume', 'undo'].includes(options.mode)) {
    const root = canonicalRoot(options.projectRoot), source = blueprint(options.packageRoot);
    if (isWithin(root, fs.realpathSync.native(options.packageRoot)) || isWithin(fs.realpathSync.native(options.packageRoot), root)) fail('Package and project directories must not overlap');
    const prepare = journal => {
      if (!isDeepStrictEqual(journal.package, source.package)) fail('Recovery requires the identical source package');
      const manifest = { manifest_version: 1, kind: 'iterlane-project-installation', installation_id: journal.installation_id, package: source.package, skill_roots: roots, files: source.files.map(file => ({ path: file.path, bytes: file.after.length, sha256: sha256(file.after) })), blocks: blockRecords() };
      const expected = new Map(source.files.map(file => [file.path, file.after]));
      if (journal.action === 'initialized') {
        const business = [...layout.empty_files, ...layout.directory_placeholders].map(path => ({ path, after: fs.readFileSync(join(options.packageRoot, 'resources/templates/project', path)) }));
        business.push({ path: 'docs/workflow/state.yaml', after: stateBytes(journal.created_at, business) });
        for (const file of business) expected.set(file.path, file.after);
      }
      const paths = new Set(journal.files.map(file => file.path));
      if (journal.files.at(-1).path !== manifestPath || journal.action === 'initialized' && (paths.size !== expected.size + blockBlueprint().length + 1 || [...expected.keys()].some(path => !paths.has(path)) || blockBlueprint().some(block => !paths.has(block.path)))) fail('Recovery inventory differs from the original installation plan');
      for (const entry of journal.files) {
        const before = decode(entry.before), after = decode(entry.after);
        if (entry.path === manifestPath) {
          let data; try { data = JSON.parse(after); } catch { fail('Invalid manifest image'); }
          if (entry.kind !== 'file' || !isDeepStrictEqual(validateManifest(root, data), manifest)) fail('Recovery manifest differs from its source');
          if (journal.action === 'initialized' && before !== null) fail('Initialization cannot replace a prior manifest');
          if (journal.action === 'repaired') {
            let original; try { original = JSON.parse(before); } catch { fail('Repair has no valid original manifest'); }
            if (!isDeepStrictEqual(validateManifest(root, original), manifest)) fail('Repair cannot change installation identity');
          }
        } else if (blockBlueprint().some(block => block.path === entry.path)) {
          const { kind, bytes: block } = blockBlueprint().find(block => block.path === entry.path);
          if (entry.kind !== kind || parseManagedBlock(before || Buffer.alloc(0), kind) !== null || !equalBytes(parseManagedBlock(after, kind)?.bytes || null, block) || !equalBytes(replaceManagedBlock(before, kind, null, block), after)) fail('Recovery block is outside its authorized change');
        } else if (entry.kind !== 'file' || before !== null || !expected.has(entry.path) || !equalBytes(after, expected.get(entry.path))) fail('Recovery payload differs from its original source');
      }
      if (journal.temporary) {
        const entry = journal.files.find(file => file.path === journal.temporary.target), image = decode(journal.temporary.data);
        if (journal.intent === 'apply' && !equalBytes(image, decode(entry.after)) || journal.intent === 'undo' && entry.kind === 'file' && !equalBytes(image, decode(entry.before)) || journal.intent === 'undo' && entry.kind !== 'file' && parseManagedBlock(image, entry.kind) !== null) fail('Temporary payload is outside its operation intent');
      }
      return { verify: () => { const result = inspect(root, manifest); if (result.missing.length || result.changed.length || result.extra.length || result.missingBlocks.length) fail('Recovery resource readback failed', 'INCOMPLETE'); } };
    };
    const result = recoverInstallation(root, options.mode, prepare, options);
    if (options.mode === 'resume') checkInstallation(root);
    return result;
  }
  const plan = planInstallation(options);
  if (plan.action === 'unchanged') return { action: 'unchanged', project: plan.root, version: metadata.version, client_validation: 'not_run' };
  const result = applyInstallationPlan(plan, options); checkInstallation(plan.root); return result;
}
