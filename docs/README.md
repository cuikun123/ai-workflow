# 文档导航

## 使用框架

| 你想知道 | 读这里 |
| --- | --- |
| 怎么安装到新项目、怎么确认装好（装好即结束） | [快速开始](quickstart.md) |
| 装好以后怎么开发、确认和验收（长期阅读） | [使用指南](usage.md) |
| 示例项目有哪些、怎么运行 | [示例总览](../examples/README.md) |
| 先看一个做好的应用 | [收藏示例](../examples/bookmarks/README.md) |
| 用哪个 AI 客户端、怎么接入 | [客户端接入](../adapters/codex/README.md) |
| 有哪些技能，什么时候用 | [技能索引](../skills/README.md) |
| 命令、参数和输出 | [命令参考](../scripts/README.md) |
| 当前版本支持什么、不支持什么 | [版本与支持范围](releasing.md) |
| 怎么报告安全问题 | [安全反馈](../SECURITY.md) |

第一次使用，按“快速开始 → 使用指南”的顺序读。遇到问题先看[使用指南：遇到问题怎样处理](usage.md#遇到问题怎样处理)。

## 维护框架

维护本框架先读三份：[贡献说明](../CONTRIBUTING.md)（人类贡献者怎么装环境、跑检查、构建）、[仓库协作规则](../AGENTS.md)（在本仓库工作的 AI 遵循的协作规则）、[当前交接](handoff.md)（现在做什么、下一步）。

| 你想知道 | 读这里 |
| --- | --- |
| 现在在做什么、下一步是什么 | [交接](handoff.md) |
| 已经定下的规则 | [正式决定](decisions.md) |
| 以后的计划 | [路线](roadmap.md) |
| 各个目录里有什么、给谁用 | [项目结构导览](project-tour.md) |
| 测试怎么跑、验证过什么 | [验证记录](../tests/README.md) |
| 每个版本改了什么 | [变更记录](../CHANGELOG.md) |
| 模板、数据格式、上游来源 | [业务模板](../templates/README.md) · [数据结构](../schemas/README.md) · [来源记录](../sources/README.md) |

## 正式设计

这些文档解释规则和技术细节，给维护者和需要核对依据的 AI 读。日常使用不需要读。

| 主题 | 读这里 |
| --- | --- |
| 目标与适用范围 | [愿景](design/vision.md) |
| 开发顺序、确认、检查和验收 | [开发流程](design/workflow.md) |
| 项目文件的结构与职责 | [文档管理](design/documents.md) |
| 状态书签、记录与写入契约 | [状态、记录与写入契约](design/state-contract.md) |
| 需求、场景和规格同步 | [规格契约](design/spec-format.md) |
| Git 保存、PR、合入和清理 | [Git 工作流](design/git-workflow.md) |
| 安装、诊断、恢复和版本 | [接入设计](design/integration.md) |
| 多 Agent 分工和独立审查 | [多 Agent 协作](design/multi-agent.md) |
| 技能怎么组织、怎么复用上游 | [能力设计](design/capability-reuse.md) |

AI 在业务项目里工作时，以该项目的 `AGENTS.md` 和已安装的技能为准。本仓库的设计、模板和示例都不是真实的业务需求。
