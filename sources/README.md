# 来源与适配记录

[catalog.yaml](catalog.yaml) 保存来源、采用范围及核对状态。[plan-tasks](../skills/plan-tasks/SKILL.md) 适配了 Superpowers writing-plans、Spec Kit tasks 和 analyze；[execute-task](../skills/execute-task/SKILL.md) 适配 Superpowers 执行、协作与完成前证据核对方法；[review-work](../skills/review-work/SKILL.md) 适配 Superpowers 审查与反馈核验方法。具体原文摘要、改造和排除项、运行依赖与许可分别见 [计划来源](../skills/plan-tasks/NOTICE.md)、[执行来源](../skills/execute-task/NOTICE.md) 和 [审查来源](../skills/review-work/NOTICE.md)。这不表示整个上游项目或其他候选能力已集成。

D64 五项新增及原六项协调增强的来源见 [技能索引](../skills/README.md) 与各 NOTICE。BMAD 提供选定导航、架构/体验和讨论方法；GSD Core 提供选定恢复、可观察验收和证据适用性方法；Superpowers 提供已核对的执行、检查和调查方法。部署回退与线上前置来自本框架 D42/D44，不冒称上游部署器。全部是方法级适配，未整包引入运行时。

引入任何能力前，应记录：

- 仓库与具体文件、固定上游版本或 commit。
- 许可证、署名和再分发要求的核对结果。
- 使用方式：直接复用、适配复用、自行设计。
- 输入输出、依赖、关联脚本、副作用和文档写入位置。
- 改动与原因、确认或状态机制的调整。
- 验证场景、执行结果和未解决问题。

OpenSpec 的本地参考 commit 只表示查看的参考版本，不是已经采用或适配的版本。未知许可或版本使用空值，不能推测填入。

上游有变化时显式评估和验证，不自动覆盖已适配内容。
