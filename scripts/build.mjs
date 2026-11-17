import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, rmSync, renameSync, lstatSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {renameDirectory} from './build-rename.mjs';
import {copyExample} from '../src/example-resources.mjs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { listRegularFiles, assertSafeRoot, isWithin, resolveRegularFile } from '../src/paths.mjs';
import { checkPackage, sha256, skillNames } from '../src/package.mjs';
import { WorkflowError } from '../src/errors.mjs';
import {renderSkillResources} from '../src/skill-bundles.mjs';
import {sourceSharedDigests,validateSkillManifest} from '../src/skill-resources.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
const require = createRequire(import.meta.url);
const dependencyNames = ['ajv', 'yaml', 'fast-uri', 'fast-deep-equal', 'json-schema-traverse', 'require-from-string', 'esbuild'];

function copyTree(source, target) {
  listRegularFiles(source); mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: false, errorOnExist: true });
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
    writeFileSync(join(staging, 'README.md'), `# Iterlane 内部资源包

在已存在的新项目目录安装：node bin/iterlane.mjs init --project <dir> --preview --json，核对后执行同样命令并去掉--preview。

check [--package <dir> | --project <dir>]检查资源；validate --state <file>只校验YAML/state结构。项目内入口为node .ai-workflow/bin/iterlane.mjs check --json，可脱离源码、node_modules和网络运行。

status --json只读诊断书签、文档和记录；check --documents --json补文档检查。获准的主流程使用transition --input <json> --json做受校验的语义转换，记录协议见项目Skills中的workflow-guide/references/common/state-runtime.md。未完成状态写入使用transition --resume或--undo，加--expected-revision <n>；undo以新revision表示恢复位置。工具校验本地声明及内容版本，不认证人类验收、检查执行或审查身份。

doctor --project <dir> --json聚合本地资源、版本、状态、日志和锁的问题；默认不探测网络或读取全局凭据，显式client-evidence是未认证观察。recover --repair --package <同一固定包> --preview，或--resume/--undo --operation-id <uuid>按日志类别补匹配来源或--expected-revision；核对预览和原授权后才执行。recover --refresh还需准确revision与稳定request-id；恢复不重试业务动作。doctor退出0表示诊断运行完成，local_valid及findings表达实际检查结果。

同版本缺失资源使用init --project <dir> --repair；未完成初始化可显式--resume或--undo。有效日志形成前中断会停止并保留现场；用户改变的资源不自动覆盖。

初始化及状态写入在.gitattributes维护精确路径的管理区块，保留框架资源、入口、state和摘要依据的原字节；其他代码及外来Skills沿原Git文本规则处理。区块外规则保持，特殊filter/更高优先级属性仍须单独核对。旧开发版本不会自动迁移。

该包用于新项目内部试用，不支持旧项目自动升级或旧任务自动迁移。技能按任务影响选择直接、轻量或完整流程；skills check --json核对技能引用、依赖和共享摘要，普通功能及PR仍保留独立审查。需求增量和验收后规格同步说明见workflow-guide/references/common/spec-runtime.md。spec sync --preview --json列出计划写入的文件，执行时产生本地锁和操作日志。

版本操作只使用明确支持的兼容路径和匹配的完整外部工具，保留业务资料、任务状态和后来修改。方法见references/common/version-runtime.md；check和repair要求同一版本，不借修复执行升级。

安装不代表客户端接入或用户验收。跨项目调度和业务Git/部署执行未实现；此private开发包不可发布。

Copyright (c) 2026 TY. MIT见LICENSE；第三方许可见THIRD_PARTY_NOTICES.md及resources/skills/*/NOTICE.md。
`);
    copyTree(join(repo, 'templates'), join(staging, 'resources/templates'));
    mkdirSync(join(staging,'resources/examples'));copyExample(join(repo,'examples/bookmarks'),join(staging,'resources/examples/bookmarks'));
    mkdirSync(join(staging, 'resources/schemas'), { recursive: true });
    cpSync(join(repo, 'schemas/state-v1.schema.json'), join(staging, 'resources/schemas/state-v1.schema.json'));
    cpSync(join(repo, 'schemas/workflow-record-v1.schema.json'), join(staging, 'resources/schemas/workflow-record-v1.schema.json'));
    cpSync(join(repo, 'schemas/workflow-record-v2.schema.json'), join(staging, 'resources/schemas/workflow-record-v2.schema.json'));
    copyTree(join(repo, 'sources'), join(staging, 'resources/sources'));
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
