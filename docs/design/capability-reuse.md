# 成熟能力的吸收与适配

以本框架的流程和文档为主，吸收成熟开源方法后统一适配；不把多个上游流程直接串联。框架能力融合不替代具体业务需求下的开源调研。

## 方法来源查哪里

具体源码、固定版本、许可、裁剪和验证事实分别记在 `sources/`、各包 `NOTICE.md`、[技能索引](../../skills/README.md)和[验证记录](../../tests/README.md)；采用某方法的决策见[决策记录](../decisions.md)。候选、静态阅读、方法适配和运行验证是不同状态。

## 各技能吸收了哪些方法

| 技能 | 吸收的主要方法 |
| --- | --- |
| `clarify-design` | Superpowers 理解与方案比较，grilling 决策追问，Spec Kit 歧义检查，BMAD 体验与架构视角 |
| `plan-tasks` | Spec Kit 成果组织与覆盖检查，Superpowers 技术步骤细化 |
| `execute-task` | Superpowers 执行、协作、修复复查与证据判断，GSD 可观察验收与恢复 |
| `review-work` | Superpowers 审查发起、模板与反馈核验 |
| `debug-issue` | Superpowers 系统调试、根因追溯、条件等待与分层校验 |
| `test-work` | Superpowers 测试质量与回归验证方法 |
| `workflow-guide` | BMAD 入口导航、GSD 中断点核对、Superpowers 原生发现与按需阅读 |
| `build-foundation` | BMAD 架构边界、依赖与数据归属检查 |
| `release-work` | GSD 证据适用性、Superpowers 完成前验证 |
| `handle-incident` | Superpowers 证据调查、正常路径对照与最小实验 |
| `discuss-design` | BMAD 议题选视角、相互质疑及体验与架构分析 |

验收等待、部署权限、失败回滚和线上调查前置按本框架规则执行，不照搬上游（如不采用固定发现数、不把建议直接当需求、GSD ship 是 PR 流程而非部署器）。

## 引入与更新一个方法

1. 核对具体仓库、文件、固定版本及采用理由，许可证、署名与再分发要求。
2. 核对脚本、写入位置、副作用和权限。
3. 决定保留与裁剪范围、文档归属和验证方法。
4. 实际验证并记录未解决问题。
5. 先映射到既定结构，确有缺口再讨论调整；上游更新先评估适配和验证，再由用户主动升级，不自动覆盖。

整体 MIT 与 TY 署名及第三方许可随包保留；安装与升级机制见[接入设计](integration.md)。

## 技能包怎么组织维护

- 每个技能＝简短入口 `SKILL.md` + 按需读取的 `references`，正文精简、按需展开。
- 共享规则在 `_shared` 单一维护，构建时复制进各技能的 `references/common/` 并核对摘要，不各自维护副本。
- 能力映射写在共享 `manifest.json`：每个能力只有一个默认 provider，替换要在映射里显式改，不按名字猜。
- 规则可按环境前提、用户偏好、问责、补偿几类归属，并可在达到条件后退役；工具执行与 Agent 核对分开标注，不把文字边界当权限沙箱。

**未直接引入**上游的 CLI、hooks、安装器、固定角色、memlog、ledger、独立 UAT 或平行文档树。技能由 Agent 用真实工具执行，不自动变成进程、服务或权限沙箱；真实环境、部署、新依赖和重要变化仍按具体授权处理。
