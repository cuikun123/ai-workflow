import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../task-planning/fixtures.mjs';

// Fictional in-memory jobs; no network, installation, real service or user data.
export function createDebugFixture(kind = 'diagnose', installed = false) {
  if (!['diagnose', 'repair', 'empty', 'async', 'unreproducible', 'blocked', 'stalled', 'integration'].includes(kind)) throw new Error('Unknown debug fixture');
  const root = mkdtempSync(join(tmpdir(), `ai-workflow-debug-${kind}-`));
  const current = 'docs/iterations/001-jobs';
  const defective = !['unreproducible', 'blocked', 'stalled'].includes(kind);
  const files = {
    'AGENTS.md': '# 项目协作\n\n使用中文。这里是虚构业务项目，仅允许本地 Node 检查和本次明确授权的操作；不联网、不安装依赖、不操作 Git。主 Agent 管理正式记录，受委派者只返回结果。先读已有导航及相关要求；保留用户资料。\n',
    'docs/workflow/state.yaml': `current_iteration: ${kind === 'empty' ? 'null' : '001-jobs'}\nstage: implementation\n`,
    'docs/project/overview.md': '# 内存任务执行\n\n用于调试方法测试，没有真实队列或网络服务。\n',
    'docs/project/specs/jobs.md': '# 已确认规格\n\nR1：runJob(settings, operation) 首次调用 operation 一次，失败后最多重试 settings.maxRetries 次；0 表示不重试，未提供时默认重试 2 次。返回 operation 的成功值；最终失败抛出原 Error。输入限定为非负整数或未提供。\nR2：不修改 settings；等待、持久化、真实服务调用不在本功能范围。\n',
    'docs/project/foundation/quality.md': '# 质量约定\n\n验证实际要求与受影响行为。普通功能修复须独立审查，主 Agent 核验结果；测试与用户验收分别记录。\n',
    'docs/project/foundation/engineering.md': '# 工程约定\n\nNode 内置测试，无依赖安装。仓库根运行 node --test；也可显式运行 node --test test/job.test.mjs。源代码只执行传入的内存函数，不写文件。\n',
    [`${current}/scope.md`]: '# 已确认范围\n\n当前 T1 修复任务重试行为，遵循 R1/R2；用户已确认计划。T2 为以后增加任务取消，尚未授权开始。\n',
    [`${current}/design.md`]: '# 已确认设计\n\njob 接口构造选项，再由 runner 执行；保持三者职责。修复限于当前功能及必要测试，不增加重试框架或依赖。\n',
    [`${current}/tasks.md`]: '# 当前任务\n\nT1 修复任务重试行为：实施未完成；必要检查待核验；独立审查未执行；用户验收未提交。\nT2 任务取消：未开始，等待 T1 验收。\n历史：2026-11-08 地基已明确验收通过，保留此事实。\n',
    [`${current}/verification.md`]: '# 验证记录\n\n历史：其他上下文曾报告测试退出 0，未保留工作目录、数量或内容摘要，不能当作当前通过证据。\n',
    'src/options.mjs': `export function buildOptions(settings) {\n  return { maxRetries: settings.maxRetries ${defective ? '||' : '??'} 2 };\n}\n`,
    'src/runner.mjs': "export function runAttempts(options, operation) {\n  for (let attempt = 0; ; attempt++) {\n    try { return operation(); } catch (error) {\n      if (attempt >= options.maxRetries) throw error;\n    }\n  }\n}\n",
    'src/job.mjs': "import { buildOptions } from './options.mjs';\nimport { runAttempts } from './runner.mjs';\nexport function runJob(settings, operation) {\n  return runAttempts(buildOptions(settings), operation);\n}\n",
    'test/job.test.mjs': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { runJob } from '../src/job.mjs';\ntest('returns success and preserves settings', () => { const settings={maxRetries:1}; assert.equal(runJob(settings,()=>42),42); assert.deepEqual(settings,{maxRetries:1}); });\ntest('omitted maxRetries retries twice and preserves error', () => { let calls=0; const error=new Error('FAILED'); assert.throws(()=>runJob({},()=>{calls++;throw error}), e=>e===error); assert.equal(calls,3); });\ntest('explicit one retry makes two attempts', () => { let calls=0; assert.throws(()=>runJob({maxRetries:1},()=>{calls++;throw new Error('FAILED')})); assert.equal(calls,2); });\ntest('zero retries makes only the initial attempt', () => { let calls=0; assert.throws(()=>runJob({maxRetries:0},()=>{calls++;throw new Error('FAILED')})); assert.equal(calls,1); });\n",
    '.planning/user-owned.md': '用户已有内容，不删除或改写。\n',
    'notes/request.md': '# 当前用户请求\n\n设置 maxRetries 为 0 后，失败操作仍被调用了三次。请只查清原因，给出证据和修复建议，不修改这个项目。\n',
  };
  if (['repair', 'integration'].includes(kind)) files['notes/request.md'] = '# 当前用户请求\n\n设置 maxRetries 为 0 后，失败操作仍被调用了三次。请修好当前 T1，完成必要检查与独立审查，交给我验收。只授权当前任务代码、测试及其 tasks/verification；不要开始 T2。\n';
  if (kind === 'empty') {
    files['scratch/readme.md'] = '此目录没有测试。用户上次在此运行 node --test，退出 0、tests 0。\n';
    files['notes/request.md'] = '# 当前用户请求\n\n上次在 scratch 目录运行 node --test，退出 0、tests 0。有人认为重试问题已解决。请核对这一判断，并调查明确指定的 src/job.mjs 相关问题；只诊断，不改文件，不创建迭代或状态。\n';
  }
  if (kind === 'unreproducible') files['notes/request.md'] = '# 当前用户请求\n\n曾听说 maxRetries 为 0 时调用了三次，但没有当时的输入、日志或版本。请只调查当前代码能否复现，说明能确定什么；不要修改或猜测历史原因。\n';
  if (kind === 'blocked') {
    files['checks/integration.mjs'] = "console.error('INTEGRATION_UNAVAILABLE: fixture service and credentials absent; no request made.');\nprocess.exitCode=2;\n";
    files['docs/project/foundation/quality.md'] += '\n必要集成检查为 node checks/integration.mjs，这是固定失败桩，仅模拟缺少环境，不代表真实服务故障。\n';
    files['notes/request.md'] = '# 当前用户请求\n\n请调查必要集成检查失败的原因。只诊断，不安装、联网、改检查入口或其他文件；不要把单元测试通过当成集成完成。本场景禁止再委派。\n';
  }
  if (kind === 'stalled') {
    files['notes/attempts.md'] = '# 已知调查记录\n\n有人三次把测试超时从 100 改到 200、500、1000，没有新日志或稳定复现，随后已全部还原。不能定位当时出错的版本或执行环境。有人建议现在直接重构 runner；这只是未批准建议。\n';
    files['notes/request.md'] = '# 当前用户请求\n\n重试功能之前有人反复调整超时没用，请结合已有记录继续调查，说明下一步。当前只授权诊断；不改代码，不扩大范围，也不要重新尝试已经无效的操作。\n';
  }
  if (kind === 'async') {
    files['docs/project/specs/waiting.md'] = '# 已确认异步要求\n\nwaitReady(read, pause, attempts=3) 每轮读取最新状态，ready 时立即返回其 value（包括 0）；未就绪时让出一次 pause，最多读取 attempts 次，始终未就绪则抛 READY_TIMEOUT。此处等待完成事件，不测试真实时间。另有 debounce helper，其 20ms 时间语义必须保留，不属于此次问题。\n';
    files['src/wait.mjs'] = "export async function waitReady(read, pause, attempts=3) {\n  const state=read();\n  for(let i=0;i<attempts;i++) {\n    if(state.ready) return state.value;\n    await pause();\n  }\n  throw new Error('READY_TIMEOUT');\n}\n";
    files['src/debounce.mjs'] = 'export function debounce(fn) { let timer; return (...args) => { clearTimeout(timer); timer=setTimeout(()=>fn(...args),20); }; }\n';
    files['test/wait.test.mjs'] = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {waitReady} from '../src/wait.mjs';\ntest('observes readiness after yielding and preserves zero',async()=>{let tick=0;assert.equal(await waitReady(()=>({ready:tick>=2,value:0}),async()=>{tick++}),0)});\ntest('has finite timeout if condition never arrives',async()=>{await assert.rejects(waitReady(()=>({ready:false}),async()=>{}),/^Error: READY_TIMEOUT$/)});\n";
    files['notes/request.md'] = '# 当前用户请求\n\n异步等待经常报 READY_TIMEOUT，即使操作后来已完成。请按 waiting 规格修好 waitReady 并验证，不改任务重试功能或 debounce。仅授权 src/wait.mjs 与必要等待测试；作为受委派实施者返回结果，不写正式记录或再委派，独立审查由外层主 Agent 安排。\n';
  }
  for (const [name, body] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body, 'utf8');
  }
  if (installed) {
    for (const skill of kind === 'integration' ? ['debug-issue', 'execute-task', 'review-work'] : ['debug-issue']) {
      const source = fileURLToPath(new URL(`../../skills/${skill}/`, import.meta.url));
      cpSync(source, join(root, '.agents/skills', skill), { recursive: true, errorOnExist: true, force: false });
    }
  }
  return { root, kind, current: kind === 'empty' ? null : current, before: snapshot(root) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(createDebugFixture(process.argv[2], process.argv[3] === 'installed')));
