# 业务项目模板

本目录保存新业务项目的资料骨架。安装器把它用于你的项目，后续由 AI 随真实工作填写；模板不包含已批准的需求、完成的任务或测试结果。

日常使用无需手工复制模板。先按[快速开始](../docs/quickstart.md)安装，再按[使用指南](../docs/usage.md)提出项目目标。

## 安装后会有哪些资料

| 位置 | 保存什么 | 何时填写 |
| --- | --- | --- |
| `docs/project/overview.md` | 项目方向、目标用户和范围 | 方向确认后 |
| `docs/project/backlog.md` | 后续想法与候选工作 | 有待安排的想法时 |
| `docs/project/foundation/` | 工程、体验、安全、质量和运行约定 | 建立地基及后续调整时 |
| `docs/project/specs/` | 当前有效业务行为 | 对应成果验收并满足同步条件后 |
| `docs/iterations/000-foundation/` | 地基范围、设计、任务和检查依据 | 起步工作推进时 |
| `docs/workflow/state.yaml` | 当前工作位置的书签 | 由受校验工具维护 |

普通 Markdown 文件可以为空；它们的存在不表示工作完成。具体规格、后续迭代和发布记录按实际需要创建。示例应用单独放在 `examples/`，不会成为默认项目需求。

业务资料由项目自己维护。资源修复不会覆盖它们，同版本重跑也不应抹掉已有进度。

## 维护者需要知道的输入

| 文件 | 安装器怎样使用 |
| --- | --- |
| [manifest.json](manifest.json) | 列出空文档、种子文件和目录占位 |
| [navigation.json](navigation.json) | 生成项目 AGENTS.md 的框架导航，填入安装版本，保留原区块外说明 |
| `project/docs/workflow/state.yaml` | 提供合法初始结构，安装器填入实际时间和文件摘要 |
| `project/AGENTS.md` | 提供项目协作说明；实际导航由navigation.json生成 |

`releases/.gitkeep` 只保留空目录。模板状态是初始化依据，不是框架仓库的运行状态。

文件职责见[文档管理](../docs/design/documents.md)，格式见[规格契约](../docs/design/spec-format.md)，安装与恢复边界见[接入设计](../docs/design/integration.md)。
