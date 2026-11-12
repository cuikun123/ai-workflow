import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot, changes } from '../task-planning/fixtures.mjs';
export { snapshot, changes };

// Fictional inputs; no business data or real service is used.
export function createFixture(kind = 'ready') {
  if (!['ready', 'feedback', 'conflict', 'research', 'navigation', 'foundation-handoff'].includes(kind)) throw new Error('Unknown fixture');
  const root = mkdtempSync(join(tmpdir(), `ai-workflow-clarify-${kind}-`));
  const current = kind === 'foundation-handoff' ? 'docs/iterations/000-foundation' : 'docs/iterations/002-export';
  const files = {
    'AGENTS.md': '# 项目协作\n使用中文。先读导航及项目资料。当前有效规格在 docs/project/specs，变更和方案在本轮 scope.md、design.md，任务与验证在 tasks.md、verification.md。有效规格在验收后更新；保留历史。阶段内普通细节自主处理，关键业务和设计变化由用户确认。不要安装依赖或操作 Git；测试中不允许委派。\n',
    'docs/workflow/state.yaml': 'current_iteration: 002-export\nstage: design\nnext_task: null\n',
    'docs/project/overview.md': '# 个人阅读收藏夹\n仅本人在本地使用，整理公开网页链接。已有新增、列表、标签筛选功能。本轮考虑导出，不增加账号、共享或服务器。\n',
    'docs/project/backlog.md': '# 待考虑事项\nB1：以后可能需要导入，未批准。\n',
    'docs/project/foundation/engineering.md': '# 工程\n浏览器原生 ES modules，localStorage 保存条目，Node 内置测试。继续沿用现有结构；不引入服务或付费能力。\n',
    'docs/project/foundation/experience.md': '# 体验\n保留当前页面结构；错误显示可理解的原因。\n',
    'docs/project/foundation/quality.md': '# 质量\n按实际影响选择检查，普通功能任务有独立审查，用户逐成果验收。检查通过不等于用户验收。\n',
    'docs/project/foundation/security.md': '# 数据\n导出不应包含任何登录或浏览器配置数据。\n',
    'docs/project/foundation/operations.md': '',
    'docs/project/specs/bookmarks.md': '# 当前有效行为\nR1：收藏条目有 id、title、url、tag，标题最多 60 个字符。\nR2：列表按当前标签筛选。尚无导出功能。\n',
    [`${current}/scope.md`]: '# 本轮范围\n尚未整理。T0 的旧验收不代表本轮新功能已批准实施。\n',
    [`${current}/design.md`]: '',
    [`${current}/tasks.md`]: '# 本轮任务\n## T0 核对现有存储字段\n实施：完成；AI 检查：通过；用户验收：2026-11-08 明确通过。\n本轮导出任务尚未安排。\n',
    [`${current}/verification.md`]: '# 历史证据\n2026-11-08 T0 核对存储字段，用户明确验收通过。不是导出功能的运行证据。\n',
    'src/store.mjs': 'export function readAll(storage) { return JSON.parse(storage.getItem("bookmarks") || "[]"); }\n',
    'src/filter.mjs': 'export function visible(items, tag) { return tag ? items.filter(item => item.tag === tag) : items; }\n',
    '.notes/keep.md': '已有个人笔记，保留。\n',
  };
  let request = '按下面已经讨论清楚的内容，把当前这轮范围和方案整理好，接着把任务也安排出来。不要重复问已有决定，先不写业务代码。';
  files['discussion.md'] = '# 已有讨论\n用户已明确：导出当前筛选结果为 UTF-8 JSON，字段仅 id/title/url/tag；文件名固定 bookmarks.json。空结果时不下载并提示“当前没有可导出的条目”；下载失败时保留数据并提示重试。沿用现有技术，不加依赖、不研究替代框架。需要完整可验收的导出成果。范围和方向已确认，具体设计与任务整理后一起提交确认，尚未批准实施。\n';
  if (kind === 'feedback') {
    request = '筛选这块用起来有点麻烦，先帮我弄清楚原因和想改什么，暂时别做方案或开发。';
    files['discussion.md'] = '# 已知反馈\n用户说经常在“工作”和“待读”标签之间切换。使用个人桌面浏览器，无账号或共享需求。尚未说明具体哪一步麻烦。\n';
  }
  if (kind === 'conflict') {
    request = '先检查当前导出方案有没有关键问题，能明确的继续整理，别直接开发。';
    files['discussion.md'] = '# 已确认范围\n用户在本轮讨论明确要求“导出当前筛选结果”，其他要求参照项目现有约定，未知细节不能擅定为用户要求。\n';
    files[`${current}/design.md`] = '# 技术草稿，未获确认\n为了省实现步骤，直接导出全部条目。JSON 或 CSV 尚未选定。\n';
  }
  if (kind === 'research') {
    request = '我希望这个收藏夹以后能在两台电脑间同步。先调查可复用的开源方案，比较做法给建议，暂不开发。优先本地控制数据，我没有指定语言和同步服务。';
    files['discussion.md'] = '# 反馈\n跨设备同步是新候选需求，尚未纳入当前导出迭代。不知道要不要自行部署服务器。\n';
  }
  if (kind === 'navigation') {
    request = '帮我把这次想做的导出需求整理成方案。';
    files['discussion.md'] = '# 想法\n想导出收藏数据，还没选本轮。\n';
    files['docs/workflow/state.yaml'] = 'current_iteration: null\nstage: design\n';
    files['docs/iterations/003-sync/scope.md'] = '# 另一个候选\n跨设备同步，未确定推进。\n';
  }
  if (kind === 'foundation-handoff') {
    request = '本地收藏夹的目标和技术方向已明确，请只在对话给出地基方案和后续工程交接要点。不要写文件、安排任务文件或实施，不用重做技术调研。';
    files['docs/workflow/state.yaml'] = 'current_iteration: 000-foundation\nstage: design\n';
    files['docs/project/overview.md'] = '# 已确认方向\n本地个人收藏夹，无账号、云服务或真实用户数据；工程尚未建立。\n';
    files['docs/project/specs/bookmarks.md'] = '# 当前有效规格\n尚无业务实现。\n';
    files['docs/project/foundation/engineering.md'] = '# 已确认技术方向\n仅Node内置HTTP与JSON文件存储，不加第三方依赖或数据库服务；工程和检查尚未建立。\n';
    files['discussion.md'] = '# 已确认目标与限制\n地基拟建立本地HTTP健康检查、收藏条目写入和读取，存储关闭重启后保留；只绑定回环地址，测试使用虚构数据。现在仅需要方案和交接说明，尚未授权工程实施。\n';
    files[`${current}/scope.md`] = '# 地基范围草案\n已有目标见discussion.md；具体方案、任务和验收安排待准备确认。\n';
    files[`${current}/tasks.md`] = '';
    files[`${current}/verification.md`] = '';
    delete files['src/store.mjs'];
    delete files['src/filter.mjs'];
  }
  for (const [name, content] of Object.entries(files)) {
    const target = join(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return { root, kind, current, request, before: snapshot(root) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(createFixture(process.argv[2] || 'ready')));
