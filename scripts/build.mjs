import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, rmSync, renameSync, lstatSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {copyPackageDocuments} from './package-docs.mjs';
import {renameDirectory} from './build-rename.mjs';
import {copyExample} from '../src/example-resources.mjs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { listRegularFiles, assertSafeRoot, isWithin, resolveRegularFile } from '../src/paths.mjs';
import { checkPackage, sha256, skillNames, userPackageResources } from '../src/package.mjs';
import { WorkflowError } from '../src/errors.mjs';
import {renderSkillResources} from '../src/skill-bundles.mjs';
import {sourceSharedDigests,validateSkillManifest} from '../src/skill-resources.mjs';
import {isUserPackageResource} from '../src/document-links.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
const require = createRequire(import.meta.url);
const dependencyNames = ['ajv', 'yaml', 'fast-uri', 'fast-deep-equal', 'json-schema-traverse', 'require-from-string', 'esbuild'];

function copyTree(source, target, filter = () => true) {
  listRegularFiles(source); mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: false, errorOnExist: true,
    filter: path => lstatSync(path).isDirectory() || filter(relative(source, path).replaceAll('\\', '/')) });
}
function notices() {
  let text = '# Third-party notices\n\nSkill sources and full licenses are preserved in each resources/skills/*/NOTICE.md.\n';
  const lock = JSON.parse(readFileSync(join(repo, 'package-lock.json'), 'utf8'));
  const deps = [];
  for (const name of dependencyNames) {
    const root = dirname(require.resolve(name + '/package.json'));
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const entry = lock.packages['node_modules/' + name];
    if (!entry || pkg.version !== entry.version || !entry.integrity) throw new WorkflowError('PACKAGE_INVALID', 'Dependency differs from lock: ' + name);
    const licenseFile = readdirSync(root).find(file => /^licen[sc]e(?:\.(?:md|txt))?$/i.test(file));
    if (!licenseFile) throw new WorkflowError('PACKAGE_INVALID', 'Dependency license missing: ' + name);
    const license = readFileSync(join(root, licenseFile), 'utf8');
    text += '\n## ' + name + ' ' + pkg.version + ' (' + pkg.license + ')\n\n' + (name === 'esbuild' ? 'Build-only tool; binary is not distributed.\n\n' : '') + license.trim() + '\n';
    deps.push({ name, version: pkg.version, license: pkg.license, integrity: entry.integrity, license_sha256: sha256(Buffer.from(license)) });
  }
  return { text, deps };
}

export async function buildPackage(output = join(repo, 'dist')) {
  output = resolve(output);
  if (isWithin(output, repo)) throw new WorkflowError('IO', 'Refusing to replace source directory or its ancestor');
  assertSafeRoot(dirname(output));
  let previousExpectation=null;
  if (existsSync(output)) {
    const stat = lstatSync(output);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new WorkflowError('IO', 'Output is not a real directory');
    // Validate the intact previous build against its own recorded skill layout.
    // New staging output is still checked against the current source policy.
    const shared=join(output,'resources/skills/_shared'),previousPolicy=validateSkillManifest(JSON.parse(readFileSync(resolveRegularFile(shared,'manifest.json'),'utf8')));
    previousExpectation={skillManifest:previousPolicy,sharedDigests:sourceSharedDigests(shared,previousPolicy)};
    checkPackage(output,previousExpectation);
  }
  const staging = output + '.staging-' + randomUUID(), previous = output + '.previous-' + randomUUID();
  mkdirSync(staging); let movedPrevious = false, installed = false;
  try {
    const { build } = await import('esbuild');
    mkdirSync(join(staging, 'runtime'));
    mkdirSync(join(staging,'resources'),{recursive:true});const rendered=renderSkillResources(join(repo,'skills'),join(staging,'resources/skills'));
    await build({ absWorkingDir:repo, entryPoints: [join(repo, 'src/cli.mjs')], outfile: join(staging, 'runtime/cli.mjs'), bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: false, legalComments: 'inline',define:{__ITERLANE_SHARED_DIGESTS__:JSON.stringify(rendered.expectedDigests)}, banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' } });
    mkdirSync(join(staging, 'bin'));
    writeFileSync(join(staging, 'bin/iterlane.mjs'), '#!/usr/bin/env node\nimport {fileURLToPath} from "node:url";\ntry { const { runCli } = await import("../runtime/cli.mjs"); process.exitCode = await runCli(process.argv.slice(2), { packageRoot: fileURLToPath(new URL("../", import.meta.url)) }); } catch { process.stdout.write(JSON.stringify({ok:false,error:{code:"PACKAGE_INVALID",message:"Packaged runtime is missing or damaged",details:[]}})+"\\n"); process.exitCode=4; }\n');
    const pkg = { name: metadata.name, version: metadata.version, private: true, type: 'module', description: metadata.description, license: metadata.license, engines: metadata.engines, bin: { [metadata.name]: 'bin/iterlane.mjs' } };
    writeFileSync(join(staging, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    writeFileSync(join(staging, 'README.md'), `# Iterlane 工具包

内部试用版。这是完整的工具包，运行时不需要源码或 npm 依赖。版本与支持范围见[版本与支持范围](docs/releasing.md)。

## 安装到新项目

在工具包目录的终端运行：

\`\`\`powershell
node bin/iterlane.mjs check --json
node bin/iterlane.mjs init --project <新项目目录> --preview --json
node bin/iterlane.mjs init --project <新项目目录> --json
\`\`\`

第二条是预览，确认目标目录正确后再运行第三条。装好后，在项目里使用 \`node .ai-workflow/bin/iterlane.mjs\`。

[快速开始](docs/quickstart.md)按试用 ZIP 编写，命令开头是 \`runtime/bin\`。直接用本工具包时，把它换成 \`bin\`。

## 文档

- [使用指南](docs/usage.md)：怎么和 AI 一起开发、确认和验收
- [命令参考](scripts/README.md)：命令、参数和输出
- [版本与支持范围](docs/releasing.md)：支持什么、不支持什么

Copyright (c) 2026 TY。整体 [MIT](LICENSE)，第三方完整许可见 THIRD_PARTY_NOTICES.md 和各技能 NOTICE.md。
`);
    const declared = userPackageResources();
    copyTree(join(repo, 'templates'), join(staging, 'resources/templates'), path => isUserPackageResource('resources/templates/' + path, declared));
    mkdirSync(join(staging,'resources/examples'));copyExample(join(repo,'examples/bookmarks'),join(staging,'resources/examples/bookmarks'));
    mkdirSync(join(staging, 'resources/schemas'), { recursive: true });
    cpSync(join(repo, 'schemas/state-v1.schema.json'), join(staging, 'resources/schemas/state-v1.schema.json'));
    cpSync(join(repo, 'schemas/workflow-record-v1.schema.json'), join(staging, 'resources/schemas/workflow-record-v1.schema.json'));
    cpSync(join(repo, 'schemas/workflow-record-v2.schema.json'), join(staging, 'resources/schemas/workflow-record-v2.schema.json'));
    copyTree(join(repo, 'sources'), join(staging, 'resources/sources'), path => isUserPackageResource('resources/sources/' + path, declared));
    copyPackageDocuments(repo, staging);
    const { text, deps } = notices(); writeFileSync(join(staging, 'THIRD_PARTY_NOTICES.md'), text);
    writeFileSync(join(staging, 'dependency-manifest.json'), JSON.stringify(deps, null, 2) + '\n');
    if (metadata.license !== 'UNLICENSED') {
      if (!existsSync(join(repo, 'LICENSE'))) throw new WorkflowError('PACKAGE_INVALID', 'Root LICENSE is required');
      cpSync(join(repo, 'LICENSE'), join(staging, 'LICENSE'));
    }
    const files = listRegularFiles(staging).map(path => { const bytes = readFileSync(join(staging, path)); return { path, bytes: bytes.length, sha256: sha256(bytes) }; });
    writeFileSync(join(staging, 'resource-manifest.json'), JSON.stringify({ manifest_version: 1, kind: 'ai-workflow-resource-package', package: { name: metadata.name, version: metadata.version, state_schemas: [1] }, files }, null, 2) + '\n');
    checkPackage(staging);
    if (existsSync(output)) { if(!previousExpectation)throw new WorkflowError('CONFLICT','Output appeared during build');checkPackage(output,previousExpectation); renameDirectory(output, previous); movedPrevious = true; }
    renameDirectory(staging, output); installed = true;
    const result = checkPackage(output);
    if (movedPrevious) { checkPackage(previous,previousExpectation); rmSync(previous, { recursive: true }); }
    return { output, ...result };
  } catch (error) {
    if (!installed && movedPrevious && !existsSync(output)) renameDirectory(previous, output);
    throw error;
  } finally { if (existsSync(staging)) rmSync(staging, { recursive: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1])) throw new WorkflowError('USAGE', 'Usage: node scripts/build.mjs [--out <directory>]');
    console.log(JSON.stringify(await buildPackage(args[1])));
  } catch (error) { console.error((error.code || 'IO') + ': ' + error.message); process.exitCode = error.code === 'USAGE' ? 2 : 6; }
}
