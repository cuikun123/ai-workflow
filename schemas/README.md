# 数据结构定义

这里定义程序可读取的字段、类型和允许值，使用 JSON Schema 2020-12。

| 定义 | 内容 |
| --- | --- |
| [state v1](state-v1.schema.json) | 当前任务、进度、等待条件、检查点和内容版本 |
| [workflow-record v1](workflow-record-v1.schema.json) | 任务、确认、检查、审查和收尾记录 |
| [workflow-record v2](workflow-record-v2.schema.json) | 需求增量、场景覆盖、验证政策和规格同步收据 |
| [技能资源契约](../skills/_shared/manifest.json) | 能力映射、必要参考、规则归属及来源 |

`validate`检查状态结构；`status`、`check --documents`和`transition`进一步检查引用、内容摘要、版本冲突和允许的转换。规格同步收据由工具生成，完成任务时核对对应操作。

状态结构保持原版本；旧记录保留原验证门槛，不因新字段出现而自动迁移。验证政策与计划确认绑定，改变后须重新核对。

格式正确不证明批准、测试或审查真实，也不赋予操作权限。业务说明仍使用 Markdown。模板中的[state 文件](../templates/project/docs/workflow/state.yaml)是初始化依据，不是本仓库的运行状态。

字段与兼容规则见[规格契约](../docs/design/spec-format.md)和[接入设计](../docs/design/integration.md)。
