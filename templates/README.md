# 业务项目模板

`project/` 是初始化新业务项目的文档骨架，不预置真实需求、任务批准或测试结果。安装方法见[快速开始](../docs/quickstart.md)。

| 输入 | 如何使用 |
| --- | --- |
| [manifest.json](manifest.json) | 列出空文档、种子文件和目录占位 |
| [navigation.json](navigation.json) | 生成项目 AGENTS.md 导航，填入安装版本并保留原有区块外说明 |
| `project/docs/workflow/state.yaml` | 提供合法状态结构；初始化器生成实际时间和文件摘要 |

概览、待办、基础约定、规格索引和初始迭代文档可以为空，由后续实际工作填写。具体规格、后续迭代与发布记录在需要时创建；`releases/.gitkeep` 只保留空目录。

`project/AGENTS.md` 说明导航生成入口，不直接复制为项目导航。业务文档不属于后续资源修复可覆盖的文件；同版本重跑保留已有进度。

状态查询、转换和恢复由运行工具处理，示例状态不代表工作完成或用户批准。规格写法见[规格契约](../docs/design/spec-format.md)，工具边界见[接入设计](../docs/design/integration.md)。
