# Iterlane（迭序）

面向个人开发者、兼顾工作场景的 AI 开发框架。首版聚焦 **Codex 与从零建立的 Web 项目**，核心流程不绑定技术栈。

## 从这里开始

| 想了解 | 阅读 |
| --- | --- |
| 项目怎样推进、何时参与 | [开发流程](docs/design/workflow.md) |
| 当前做到了哪里 | [交接](docs/handoff.md) · [验证状态](tests/README.md) |
| 有哪些能力、如何分工 | [Skills 索引](skills/README.md) |
| 具体约定和后续方向 | [设计索引](docs/README.md) · [决定](docs/decisions.md) · [路线](docs/roadmap.md) |

## 当前能提供什么

- 十一项 Skill，workflow-guide为0.2.1，其余为0.2.0；覆盖设计、地基、计划执行、检查、发布与维护，并接入已确认的 Git 方法。
- 已完成包检查及部分隔离行为验证，**整套框架端到端项目验证尚未完成**。
- 0.3.0-dev.3内部候选提供check/validate及第2步init、同版本显式repair、未完成初始化的resume/有限undo；新增Git行尾保护，实际验证状态见交接。
- 安装会接入完整Skills、公共资源、导航与有效起始state，保留已有说明、其他Skills和业务进度；检查及验收状态见交接。
- 第3步沿原生AGENTS/Skills机制接入Codex CLI，补按需加载指导和真实客户端评测；各项通过状态见验证记录。通用状态转换/恢复、升级迁移仍未完成。

## 运行内部工具

环境：Windows x64、Node 24.18.0、npm 11.16.0；其他环境尚未验收。仓库根执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
node bin/iterlane.mjs check --json
node bin/iterlane.mjs validate --state <文件路径> --json
```

第2步初始化只能用于明确的新项目，目标目录须已存在。替换下例项目路径，先查看计划，再执行安装：

```powershell
$projectDir = 'D:\Projects\new-project'
node bin/iterlane.mjs init --project $projectDir --preview --json
node bin/iterlane.mjs init --project $projectDir --json
node bin/iterlane.mjs check --project $projectDir --json
```

进入目标项目后，可运行`node .ai-workflow/bin/iterlane.mjs check --json`。该入口按自身位置找到项目，不要求源码仓库或node_modules；安装版不能作为初始化源。项目中的`docs/`和state属于业务资料，资源修复不覆盖它们。

初始化会在`.gitattributes`追加管理区块，保留框架资源、入口、state及初始化摘要依据的原字节；其他代码与外来Skills沿原Git文本规则处理。区块外内容保留，特殊过滤器或更高优先级属性需单独核对。旧dev.2项目不会自动升级，使用其匹配版本进行检查和有限恢复。

同版本完整重跑返回unchanged；缺失框架资源先报告，显式`init --project <dir> --repair`才补齐。已有资源改变或版本不同会停止。中断后显式`--resume`继续，或`--undo`只还原该未完成操作；用户修改保留，归属不明停止。有效日志形成前中断不能自动恢复；这与通用业务状态恢复是不同能力。

`npm run ci`运行全部必测检查、构建`dist/`并在`.artifacts/`保存测试事件、摘要及真实npm包。构建包在脱离源码、无node_modules的目录可直接执行`node bin/iterlane.mjs check --json`，以及同样的`validate`命令。首次构建需安装锁定依赖；分发包检查和状态校验无需联网。

`validate`只检查YAML与状态结构，不核验引用文件、确认真伪或用户验收，不更新状态。项目check补充进度引用文件最低存在性，但不检查记录ID、摘要新鲜度或批准真伪。state模板是结构示例，实际初始化生成时间和basis。包名和命令为`iterlane`，整体采用MIT、版权署名TY；当前版本`0.3.0-dev.2`仍为`private`内部包，不可发布。

`npm run ci`只执行确定性检查，不自动触发真实模型评测。第3步运行器、离线重评及其Windows/Codex CLI/现有custom代理限制见[客户端验证](tests/README.md#第3步客户端接入与第23步联合校验)。

## 如何使用现有方法

1. 指定项目和请求，让 Agent 读取对应 Skill 的完整说明。
2. 主 Agent 统筹记录、审查和逐任务验收，专项返回结果。
3. 项目级接入保留完整技能目录，目标已有内容先核对，不覆盖；布局与限制见[接入设计](docs/design/integration.md)。

源码存在或测试通过不代表用户验收。`myflow init` 等仍是示意命令，Java、React、MySQL 只是首个验证方向。

## 仓库导航

| 目录 | 用途 |
| --- | --- |
| `docs/` | 框架自身的设计、决定、路线与交接 |
| `skills/` | 方法包及完整来源许可 |
| `templates/` | [业务文档骨架](templates/README.md)，不是真实业务需求 |
| `tests/` | 检查、隔离场景、生成器与证据定位 |
| `sources/` | 来源、采用范围与候选 |
| `adapters/codex/`、`profiles/` | 接入参考与可选技术偏好 |
| `bin/`、`src/`、`scripts/` | CLI、校验实现、构建与CI等确定性工具 |
| `schemas/` | state v1正式结构；状态转换仍待后续实施 |
| `examples/` | 示例职责预留，尚无可复现示例工程 |

整体许可见[MIT LICENSE](LICENSE)，采用方法的固定版本及完整许可保留在各包 `NOTICE.md`，依赖许可随分发包保留。
