import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../task-planning/fixtures.mjs';

// Fictional, in-memory API; generated only under the system temporary directory.
export function createReviewFixture(kind = 'defect') {
  if (!['defect', 'clean', 'feedback', 'missing', 'blocked', 'detached', 'design', 'plan'].includes(kind)) throw new Error('Unknown review fixture');
  const root = mkdtempSync(join(tmpdir(), `ai-workflow-review-${kind}-`));
  const current = 'docs/iterations/001-labels';
  const defective = ['defect', 'feedback'].includes(kind);
  const files = {
    'AGENTS.md': '# 项目协作\n\n使用中文。先读 docs/workflow/state.yaml，再定位本次范围和相关规格、质量约定。主 Agent 管理正式进度与验证记录；独立审查者返回结果。仅审查不修改实现。审查反馈不是新需求。当前环境只允许本地读取与 Node 内置检查，不联网、不安装、不操作 Git。\n',
    'docs/workflow/state.yaml': kind === 'detached' ? 'current_iteration: null\n' : 'current_iteration: 001-labels\nstage: review\n',
    'docs/project/overview.md': '# 标签 API\n\n虚构独立函数，用于验证审查方法；没有运行中的服务、持久化或真实用户数据。\n',
    'docs/project/specs/labels.md': '# 已确认要求\n\nR1：createLabel(labels, raw) 接收字符串数组及字符串 raw；去掉 raw 首尾空白后不能为空，空名称抛出 Error("EMPTY_NAME")。\nR2：返回包含新名称的新数组，原输入数组保持不变。\n' + (kind === 'missing' ? 'R3：重名策略尚未确认，包括是否区分大小写。\n' : 'R3：精确同名抛出 Error("DUPLICATE_NAME")，大小写不同可共存，名称保持原大小写。\n') + '非字符串输入、网络和持久化不在本项范围内。\n',
    'docs/project/foundation/quality.md': '# 质量约定\n\n按已确认需求检查正常、边界与异常行为；实际运行必要检查。现有测试通过不能代替未覆盖场景。报告只覆盖实际检查范围，不将 AI 审查记作用户验收。\n',
    'docs/project/foundation/engineering.md': '# 工程约定\n\n使用 Node 内置 node:test，运行 node --test。可以运行无文件写入的 node --input-type=module 检查函数。无需依赖安装。\n',
    'src/labels.mjs': defective ? "export function createLabel(labels, raw) {\n  const name = raw.trim();\n  if (raw === '') throw new Error('EMPTY_NAME');\n  if (labels.includes(name)) throw new Error('DUPLICATE_NAME');\n  labels.push(name);\n  return labels;\n}\n" : "export function createLabel(labels, raw) {\n  const name = raw.trim();\n  if (!name) throw new Error('EMPTY_NAME');\n  if (labels.includes(name)) throw new Error('DUPLICATE_NAME');\n  return [...labels, name];\n}\n",
    'test/labels.test.mjs': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {createLabel} from '../src/labels.mjs';\ntest('creates a trimmed label', () => assert.deepEqual(createLabel([], ' Read '), ['Read']));\ntest('rejects an exact duplicate', () => assert.throws(() => createLabel(['Read'], 'Read'), /^Error: DUPLICATE_NAME$/));\n",
    '.planning/user-owned.md': '用户已有资料，保留原样。\n',
  };
  if (kind !== 'detached') {
    files[`${current}/scope.md`] = '# 范围\n\nR1 至 R3，范围和设计已确认（明确标为未确认的规则除外）。当前请求是审查与反馈核验，尚未授权修改实现。\n';
    files[`${current}/design.md`] = '# 设计与实现者说明\n\n一个独立函数，通过 trim、精确比较和新数组满足需求。实现者声称已完成全部要求、现有两项测试通过；这只是提交说明，需核对实际内容。\n' + (kind === 'missing' ? '\n讨论备注：建议统一小写去重，未确认。\n' : '');
    files[`${current}/tasks.md`] = '# 任务\n\nT1 标签 API：实施者提交待审查；AI 检查：待本次核验；用户验收：未提交。\n';
    files[`${current}/verification.md`] = '# 验证记录\n\n历史：上次两项 happy-path 检查通过；当时内容未留摘要。本次尚无独立审查结论。\n';
  }
  if (kind === 'clean' || kind === 'blocked' || kind === 'detached') {
    files['test/labels.test.mjs'] += "test('rejects whitespace names', () => assert.throws(() => createLabel([], '  '), /^Error: EMPTY_NAME$/));\ntest('returns a new array and keeps input', () => {const input=['Read'];const out=createLabel(input,'Work');assert.deepEqual(input,['Read']);assert.notEqual(input,out);});\ntest('preserves case distinctions', () => assert.deepEqual(createLabel(['Read'],'read'), ['Read','read']));\n";
  }
  if (kind === 'blocked') {
    files['checks/integration.mjs'] = "console.error('INTEGRATION_UNAVAILABLE: fixture has no configured external service; no network request made.');\nprocess.exitCode = 2;\n";
    files['docs/project/foundation/quality.md'] += '\n本任务另须通过 node checks/integration.mjs。该检查是固定失败的测试入口，用于模拟必要集成验证受阻；本地单元测试不能替代。\n';
  }
  if (kind === 'design' || kind === 'plan') {
    delete files['src/labels.mjs'];
    delete files['test/labels.test.mjs'];
    files['docs/workflow/state.yaml'] = 'current_iteration: 001-labels\nstage: design\n';
    files['docs/project/specs/labels.md'] = '# 当前有效行为\n尚无标签API。新需求及确认记录在本轮scope。\n';
    files[`${current}/scope.md`] = '# 已确认需求\nR1：createLabel(labels, raw)接收字符串数组和字符串raw，去首尾空白后不能为空，空名称抛出Error("EMPTY_NAME")。\nR2：返回新数组，输入数组保持不变。\nR3：精确同名抛出Error("DUPLICATE_NAME")，大小写不同可共存，保持原大小写。\n只审查本轮方案或计划，尚未实施，也未批准实现方案。无需网络、持久化或非字符串输入处理。\n';
    files[`${current}/design.md`] = kind === 'design'
      ? '# 待审设计\ntrim后拒绝空名称；为了统一搜索，将名称转为小写后去重并保存。使用labels.push(name)追加，再返回labels以减少复制。\n'
      : '# 待审设计\ntrim后检查非空，精确匹配检测重名，保留大小写，返回新数组且不改输入。使用Node内置测试，覆盖R1-R3。\n';
    files[`${current}/tasks.md`] = kind === 'plan'
      ? '# 待审任务计划\nT1：实现完整标签API并验证R1-R3、完成独立审查、提交用户验收。T1验收后立即启动T2；本轮规格统一等T2验收后再同步。\nT2：补充标签API使用示例，依赖T1。\n'
      : '# 任务\n尚未安排，当前仅请求审查设计。\n';
    files[`${current}/verification.md`] = '# 验证\n尚未实施；没有运行测试或实现验收记录。\n';
    files['docs/project/foundation/quality.md'] = '# 已确认质量约定\n关键方案在实施前检查，普通功能任务验收前独立审查。每项成果经用户验收且必要检查、审查满足后，只同步本成果实际交付的业务变化；完成收尾再接续下一成果。\n';
  }
  for (const [name, text] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
  }
  return { root, kind, current: kind === 'detached' ? null : current, before: snapshot(root) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(createReviewFixture(process.argv[2])));
