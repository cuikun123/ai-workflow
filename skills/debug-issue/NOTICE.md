# 来源与许可

0.2.0补Git故障的实际位置/提交取证、冲突现场保护及原执行主责交接；本项无Git写入入口，Git操作由执行主Agent按适用方法和授权处理。无新增上游来源、依赖或脚本，以下历史排除项不否定本轮只读取证与交接。

本包 0.1.1 按 D62 对齐本框架的有效规格、本轮获准变更及验收交接；这些是本地流程适配，未新增上游来源、依赖或脚本。以下为 0.1.0 首次适配的来源记录，固定摘要和完整许可保持不变。

debug-issue 0.1.0 按 D59 将 Superpowers 的调试方法适配到 ai-workflow。固定来源 commit：22f0b463e7a5e579904dd6211a520321035526f7；核对日期：2026-11-09。

| 上游文件 | 原文 SHA-256 |
| --- | --- |
| [systematic-debugging/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/systematic-debugging/SKILL.md) | 51c6435d98c83c42c96ba7c35725a0b2c376cd487fb1a4e6bd0ddbe7e33ef202 |
| [root-cause-tracing.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/systematic-debugging/root-cause-tracing.md) | 75b933b6a8c40bdb2031b10f21654395b56ec6ab6bc7b018c18d3fe57aeb7fb8 |
| [condition-based-waiting.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/systematic-debugging/condition-based-waiting.md) | e89fec8400d6cd50f43407cec9fab50976ba4d55d0ec2eb51c0bd68036b54c26 |
| [defense-in-depth.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/systematic-debugging/defense-in-depth.md) | 1e175fb86fc357e58c6aebf5441e481e1b7868b4380c0456b63a17eefbd18ba7 |

保留：复现与正常路径比较、逐层追踪错误值来源、单一假设和最小实验、按完成条件等待、原因明确后检查必要边界、修复后验证。

改造：区分独立诊断、授权修复、执行流程内调用与线上故障；逐次核对实验副作用和授权；日志只采集必要可脱敏信息；核对运行目录、测试数量和退出结果；保留合法假值和实际时间语义；按问题证据选择校验位置，不强制每层重复校验。主 Agent 沿用 tasks.md、verification.md 和既有审查、用户验收规则；execute-task 负责阶段推进，review-work 可提供专项审查。

未引入：find-polluter.sh（会运行 npm test、隐藏输出并忽略失败，零测试或跳过仍可能报告 clean）、condition-based-waiting-example.ts（依赖 Lace 的 ThreadManager 与项目类型）及其依赖。两项已在同一固定快照完整静态阅读，未执行或验证；不保留为本包运行资源。原版 test-driven-development、verification-before-completion 的调用链不引入；没有原版脚本、固定重试预算或轮询参数、自动日志采集、Git 操作、安装器、状态写入器与额外报告体系。不采用“三次失败等于架构问题”“每层都加校验”或“找不到原因即增加重试”的默认规则，不将上游效果数字作为本项验证结果。

运行依赖：可读取项目、执行必要命令且在授权时可编辑的 Agent，以及实际项目的运行与验证环境；必要独立审查还需真实独立上下文工具。无固定 Node、Python、Bash、Lace 或服务依赖。其他 Skill 是按实际安装情况使用的协作能力，不是本项必须安装的上游依赖。

这是方法适配，不是独立运行器或权限沙箱。包检查、Agent 场景、客户端发现和真实业务验证分别报告；测试材料留在框架 tests/，不随本技能安装。

原文与改编部分保留 Superpowers 的 MIT 版权与许可；完整原文如下，分发本目录时一并保留。本说明不替整个框架选择许可证。

## 原始许可证

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

## D64 协调增强

0.1.2 在既有方法与许可范围内补充本框架的共同交接、单一主责、按风险选择检查及新增专项接续。未新增上游方法文件、运行依赖或调用链；新增专项是否实际可用须先核对完整说明，正文提及名称不等于已经调用。

## 0.3.0：U3结构与工具接入

本包将入口与条件方法分层，共同规则在源码_shared单一维护，由构建复制到包内references/common并校验摘要；新任务使用完整Iterlane的v2记录/规格工具。方法可独立携带，运行功能依赖完整固定安装，不包含独立调度器。以上来源和许可原文保留为历史，不因本轮重构新增外部执行权限；本段说明当前包版本与资源布局。


## 0.3.1修订

按D135接入任务轻重、条件读取与按能力交接，保留原方法职责和全部许可；验证政策采用实际命令/观察及明确审查方式，不照搬“稍有关联即强制调用”的触发。
