# 文档导航

先按当前目的选择入口。框架自身的资料放在这里；安装后生成的需求、任务和状态属于你的业务项目。

## 使用框架

| 你的问题 | 阅读 |
| --- | --- |
| 如何安装，怎样确认客户端接入 | [快速开始](quickstart.md) |
| 安装以后怎么开发，何时确认与验收 | [使用指南](usage.md) |
| 想先运行一个应用 | [本地收藏示例](../examples/bookmarks/README.md) |
| 想指定某项技能 | [能力索引](../skills/README.md) |
| 想查命令、参数和输出 | [工具参考](../scripts/README.md) |
| 安装包是什么版本，哪些情况还不支持 | [发布说明](releasing.md) |
| 怎样报告安全问题 | [安全反馈](../SECURITY.md) |

第一次使用建议按“快速开始 → 使用指南”阅读。遇到等待、失败或中断，先看[使用指南的处理方法](usage.md#遇到问题怎样处理)。

## 维护框架

先读[贡献说明](../CONTRIBUTING.md)、[仓库协作规则](../AGENTS.md)和[当前交接](handoff.md)。

| 要核对什么 | 阅读 |
| --- | --- |
| 已确认原则、授权及待定事项 | [正式决定](decisions.md) |
| 项目各部分里面有什么、给谁用、何时和怎样用 | [项目结构导览](project-tour.md) |
| 实际检查、限制和证据位置 | [验证记录](../tests/README.md) |
| 主要实际变化 | [变更记录](../CHANGELOG.md) |
| 当前范围和后续方向 | [交接](handoff.md) · [路线](roadmap.md) |
| 模板、结构与上游来源 | [业务模板](../templates/README.md) · [数据结构](../schemas/README.md) · [来源记录](../sources/README.md) |

## 查阅正式设计

这些文档解释规则和技术契约，适用于维护者、适配者，以及需要核对依据的 AI。日常使用先读使用指南。

| 设计主题 | 阅读 |
| --- | --- |
| 目标与适用范围 | [愿景](design/vision.md) |
| 开发顺序、确认、检查和验收 | [开发流程](design/workflow.md) |
| 文件职责、状态和写入 | [文档管理](design/documents.md) |
| 需求、场景、增量和规格同步 | [规格契约](design/spec-format.md) |
| Git 保存、PR、合入和清理 | [Git 工作流](design/git-workflow.md) |
| 安装、诊断、恢复和版本操作 | [接入设计](design/integration.md) |
| 多客户端、最新地基与用户包（实施中） | [接入草案](design/integration.md#多客户端与用户包设计草案) · [地基绑定草案](design/documents.md#地基上下文与任务绑定草案) · [任务计划](roadmap.md#多客户端地基约束与用户包计划) |
| 分工、交接与独立审查 | [多 Agent 协作](design/multi-agent.md) |
| 技能组织、方法适配和来源 | [能力设计](design/capability-reuse.md) |

AI 执行业务项目任务时，先遵循该项目的 AGENTS.md 和已安装的技能方法；本仓库的设计、模板与示例不构成真实业务需求或操作授权。
