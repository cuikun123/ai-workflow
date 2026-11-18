import * as fs from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { stringify } from 'yaml';
import metadata from '../package.json' with { type: 'json' };
import layout from '../templates/manifest.json' with { type: 'json' };
import stateSchema from '../schemas/state-v1.schema.json' with { type: 'json' };
import recordSchema from '../schemas/workflow-record-v1.schema.json' with {type:'json'};
import recordSchema2 from '../schemas/workflow-record-v2.schema.json' with {type:'json'};
import navigation from '../templates/navigation.json' with { type: 'json' };
import { checkPackage, sha256, skillNames } from './package.mjs';
import { isWithin,assertPortablePath } from './paths.mjs';
import { validateStateYaml } from './state.mjs';
import { projectPath, readProjectFile } from './project-paths.mjs';
import { createNavigationBlock, createIgnoreBlock, createAttributesBlock, initialBasisPaths, initialFoundationPaths, validateStateDocumentPaths, parseManagedBlock, replaceManagedBlock } from './managed-blocks.mjs';
import { applyInstallationPlan, assertNoPendingOperation, scanOperations, recoverInstallation, decode, equalBytes } from './install-journal.mjs';
import { WorkflowError } from './errors.mjs';
import {inspectSkillResources,skillPolicy,providerResources} from './skill-resources.mjs';
import {exampleResources} from './example-resources.mjs';
import {relocateLinks, installedResourcePath, isHumanGuide} from './document-links.mjs';

const manifestPath = '.ai-workflow/manifest.json';
const roots = skillNames.map(name => '.agents/skills/' + name);
const blockBlueprint = (paths=initialBasisPaths,version=metadata.version) => [
  { path: 'AGENTS.md', kind: 'agents', bytes: createNavigationBlock(version) },
  { path: '.gitignore', kind: 'ignore', bytes: createIgnoreBlock() },
  { path: '.gitattributes', kind: 'attributes', bytes: createAttributesBlock(paths) },
];
const blockRecords = (paths=initialBasisPaths) => blockBlueprint(paths).map(({ path, kind, bytes }) => ({ path, kind, sha256: sha256(bytes) }));
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

export {installedLauncher};
export const compatibleBlocks=(version,paths)=>blockBlueprint(paths,version);
export function validateCompatibleManifest(root,manifest,identity){if(!['0.3.0-dev.5','0.3.0-dev.6'].includes(identity.version)||!isDeepStrictEqual(manifest.package,identity))fail('Unsupported version/source identity');return validateManifest(root,manifest,false,identity.version);}
function blueprint(packageRoot) {
  checkPackage(packageRoot);
  const bytes = fs.readFileSync(join(packageRoot, 'resource-manifest.json')), source = JSON.parse(bytes);
  const files = source.files.map(entry => ({
    path: installedResourcePath(entry.path),
    after: entry.path === 'bin/iterlane.mjs' ? installedLauncher
      : isHumanGuide(entry.path) ? Buffer.from(relocateLinks(fs.readFileSync(join(packageRoot, entry.path), 'utf8'), entry.path, installedResourcePath(entry.path), installedResourcePath))
      : fs.readFileSync(join(packageRoot, entry.path)), kind: 'file',
  }));
  const pkg = { name: metadata.name, version: metadata.version, source_manifest_sha256: sha256(bytes), state_schemas: [1] };
  return { files, package: pkg };
}
function validateManifest(root, manifest,diagnostic=false,expectedVersion=metadata.version) {
  if (!exact(manifest, ['manifest_version', 'kind', 'installation_id', 'package', 'skill_roots', 'files', 'blocks','state_document_paths']) || manifest.manifest_version !== 2 || manifest.kind !== 'iterlane-project-installation' || !uuid(manifest.installation_id)) fail('Invalid installation manifest');
  validateStateDocumentPaths(manifest.state_document_paths);
  const pkg = manifest.package;
  if (!exact(pkg, ['name', 'version', 'source_manifest_sha256', 'state_schemas']) || pkg.name !== metadata.name || pkg.version !== expectedVersion || !digest(pkg.source_manifest_sha256) || JSON.stringify(pkg.state_schemas) !== '[1]' || JSON.stringify(manifest.skill_roots) !== JSON.stringify(roots)) fail('Unknown or mixed installed framework version');
  if (!Array.isArray(manifest.files) || manifest.files.length > 10000 || !manifest.files.length) fail('Invalid installed resource list');
  const ids = new Set();
  for (const entry of manifest.files) {
    if (!exact(entry, ['path', 'bytes', 'sha256']) || typeof entry.path !== 'string' || !managed(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > 8 * 1024 * 1024 || !digest(entry.sha256)) fail('Invalid installed resource record');
    if(diagnostic)assertPortablePath(entry.path);else projectPath(root, entry.path); const id = entry.path.normalize('NFC').toLowerCase();
    if (ids.has(id)) fail('Duplicate installed resource'); ids.add(id);
  }
  const required = ['package.json', 'bin/iterlane.mjs', 'runtime/cli.mjs', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'dependency-manifest.json', 'resources/schemas/state-v1.schema.json', 'resources/sources/catalog.yaml', 'resources/sources/README.md', 'resources/templates/manifest.json', 'resources/templates/navigation.json'].map(path => '.ai-workflow/' + path);
  required.push('.ai-workflow/resources/schemas/workflow-record-v1.schema.json');
  if(!['0.3.0-dev.5','0.3.0-dev.6'].includes(expectedVersion))required.push('.ai-workflow/resources/schemas/workflow-record-v2.schema.json');
  if(expectedVersion===metadata.version){required.push('.ai-workflow/resources/skills/_shared/manifest.json','.ai-workflow/resources/skills/_shared/resource-index.json');for(const name of skillNames)for(const path of providerResources(skillPolicy,name))required.push('.agents/skills/'+name+'/'+path);}
  else{required.push('.agents/skills/workflow-guide/references/state-runtime.md');if(expectedVersion!=='0.3.0-dev.5')required.push('.agents/skills/workflow-guide/references/version-runtime.md');}
  for (const path of [...layout.empty_files, ...layout.seed_files, ...layout.directory_placeholders]) required.push('.ai-workflow/resources/templates/project/' + path);
  for (const root of roots) required.push(root + '/SKILL.md', root + '/NOTICE.md');
  if (required.some(path => !ids.has(path.toLowerCase()))) fail('Required installed resource is unlisted');
  if (!Array.isArray(manifest.blocks) || manifest.blocks.length !== blockBlueprint().length) fail('Invalid managed block records');
  for (const [index, { kind, path, bytes }] of blockBlueprint(manifest.state_document_paths,expectedVersion).entries()) {
    const entry = manifest.blocks[index];
    if (!exact(entry, ['path', 'kind', 'sha256']) || entry.path !== path || entry.kind !== kind || entry.sha256 !== sha256(bytes)) fail('Managed block identity differs from this runtime');
  }
  return manifest;
}
function readManifest(root,diagnostic=false,read=path=>readProjectFile(root,path)) {
  const bytes = read(manifestPath); if (!bytes) return null;
  let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { fail('Installation manifest is damaged'); }
  return validateManifest(root, data,diagnostic);
}
export const readInstallationManifest=(projectRoot,{read}={})=>readManifest(canonicalRoot(projectRoot),false,read);
export const readDiagnosticInstallationManifest=projectRoot=>readManifest(canonicalRoot(projectRoot),true);
export function prepareWorkflowProtection(projectRoot,paths,{read=path=>readProjectFile(projectRoot,path)}={}) {
  const root=canonicalRoot(projectRoot);let manifest;try{manifest=JSON.parse(read(manifestPath));}catch{fail('Workflow state needs a known installation');}validateManifest(root,manifest);
  const nextPaths=[...new Set([...manifest.state_document_paths,...validateStateDocumentPaths(paths)])].sort();
  const next={...manifest,state_document_paths:nextPaths,blocks:blockRecords(nextPaths)};
  validateManifest(root,next);
  const before=read('.gitattributes'),old=createAttributesBlock(manifest.state_document_paths),block=createAttributesBlock(nextPaths);
  const files=[];
  if(!old.equals(block))files.push({path:'.gitattributes',kind:'attributes',before,after:replaceManagedBlock(before,'attributes',old,block)});
  const image=Buffer.from(JSON.stringify(next,null,2)+'\n'),previous=read(manifestPath);
  if(!previous.equals(image))files.push({path:manifestPath,kind:'file',before:previous,after:image});
  return {files,manifest:next};
}
function inventory(root,issues=null) {
  const files = [];
  const attempt=(path,fn)=>{try{return fn();}catch(error){if(!issues)throw error;issues.push({path,error});return null;}};
  function scan(path) {return attempt(path,()=>{
    const absolute = projectPath(root, path), stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) return;
    if (!stat.isDirectory()) fail('Expected an installed resource directory: ' + path);
    for (const name of fs.readdirSync(absolute)) {
      const child = path + '/' + name;attempt(child,()=>{
      if (child === '.ai-workflow/.local') { projectPath(root, child); return; }
      const file = projectPath(root, child), entry = fs.lstatSync(file);
      if (entry.isDirectory()) scan(child); else if (entry.isFile()) { if (child !== manifestPath) files.push(child); } else fail('Non-regular installed resource');});
    }
  });}
  scan('.ai-workflow'); for (const path of roots) scan(path); return files;
}
export function inspectInstallationResources(root, manifest,{read=path=>readProjectFile(root,path)}={}) {
  const missing = [], changed = [],issues=[];
  for (const entry of manifest.files) {
    try{const bytes = read(entry.path);
    if (!bytes) missing.push(entry.path); else if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) changed.push(entry.path);}catch(error){issues.push({path:entry.path,error});}
  }
  const expected = new Set(manifest.files.map(entry => entry.path)), extra = inventory(root,issues).filter(path => !expected.has(path));
  const missingBlocks = [];
  for (const entry of manifest.blocks) {
    try{const bytes = read(entry.path), block = bytes && parseManagedBlock(bytes, entry.kind);
    if (!block) missingBlocks.push(entry); else if (sha256(block.bytes) !== entry.sha256) changed.push(entry.path);}catch(error){issues.push({path:entry.path,error});}
  }
  return {missing,changed,extra,missingBlocks,issues};
}
function inspect(root, manifest,{allowFoundationMembershipChanges=false}={}) {
  const {missing,changed,extra,missingBlocks,issues}=inspectInstallationResources(root,manifest);if(issues.length)throw issues[0].error;
  const stateBytes = readProjectFile(root, 'docs/workflow/state.yaml');
  if (!stateBytes) fail('Existing project state is missing; init cannot reset progress', 'INCOMPLETE');
  let state; try { state = validateStateYaml(stateBytes.toString('utf8')); } catch { fail('Existing project state is invalid; state recovery is a separate task', 'INCOMPLETE'); }
  for (const entry of state.basis) if (readProjectFile(root, entry.path) === null && !(allowFoundationMembershipChanges&&entry.path.startsWith('docs/project/foundation/')&&!initialFoundationPaths.includes(entry.path))) fail('Progress input is missing: ' + entry.path, 'INCOMPLETE');
  for (const entry of [...state.confirmation_refs, ...state.blocker_refs, ...(state.checkpoint_ref ? [state.checkpoint_ref] : [])]) if (readProjectFile(root, entry.path) === null) fail('Progress reference file is missing: ' + entry.path, 'INCOMPLETE');
  if (state.current_iteration !== null) {
    const path = projectPath(root, state.current_iteration), stat = fs.lstatSync(path, { throwIfNoEntry: false });
    if (!stat?.isDirectory()) fail('Current iteration is missing', 'INCOMPLETE');
  }
  if (!missing.length && !changed.length) {
    let schema, pkg, nav, templateLayout,records;
    try { schema = JSON.parse(readProjectFile(root, '.ai-workflow/resources/schemas/state-v1.schema.json')); pkg = JSON.parse(readProjectFile(root, '.ai-workflow/package.json')); nav = JSON.parse(readProjectFile(root, '.ai-workflow/resources/templates/navigation.json')); templateLayout = JSON.parse(readProjectFile(root, '.ai-workflow/resources/templates/manifest.json')); } catch { fail('Installed schema or package metadata is invalid'); }
    if (!isDeepStrictEqual(schema, stateSchema) || !isDeepStrictEqual(nav, navigation) || !isDeepStrictEqual(templateLayout, layout) || pkg.name !== metadata.name || pkg.version !== metadata.version || pkg.license !== metadata.license || !exact(pkg.bin, [metadata.name]) || pkg.bin[metadata.name] !== 'bin/iterlane.mjs') fail('Installed metadata differs from this runtime');
    try{records=JSON.parse(readProjectFile(root,'.ai-workflow/resources/schemas/workflow-record-v1.schema.json'));}catch{fail('Installed record schema is invalid');}if(!isDeepStrictEqual(records,recordSchema))fail('Installed record schema differs from this runtime');
    let records2;try{records2=JSON.parse(readProjectFile(root,'.ai-workflow/resources/schemas/workflow-record-v2.schema.json'));}catch{fail('Installed v2 record schema is invalid');}if(!isDeepStrictEqual(records2,recordSchema2))fail('Installed v2 record schema differs from this runtime');
  }
  return { missing, changed, extra, missingBlocks, state };
}
export function checkInstallation(projectRoot,{allowPendingWorkflow=false,allowFoundationMembershipChanges=false}={}) {
  const root = canonicalRoot(projectRoot); if(!allowPendingWorkflow)assertNoPendingOperation(root);
  const manifest = readManifest(root); if (!manifest) fail('No installation manifest', 'INCOMPLETE');
  const result = inspect(root, manifest,{allowFoundationMembershipChanges});
  if (result.changed.length || result.extra.length) fail('Installed resources changed or contain unlisted files');
  if (result.missing.length || result.missingBlocks.length) fail('Installed resources or navigation are missing', 'INCOMPLETE');
  const skills=inspectSkillResources(root,{installed:true});if(!skills.valid)throw new WorkflowError('PACKAGE_INVALID','Installed skill dependencies or common references are inconsistent',skills.issues);
  return { name: metadata.name, version: metadata.version, resources: 'valid', managed_files: manifest.files.length, state: 'structure_valid', state_revision: result.state.revision, references_verified: false, acceptance_verified: false, client_validation: 'not_run',skills };
}

function stateBytes(createdAt, business) {
  const paths = initialBasisPaths;
  const state = { schema_version: 1, revision: 0, current_iteration: 'docs/iterations/000-foundation', current_task: null, phase: 'clarify', status: 'not_started', waiting_for: null, checkpoint_ref: null, confirmation_refs: [], blocker_refs: [], basis: paths.map(path => ({ path, sha256: sha256(business.find(file => file.path === path).after) })), updated_at: createdAt };
  const bytes = Buffer.from(stringify(state)); validateStateYaml(bytes.toString('utf8')); return bytes;
}
export function planInstallation({ packageRoot, projectRoot, mode = 'init',example }) {
  if (!['init', 'repair'].includes(mode)) fail('This mode requires an incomplete operation', 'INCOMPLETE');
  const root = canonicalRoot(projectRoot), source = blueprint(packageRoot);
  if (isWithin(root, fs.realpathSync.native(packageRoot)) || isWithin(fs.realpathSync.native(packageRoot), root)) fail('Package and project directories must not overlap');
  assertNoPendingOperation(root); const existing = readManifest(root), createdAt = new Date().toISOString();
  let sample=[];
  if(example){if(mode!=='init'||existing||fs.readdirSync(root).some(p=>p!=='.git'))fail('Example initialization needs a new empty project');sample=exampleResources(packageRoot,example);}
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
      const before = readProjectFile(root, entry.path, 1024 * 1024), block = blockBlueprint(existing.state_document_paths).find(block => block.kind === entry.kind).bytes;
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
    files.push(...business,...sample);
    manifest = { manifest_version: 2, kind: 'iterlane-project-installation', installation_id: installationId, package: source.package, skill_roots: roots, files: source.files.map(file => ({ path: file.path, bytes: file.after.length, sha256: sha256(file.after) })), blocks: blockRecords(),state_document_paths:initialBasisPaths };
  }
  validateManifest(root, manifest);
  files.push({ path: manifestPath, kind: 'file', before: readProjectFile(root, manifestPath), after: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  const verify = () => {
    const result = inspect(root, manifest);
    if (result.missing.length || result.changed.length || result.extra.length || result.missingBlocks.length) fail('Installation readback did not match the prepared resources', 'INCOMPLETE');
    for(const file of sample)if(!equalBytes(readProjectFile(root,file.path),file.after))fail('Example file changed during initialization','CONFLICT');
  };
  return { action: existing ? 'repaired' : 'initialized', root, package: source.package, installationId, createdAt, files, manifest, verify,...(example?{example}:{}) };
}
export function initializeProject(options) {
  if (['resume', 'undo'].includes(options.mode)) {
    const root = canonicalRoot(options.projectRoot), source = blueprint(options.packageRoot);
    if (isWithin(root, fs.realpathSync.native(options.packageRoot)) || isWithin(fs.realpathSync.native(options.packageRoot), root)) fail('Package and project directories must not overlap');
    const prepare = journal => {
      if (!isDeepStrictEqual(journal.package, source.package)) fail('Recovery requires the identical source package');
      let protectionPaths=initialBasisPaths;
      if(journal.action==='repaired'){let original;try{original=JSON.parse(decode(journal.files.at(-1).before));}catch{fail('Repair original manifest is invalid');}validateManifest(root,original);protectionPaths=original.state_document_paths;}
      const manifest = { manifest_version: 2, kind: 'iterlane-project-installation', installation_id: journal.installation_id, package: source.package, skill_roots: roots, files: source.files.map(file => ({ path: file.path, bytes: file.after.length, sha256: sha256(file.after) })), blocks: blockRecords(protectionPaths),state_document_paths:protectionPaths };
      const expected = new Map(source.files.map(file => [file.path, file.after]));
      const sample=journal.journal_version===3?exampleResources(options.packageRoot,journal.example):[];
      if (journal.action === 'initialized') {
        const business = [...layout.empty_files, ...layout.directory_placeholders].map(path => ({ path, after: fs.readFileSync(join(options.packageRoot, 'resources/templates/project', path)) }));
        business.push({ path: 'docs/workflow/state.yaml', after: stateBytes(journal.created_at, business) });
        for (const file of business) expected.set(file.path, file.after);
        for(const file of sample)expected.set(file.path,file.after);
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
          const { kind, bytes: block } = blockBlueprint(protectionPaths).find(block => block.path === entry.path);
          if (entry.kind !== kind || parseManagedBlock(before || Buffer.alloc(0), kind) !== null || !equalBytes(parseManagedBlock(after, kind)?.bytes || null, block) || !equalBytes(replaceManagedBlock(before, kind, null, block), after)) fail('Recovery block is outside its authorized change');
        } else if (entry.kind !== 'file' || before !== null || !expected.has(entry.path) || !equalBytes(after, expected.get(entry.path))) fail('Recovery payload differs from its original source');
      }
      if (journal.temporary) {
        const entry = journal.files.find(file => file.path === journal.temporary.target), image = decode(journal.temporary.data);
        if (journal.intent === 'apply' && !equalBytes(image, decode(entry.after)) || journal.intent === 'undo' && entry.kind === 'file' && !equalBytes(image, decode(entry.before)) || journal.intent === 'undo' && entry.kind !== 'file' && parseManagedBlock(image, entry.kind) !== null) fail('Temporary payload is outside its operation intent');
      }
      return { verify: () => { const result = inspect(root, manifest); if (result.missing.length || result.changed.length || result.extra.length || result.missingBlocks.length) fail('Recovery resource readback failed', 'INCOMPLETE');if(journal.phase!=='committed')for(const file of sample)if(!equalBytes(readProjectFile(root,file.path),file.after))fail('Example recovery content differs','CONFLICT'); } };
    };
    const result = recoverInstallation(root, options.mode, prepare, options);
    if (options.mode === 'resume'&&!options.preview) checkInstallation(root);
    return result;
  }
  const plan = planInstallation(options);
  if (plan.action === 'unchanged') return { action: 'unchanged', project: plan.root, version: metadata.version, client_validation: 'not_run' };
  const result = applyInstallationPlan(plan, options); checkInstallation(plan.root); return result;
}
