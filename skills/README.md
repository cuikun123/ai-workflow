# 技能索引

技能是 AI 按需读取的工作方法。当前技能版本 **0.3.3**，共十一项。

平时不用点名技能。你说明目标，AI 会判断现在处在哪一步，选用对应的方法。例如：

- “只查一下进度” → 工作流入口
- “先比较两个方案” → 方案讨论
- “修复这个已确认的问题” → 执行任务

## 什么时候需要点名

想限定 AI 的工作范围时，直接说出来，比如“只审查，不修改”“先诊断，暂不修复”。支持技能调用的工具里，也可以输入 `$workflow-guide` 这样的名称。

点名技能不等于批准实施、验收、Git 操作或部署。这些仍然按项目状态和你的授权进行。

## 全部技能

| 技能 | 什么时候用 | 产出 |
| --- | --- | --- |
| [workflow-guide](workflow-guide/SKILL.md) | 开始、继续、查进度、恢复 | 当前任务、在等什么、下一步 |
| [clarify-design](clarify-design/SKILL.md) | 需求还不清楚，或准备新一轮开发 | 范围、方案和本轮资料 |
| [discuss-design](discuss-design/SKILL.md) | 比较方案、权衡取舍 | 推荐方案、风险、待你决定的问题 |
| [build-foundation](build-foundation/SKILL.md) | 新项目搭地基 | 能运行的最小工程和实际检查结果 |
| [plan-tasks](plan-tasks/SKILL.md) | 把确认的范围拆成任务 | 任务、依赖、检查和验收方式 |
| [execute-task](execute-task/SKILL.md) | 实施已批准的任务 | 代码、检查、审查结果，验收后收尾 |
| [test-work](test-work/SKILL.md) | 需要测试或其他检查 | 实际检查结果和缺项 |
| [debug-issue](debug-issue/SKILL.md) | 出错了，要找原因 | 原因、修复和回归结果 |
| [review-work](review-work/SKILL.md) | 审查方案、计划或代码 | 必须修复项、建议、待核实项 |
| [release-work](release-work/SKILL.md) | 准备发布或执行已批准的部署 | 发布产物、步骤、上线或回退结果 |
| [handle-incident](handle-incident/SKILL.md) | 线上出了问题 | 影响范围、证据和修复方案 |

发布和线上处理的技能只是方法。你的环境里还需要有真实的部署工具和授权。

## 技能之间怎么配合

和你对话的那个 AI 叫“主 Agent”。它负责当前任务和所有正式记录，其他技能把结果交给它汇总。

每个任务都要依次经过：确认方案 → 实施 → AI 检查 → 你验收。普通功能会安排一次独立审查。交付后，任务停下来等你明确验收，然后才同步规格、开始下一个任务。

## 技能目录里有什么

| 文件 | 内容 |
| --- | --- |
| `SKILL.md` | 什么时候用，从哪里开始 |
| `references/` | 详细方法，需要时才读 |
| `NOTICE.md` | 来源和许可 |

单个技能文件夹不包含运行工具。完整工具要按[快速开始](../docs/quickstart.md)安装。完整的操作示例见[使用指南](../docs/usage.md)。
