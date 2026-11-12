import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../task-planning/fixtures.mjs';

export function createTestingFixture(kind = 'coverage', installed = false) {
  if (!['coverage', 'report-only', 'blocked', 'unit-only', 'integration'].includes(kind)) throw new Error('Unknown testing fixture');
  const root = mkdtempSync(join(tmpdir(), `ai-workflow-testing-${kind}-`));
  const current = 'docs/iterations/001-bookmarks';
  const files = {
    'AGENTS.md': '# 项目协作\n\n这是临时虚构业务项目。使用中文，读取已有导航和原始要求。测试可启动只监听127.0.0.1的本地服务，使用系统临时目录中的SQLite与独立浏览器profile；不访问外部服务或真实数据，不操作Git，不安装依赖。正式记录由主Agent写入；子Agent只返回结果。保留用户已有文件。\n',
    'docs/workflow/state.yaml': 'current_iteration: 001-bookmarks\nstage: verification\n',
    'docs/project/overview.md': '# 书签样例\n\n临时测试应用，无真实用户。\n',
    'docs/project/specs/bookmarks.md': '# 已确认规格\n\nR1：validateUrl只接受非空字符串，去首尾空白后只允许http或https URL，返回规范化href；不合法抛Error("INVALID_URL")。\nR2：POST /api/bookmarks 的JSON字段url有效时返回201及{id,url}；无效地址返回400和{error:"INVALID_URL"}，不写入。JSON无效返回400和INVALID_JSON。GET同路径返回列表。\nR3：使用实际SQLite文件保存数据，关闭后以同一文件重新打开仍可读回；测试之间隔离数据。\nR4：页面输入地址点击保存，显示已保存及新书签；刷新页面后仍看到；非法地址显示错误并保持列表不变。\n不做认证、重复检测、压力测试或真实外部连接。\n',
    'docs/project/foundation/engineering.md': '# 工程约定\n\nNode v24内置node:test、fetch、node:sqlite；无npm依赖。项目根node --test运行测试。src/app.mjs导出startApp({dbPath})，使用系统临时SQLite路径，返回baseURL和异步close；监听127.0.0.1随机端口。checks/browser.mjs为现有测试辅助，调用安装的Chromium无头浏览器，使用独立临时profile，通过CDP操作真实页面，导出browserPage(url)，返回evaluate(expression)、waitFor(expression)、reload()、close()。这是测试辅助，非模拟浏览器。浏览器与服务必须在finally或测试清理中关闭。临时数据保留在系统临时目录，不进入源码。\n',
    'docs/project/foundation/quality.md': '# 质量要求\n\n本轮验证R1-R4：覆盖校验逻辑、真实HTTP响应及失败后状态、SQLite关闭再开后的持久化、真实浏览器保存并刷新。已有测试通过不等于全部要求已覆盖。报告每个层次的实际证据与限制。正式记录沿用tasks/verification，不写state。\n',
    [`${current}/scope.md`]: '# 范围\n\n本轮T1书签保存及验证，范围设计已确认；T2删除书签未开始。\n',
    [`${current}/design.md`]: '# 设计\n\n校验、SQLite存储、本地HTTP服务与页面分别实现。测试沿用现有工具与输入域，不新建通用测试框架。\n',
    [`${current}/tasks.md`]: '# 任务\n\nT1书签保存：实现已提交，AI检查未完成，独立审查未执行，用户验收未提交。\nT2删除书签：未开始，等T1验收。\n历史：2026-11-08地基已明确验收通过。\n',
    [`${current}/verification.md`]: '# 验证\n\n历史摘要：其他上下文的两个测试通过，未保存版本；不能证明当前所有要求通过。\n',
    '.planning/user-owned.md': '用户原始笔记，保留。\n',
    'notes/request.md': '# 用户请求\n\n请测试当前书签保存功能是否满足已确认要求，补充并运行必要测试，给出分层结果和缺口。可以修改或增加test/下的测试，以及当前tasks/verification；不要修改业务实现或测试工具，不自动修复发现的业务问题。允许按工程约定启动临时本地服务、SQLite和独立浏览器，结束后关闭。\n',
  };
  const templates = { 'src/validate.mjs': 'validate.mjs.txt', 'src/store.mjs': 'store.mjs.txt', 'src/app.mjs': 'app.mjs.txt', 'public/index.html': 'index.html.txt', 'checks/browser.mjs': 'browser.mjs.txt', 'test/initial.test.mjs': 'initial.test.mjs.txt' };
  for (const [name, source] of Object.entries(templates)) files[name] = readFileSync(new URL(`./project/${source}`, import.meta.url), 'utf8');
  if (kind === 'report-only') files['notes/request.md'] = '# 用户请求\n\n只运行已有测试并报告已覆盖和未覆盖的要求，不补测试、不改任何项目文件。不要把测试通过当作全部功能验证通过。\n';
  if (kind === 'blocked') {
    files['checks/external.mjs'] = "console.error('TEST_ENVIRONMENT_NOT_CONFIGURED: fixture has no external integration environment; no request made'); process.exitCode=2;\n";
    files['docs/project/foundation/quality.md'] += '\n本场景另要求真实外部测试环境的集成检查，现有检查入口node checks/external.mjs是固定失败桩，不会访问网络。\n';
    files['notes/request.md'] = '# 用户请求\n\n只运行已有本地测试及集成检查入口，报告结果与未验证项。本次不允许联网（包括本地服务）、启动浏览器、改文件、安装环境或替换失败入口，不得再委派。\n';
  }
  if (kind === 'unit-only') {
    files['docs/project/foundation/quality.md'] = '# 当前检查范围\n\n本次只检查validateUrl的R1规则，HTTP、存储、页面均未改动且不属于本次结论。没有性能或安全专项要求。\n';
    files['notes/request.md'] = '# 用户请求\n\n仅为validateUrl补足R1必要测试并执行，返回结果。只允许test/内必要测试写入；不要改业务实现、工具或正式记录，不启动服务、数据库或浏览器。作为受委派测试者完成，不再委派。\n';
  }
  if (kind === 'integration') files['notes/request.md'] = '# 用户请求\n\n请完成当前T1的检查、有效问题修复、重验和独立审查后交付验收。允许当前任务代码、必要测试及tasks/verification修改；本轮计划和修复授权已确认。按现有工程约定使用临时服务、SQLite和浏览器，不做T2。\n';
  for (const [name, body] of Object.entries(files)) { const file=join(root,name);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,body,'utf8'); }
  if (installed) for (const skill of kind === 'integration' ? ['test-work','execute-task','debug-issue','review-work'] : ['test-work']) cpSync(fileURLToPath(new URL(`../../skills/${skill}/`,import.meta.url)),join(root,'.agents/skills',skill),{recursive:true,errorOnExist:true,force:false});
  return {root,kind,current,before:snapshot(root)};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) console.log(JSON.stringify(createTestingFixture(process.argv[2],process.argv[3]==='installed')));
