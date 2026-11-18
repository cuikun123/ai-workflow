# Iterlane 技能

技能是 AI 按需要读取的工作方法。通常直接在业务项目里说明目标，AI 会定位当前工作并选择所需方法；你不必按顺序调用十一项技能。

例如，“只查询进度”由工作流入口处理；“先比较两个方案”使用设计讨论方法；“修复这个已确认的问题”进入当前任务的实施和检查。指定技能也不会自动批准实施、验收、Git 或部署操作。

## 什么时候显式指定技能

需要明确限制工作范围时，可以说“只审查，不修改”“先诊断，暂不修复”。支持技能调用的客户端也可使用 `$workflow-guide` 等名称。自然语言和显式调用都要遵循项目的真实状态与授权。

| 技能 | 什么时候用 | 主要结果 |
| --- | --- | --- |
| [workflow-guide](workflow-guide/SKILL.md) | 开始、继续、查进度或恢复工作 | 定位当前任务、等待条件与下一步 |
| [clarify-design](clarify-design/SKILL.md) | 需求还不清楚，或准备一轮开发 | 范围、方案、必要迭代资料 |
| [discuss-design](discuss-design/SKILL.md) | 比较方案，核对关键取舍 | 有依据的推荐、风险和待决定问题 |
| [build-foundation](build-foundation/SKILL.md) | 新项目需要最小工程与共同约定 | 可运行工程及实际检查结果 |
| [plan-tasks](plan-tasks/SKILL.md) | 将获准范围安排成可交付成果 | 任务、依赖、检查及验收方式 |
| [execute-task](execute-task/SKILL.md) | 实施当前已获准任务 | 代码、检查、审查和待验收成果；验收后适用收尾 |
| [test-work](test-work/SKILL.md) | 需要测试或其他必要检查 | 实际检查结果、证据和缺项 |
| [debug-issue](debug-issue/SKILL.md) | 出现错误，需要查明原因 | 原因依据、授权内的修复和回归结果 |
| [review-work](review-work/SKILL.md) | 核对方案、计划或实际代码 | 必须修复、建议、待核实项和覆盖范围 |
| [release-work](release-work/SKILL.md) | 准备发布或执行已获准部署 | 产物、步骤、实际上线或回退结果 |
| [handle-incident](handle-incident/SKILL.md) | 线上问题需要调查与安排修复 | 影响、证据、方案和恢复原任务的条件 |

发布与线上处理的方法不表示你的环境已经接入部署工具。缺少技能、参考、宿主工具或独立审查能力时，AI 应明确报告，不能假称已调用或通过。

## 任务、检查和验收怎样衔接

主 Agent 是与你交流并统筹工作的 AI，负责当前任务和正式记录。专项方法返回实际结果，由主 Agent 汇总。

确认方案、授权实施、AI 检查和用户验收分别判断。普通功能保留适用的独立审查；明确的小改动按影响选择必要核对。提交成果后，当前任务等待你明确验收，之后才能核对规格更新和后续工作。

完整操作示例见[使用指南](../docs/usage.md)，安装见[快速开始](../docs/quickstart.md)。

当前技能为0.3.3，共享方法统一说明每任务context绑定与operation v3；业务记录版本仍为v1/v2。完整运行包才提供工具，自动客户端接入不由技能文件保证。

`SKILL.md` 保存使用条件和入口，`references/` 保存详细方法；各项技能的来源和完整许可在 `NOTICE.md` 中。单项技能不包含整个 Iterlane 工具，安装方式见[快速开始](../docs/quickstart.md)。
