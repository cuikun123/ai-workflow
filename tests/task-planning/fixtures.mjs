import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Fictional business data used only in isolated skill evaluations.
export function createFixture(kind = 'new') {
  if (!['new', 'update', 'conflict', 'navigation', 'missing'].includes(kind)) throw new Error('Unknown fixture');
  const root = mkdtempSync(join(tmpdir(), `ai-workflow-plan-${kind}-`));
  const current = 'docs/iterations/001-labels';
  const files = {
    'AGENTS.md': '# 项目协作\n\n使用中文。先读 docs/workflow/state.yaml 和 docs/project/overview.md，再读当前迭代资料及关联规格。docs/project 保存有效约定，docs/iterations 保存各轮 scope.md、design.md、tasks.md、verification.md。状态只作导航。关键范围、设计和交付变化由用户确认。Git 操作需单独授权。\n',
    'docs/workflow/state.yaml': 'current_iteration: 001-labels\nstage: planning\nconfirmations: []\nnext_task: null\nblockers: []\n',
    'docs/project/overview.md': '# 阅读资料夹\n\n虚构验收项目。个人整理阅读条目，本轮增加标签管理。没有真实服务和用户数据。\n',
    'docs/project/foundation/quality.md': '# 质量约定\n\n必要验证由 AI 根据影响选择并执行；不能因未明确要求测试而省略验证。用户按完整成果验收，未明确通过不得记录为已验收。\n',
    'docs/project/foundation/engineering.md': '# 工程约定\n\n已有 Web 页面和条目存储层。技术栈在本场景中不作进一步选型；只规划任务，不构造不存在的文件、接口或命令。\n',
    'docs/project/foundation/security.md': '',
    'docs/project/foundation/experience.md': '',
    'docs/project/foundation/operations.md': '',
    'docs/project/specs/labels.md': '# 标签\n\nR1：用户可创建标签；名称去掉首尾空格后不能为空；同名标签不允许重复。成功后列表显示并在刷新后保留。\nR2：用户可给已有条目分配或移除一个标签；保存后条目显示对应标签，刷新后保留；支持无标签。\n本轮不做删除标签、共享、多标签或筛选。\n',
    [`${current}/scope.md`]: '# 本轮范围\n\n范围已确认：R1 创建标签；R2 给已有条目分配或移除一个标签。按两个完整成果安排任务，创建优先。计划尚未确认，当前只授权编写计划。验收依据见 ../../project/specs/labels.md。\n',
    [`${current}/design.md`]: '# 实现方案\n\n方案已确认：标签独立保存，条目持有可空标签引用；创建前处理空白与同名校验，持久化层防止重复。沿用现有存储适配层和页面组件，不新增服务。先创建标签，再在条目编辑中设置或移除标签，覆盖保存失败和刷新后状态。\n',
    [`${current}/tasks.md`]: '',
    [`${current}/verification.md`]: '',
    'src/catalog.js': 'export const revision = 1;\n',
    '.planning/keep-user-note.md': '用户已有资料，不属于本次计划输出，保留。\n',
  };
  if (kind === 'update') {
    files[`${current}/tasks.md`] = '# 本轮任务\n\n## T1 创建标签\n\n实施：已完成；AI 检查：通过；用户验收：2026-11-08 明确通过。\n依据：verification.md#t1。\n\n## T2 设置或移除条目标签\n\n实施：进行中；AI 检查：未执行；用户验收：未提交。\n已完成：存储接口；待完成：编辑页和联调。\n';
    files[`${current}/verification.md`] = '# 验证记录\n\n## T1\n\n历史记录：2026-11-08 用户明确通过创建标签。接口与刷新检查当时通过；该证据不覆盖后续修改。\n';
    files['docs/workflow/state.yaml'] = 'current_iteration: 001-labels\nstage: implementation\nnext_task: T2\nblockers: []\n';
  }
  if (kind === 'conflict') {
    files[`${current}/design.md`] += '\n待核对的技术备注：为省工作量，允许重复标签名，同名时始终新建。此备注尚未获用户确认。\n';
  }
  if (kind === 'navigation') {
    files['docs/workflow/state.yaml'] = 'current_iteration: null\nstage: planning\n';
    files['docs/iterations/002-import/scope.md'] = '# 候选工作\n\n另一轮未选为当前工作的导入需求。\n';
    files['docs/iterations/002-import/tasks.md'] = '';
  }
  if (kind === 'missing') {
    files['docs/project/specs/labels.md'] = '# 标签\n\nR1：用户可创建标签；名称去掉首尾空格后不能为空。重名时拒绝、复用还是允许同名，业务尚未决定。成功后列表显示并在刷新后保留。\nR2：用户可给已有条目分配或移除一个标签；保存后条目显示对应标签，刷新后保留；支持无标签。\n本轮不做删除标签、共享、多标签或筛选。\n';
    files[`${current}/design.md`] = '# 实现方案\n\n标签独立保存，条目持有可空标签引用。沿用现有存储适配层和页面组件，不新增服务。重名处理及对应存储约束随业务决定，尚未确认。其余方案已确认。\n';
    files[`${current}/scope.md`] = '# 本轮范围\n\n范围已确认：R1 创建标签；R2 给已有条目分配或移除一个标签。按两个完整成果安排任务，创建优先。重名策略仍待确认，不代表已有结论。当前只授权整理计划中可确定的部分，不能直接实施。\n';
  }
  for (const [name, content] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return { root, kind, current, before: snapshot(root) };
}

export function snapshot(root) {
  const result = {};
  function visit(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile()) result[relative(root, absolute).replaceAll('\\', '/')] = createHash('sha256').update(readFileSync(absolute)).digest('hex');
      else throw new Error(`Unexpected filesystem entry: ${absolute}`);
    }
  }
  visit(root);
  return result;
}

export function changes(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(name => before[name] !== after[name]).sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(createFixture(process.argv[2] || 'new')));
}
