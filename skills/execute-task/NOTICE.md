# 来源与许可

0.2.0按本框架已确认的Git规则接入任务起步、精选WIP与远端备份、提交版本验证、PR验收及验收后Squash/worktree收尾。由主Agent使用宿主已有Git命令工具与项目平台工具/API；缺工具、目标或权限如实受阻，不默认安装gh或上游工具。本轮为本地流程适配，无新增上游来源或脚本，固定摘要和完整许可不变。以下0.1.x来源与排除项保留历史含义，不作为0.2.0排除本地Git方法的说明。

0.1.3补充普通开轮与暂停/恢复记录的交接，保留原验收事实，并按明确确认核对当前迭代。本项不自行创建迭代或写通用state，原任务和验收仍由主Agent管理。来源、许可和运行依赖不变；下列0.1.2及以前记录保留历史版本含义。

本包 0.1.1 按 D62 对齐本框架的有效规格、本轮获准变更及验收收尾；这些是本地流程适配，未新增上游来源、依赖或脚本。以下为 0.1.0 首次适配的来源记录，固定摘要和完整许可保持不变。

execute-task 0.1.0 按 D56 将下列 Superpowers 方法融合为中文任务执行与协作 Skill。统一固定来源 commit：22f0b463e7a5e579904dd6211a520321035526f7，核对日期 2026-11-09。

| 上游文件 | 原文 SHA-256 |
| --- | --- |
| [executing-plans](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/executing-plans/SKILL.md) | deaf176fa179827e80f2ea3101db3ea90fdf562ebef340eba761e4687940f5f5 |
| [subagent-driven-development](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/SKILL.md) | 1baf70e307bde682c462513c86116333f1f066168c6710f45145bf5f0b00828d |
| [实施者模板](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/implementer-prompt.md) | 81dd9d5a3fb0b09b96b5829f03b9796842f3199ef7591d1ba1c2db2a515f64d0 |
| [任务审查模板](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/task-reviewer-prompt.md) | 61a04c2fb29907887d8babee1594f5e35ae26d461e7e584f5b7c283215165e08 |
| [修复循环](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/references/fix-loop.md) | 1938ce707915efc44021e563ebc29666329e20ad861b6c50b89f305b8f4e8d8b |
| [完成前验证](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/verification-before-completion/SKILL.md) | 2befe7fc55bcadaa3d97dd9e8efeb633d2561c0ebe74c5a8b17c4d9e7e4520b3 |

保留：执行前核对、按实际结果推进、明确任务交接、按原始依据审查、覆盖测试后复查，以及完成声明与证据对应。

改造：按本框架计划确认和当前任务验收控制推进；开发按需委派、主 Agent 可自己实施与修复；任务进度和验证依据沿用 tasks.md、verification.md；保持原始资料、用户修改和历史验收；按实际影响选择检查；审查可补读必要原文件；必须修复问题按证据关闭，不能因修复到限自动完成。

未引入：上游 sdd-workspace、sdd-repo、task-brief、task-start、task-done、review-package 脚本，独立 ledger/brief/report/diff 文件体系，原版 resuming、handling-reports、cannot-verify、batching、re-review、final-review 等后续资源，自动提交、工作区清理、固定模型路由与五轮后保留问题继续的规则。这些引用链均未被保留为运行依赖，未宣称已全面审计；本目录不运行上游脚本或串行调用原版 Skill。

不引入全局安装器、Git 策略或通用状态写入器。运行依赖为具有真实文件读写与命令工具的 Agent、已有项目资料、必要的项目测试环境；普通功能的完整独立审查另需宿主提供独立上下文的审查工具。工具缺失或环境受阻时报告实际缺口，不用角色扮演冒充。没有 Node、Python、外部服务或其他 Skill 的固定运行依赖；项目自身的运行和测试依赖需单独核对。

上游原文及改编部分保留 Superpowers 的 MIT 版权与许可；完整原文统一收录于下文，随本目录分发时保留。本说明不为 ai-workflow 整体仓库选定许可证。

本能力提供行为方法与协作约束，不是独立调度器或工具权限沙箱。包检查、Agent 场景、客户端接入和真实业务验证必须分别报告。

## 原始许可证

### Superpowers

```text
MIT License

Copyright (c) 2025 Jesse Vincent

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 0.1.2 D64 验收引导补充：GSD Core

0.1.2新增下列GSD方法来源，并补充本框架共同交接、可观察验收和恢复核对。D65的A轮仅明确该历史补充对应的包版本，未修改当时0.1.2行为、固定摘要或许可。

固定来源：[gsd-core/workflows/verify-work.md](https://github.com/open-gsd/gsd-core/blob/fa03ab369b34c4b5f734f48d4985d091f21795ad/gsd-core/workflows/verify-work.md)；原始字节 SHA-256：c979c67666355752c7a594ecdc2652a12dbd7f31fe973253c4d03c37ca49aefc。
仅采用 extract_tests 中从成果提取可观察 name/expected 的方法，及 resume_from_file 的检查点恢复思想。已核对所选主说明相关段落；未采用其全部关联 detail/hooks/工具调用链。改为既有 tasks/verification、明确用户验收和内容适用性核对。不采用独立 UAT/.planning、空回复/next 自动通过、自动检查等同用户验收、自动诊断规划、状态归档、清理服务或自动外部操作。无新增运行依赖。

```text
MIT License

Copyright (c) 2026 Open GSD

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

本地dev.4适配：状态/文档工具和公共引用接入；许可、固定上游及原方法边界保持。

当前版本 0.3.3：每任务地基上下文、专用绑定与 operation v3 方法；业务 record v1/v2 及原许可保留。
