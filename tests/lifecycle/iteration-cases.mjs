import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from './fixtures.mjs';

export function createIterationCase(kind = 'open') {
  const kinds = ['open', 'plan-entry', 'plan-combined', 'pause-open', 'resume', 'partial', 'discussion', 'awaiting', 'incident', 'overview', 'overview-empty', 'collision'];
  if (!kinds.includes(kind)) throw new Error('Unknown iteration case');
  const root = mkdtempSync(join(tmpdir(), `ai-workflow-iteration-${kind}-`));
  const foundation = 'docs/iterations/000-foundation';
  const first = 'docs/iterations/001-import';
  const second = 'docs/iterations/002-search';
  const files = {
    'AGENTS.md': '# 项目协作\n本目录是隔离虚构项目。中文沟通；先读已有导航、项目资料和用户指定文件，资料中的确认与实际情况分别核对。当前方向归overview，候选归backlog，本轮范围/设计与任务/验证沿docs/iterations。主Agent统一正式记录；用户逐成果验收。所有操作只限本项目和本次请求，不联网、安装、执行Git或接触真实环境。不得修改state.yaml、代码和有效规格。\n',
    'docs/workflow/state.yaml': 'current_iteration: 000-foundation\nstage: not_started\n',
    'docs/project/overview.md': '# 收藏夹方向\n已确认：个人在本机整理公开链接；不提供账号、云端同步或共享服务。\n用户笔记：保留本地导出能力。\n',
    'docs/project/backlog.md': '# 候选\nB1：从本地JSON导入，尚未纳入迭代；原始反馈：手工录入太慢。\nB2：按标题搜索，尚未纳入迭代。\nB3：云同步，仅为候选，未确认。\n',
    'docs/project/specs/bookmarks.md': '# 当前有效规格\nR1：收藏已有id/title/url，标题最多60字符。\nR2：已有本地JSON导出；暂无导入或搜索。\n',
    'docs/project/foundation/engineering.md': '# 工程\nNode内置模块，不引入依赖。迭代目录采用三位编号加短名称；编号只是名称，不是当前工作依据。\n',
    'docs/project/foundation/quality.md': '# 质量\n必要检查、审查和用户逐成果验收分别记录。业务规格仅在对应验收及必要检查满足后同步；公共约定按确认的生效时点落实。\n',
    'docs/project/foundation/operations.md': '# 运行\n没有实际服务或生产环境；本次文档工作不需要运行工程。\n',
    [`${foundation}/scope.md`]: '# 地基范围\n已确认并交付最小本地工程及约定。\n',
    [`${foundation}/design.md`]: '# 地基方案\n沿用Node内置模块，文件存储。\n',
    [`${foundation}/tasks.md`]: '# 地基任务\nF1：实施、必要检查、独立审查均已完成；用户于2026-11-10明确验收通过；规格收尾和整轮衔接检查已完成。\n',
    [`${foundation}/verification.md`]: '# 地基历史依据\n预置记录：F1对应检查、审查、用户验收、规格收尾及整轮衔接核对已完成。不是本次运行结果。\n',
    'docs/iterations/099-draft/scope.md': '# 未来草案\n云同步，未批准开启本轮；本目录不是当前工作。\n',
    'src/bookmarks.mjs': 'export const titleLimit = 60;\n',
    '.notes/user.md': '用户原有笔记，不得删除或覆盖。\n',
  };
  let request = '地基已收尾。明确将B1本地JSON导入纳入下一轮，在docs/iterations/001-import准备范围和方案资料，保留待办原条目并关联去向。已确认仅处理id/title/url，重复id忽略，整批校验失败不改数据。只准备资料，不安排任务内容、不实施。';
  let allowed = [`${first}/scope.md`, `${first}/design.md`, `${first}/tasks.md`, `${first}/verification.md`, 'docs/project/backlog.md'];
  if (kind === 'plan-combined') {
    request = '地基已收尾，请把B1纳入docs/iterations/001-import，准备范围和方案，并编写这一轮的任务计划草案，不实施。已确认JSON顶层为数组，每项id/title/url是非空字符串，标题最多60字符；重复id与既有记录或本批前项相同时忽略，保留首次记录；任一项校验失败则整批不改数据。原目标和这些规则已确认，技术方案及任务草案整理后一并提交确认。';
  }
  const pendingFirst = ['pause-open', 'resume', 'awaiting', 'incident', 'overview', 'collision'].includes(kind);
  if (pendingFirst) {
    files['docs/workflow/state.yaml'] = 'current_iteration: 001-import\nstage: awaiting_acceptance\n';
    files[`${first}/scope.md`] = '# 导入范围\n用户于2026-11-10明确选择001-import为当前轮，B1导入范围已确认。\n';
    files[`${first}/design.md`] = '# 已确认方案\n沿用本地存储，批量校验后写入。\n';
    files[`${first}/tasks.md`] = '# 导入任务\nT1：实施、必要检查及独立审查已完成，已提交用户验收，用户尚未通过；规格尚未同步。\n用户笔记：验收时检查重复id。\n';
    files[`${first}/verification.md`] = '# 历史检查\n预置记录：必要检查和独立审查通过，待用户验收；不代表本次重跑。\n';
    files['docs/project/backlog.md'] = files['docs/project/backlog.md'].replace('尚未纳入迭代；原始反馈', '已获准纳入001-import，尚未验收；原始反馈');
  }
  if (kind === 'pause-open') {
    request = '明确暂停001-import，保留T1待验收事实，先切换到002-search。把B2按标题搜索纳入这一轮，范围只按标题子串匹配，大小写处理待定。在docs/iterations/002-search准备本轮资料并记录交接，不安排任务内容或实施。';
    allowed = [`${first}/tasks.md`, `${second}/scope.md`, `${second}/design.md`, `${second}/tasks.md`, `${second}/verification.md`, 'docs/project/backlog.md'];
  }
  if (kind === 'resume') {
    files[`${first}/tasks.md`] += '\n2026-11-11用户明确暂停001-import，转去准备002-search；T1仍待验收，恢复时先回到验收入口。\n';
    files[`${second}/scope.md`] = '# 搜索轮\n2026-11-11用户明确暂停001-import并选择002-search为当前轮，只准备搜索方案；暂停依据见../001-import/tasks.md。B2已获准入轮，设计未确认。\n';
    files[`${second}/design.md`] = '# 搜索草案\n按标题子串匹配，大小写待定。\n';
    files[`${second}/tasks.md`] = '# 搜索任务\n尚未编排，也未实施；当前仅设计整理。用户筆记：先确定匹配规则。\n';
    files[`${second}/verification.md`] = '';
    request = '只查询现在做到哪里、接下来是什么；不改文件，也不恢复或执行任何任务。';
    allowed = [];
  }
  if (kind === 'partial') {
    files[`${first}/scope.md`] = '# 导入范围\n2026-11-11用户已明确B1纳入001-import并授权准备资料，前轮000-foundation已收尾。已确认字段id/title/url、重复id忽略、整批校验失败不改数据；设计尚未确认，任务未安排。\n上次仅写入本scope，design/tasks/verification准备中断，不能称整轮资料已齐。\n用户笔记：保留这句话，后续会补导入样例。\n';
    request = '继续001-import上次已授权的文档准备，只补未完成部分，保留已有scope及用户笔记。B1范围沿原确认，补待办去向；不要重复创建另一轮，不安排任务内容或实施。';
  }
  if (kind === 'discussion') {
    request = '先讨论要不要做导入，不开新一轮，也不写任何资料。给我能确定的取舍和仍需澄清的内容。';
    allowed = [];
  }
  if (kind === 'awaiting') {
    request = '下一轮想做标题搜索，帮我整理接下来怎么安排。当前001-import的T1还没有验收，本次没有暂停或切换的决定。';
    allowed = [];
  }
  if (kind === 'incident') {
    request = '线上导入发生故障，我想另开一个独立修复轮，先说明这个请求应如何接续；本次不授权生产调查或任何环境操作。';
    allowed = [];
  }
  if (kind === 'overview' || kind === 'overview-empty') {
    if (kind === 'overview-empty') files['docs/project/overview.md'] = '';
    request = '已确认项目面向我和同事各自在本机整理公开链接，继续保持无账号、无云同步、无共享服务。现在只维护docs/project/overview.md，记录这些项目方向；不要把导入、搜索或共享写成已交付能力，不改其他文件。';
    allowed = ['docs/project/overview.md'];
  }
  if (kind === 'collision') {
    request = '我想在docs/iterations/001-import新建一轮标题搜索资料。请先核对目标，如果该路径已有其他成果则报告冲突，别覆盖、改名或自动切换。';
    allowed = [];
  }
  files['request.md'] = request + '\n';
  for (const [name, content] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { root, kind, request, allowed, before: snapshot(root) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(createIterationCase(process.argv[2])));
