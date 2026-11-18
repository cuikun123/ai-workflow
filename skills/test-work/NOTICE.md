# 来源与许可

0.2.0补最终候选提交与真实产品效果的证据定位、主线/内容变化后受影响检查和线上补丁目标版本。测试不替代独立审查、验收或Git收尾，无新增上游来源、脚本或固定依赖。

本包 0.1.1 按 D62 对齐本框架的有效规格、本轮获准变更及验收交接；这些是本地流程适配，未新增上游来源、依赖或脚本。以下为 0.1.0 首次适配的来源记录，固定摘要和完整许可保持不变。

test-work 0.1.0 按 D60 适配 Superpowers 测试质量及部分TDD方法。固定来源 commit：22f0b463e7a5e579904dd6211a520321035526f7；核对日期：2026-11-09。

| 上游文件 | 原文 SHA-256 |
| --- | --- |
| [test-driven-development/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/test-driven-development/SKILL.md) | 64b03fce4aee5a97a93160cea8111f3ba13a17b7c001db4bd5836d67fd10705d |
| [writing-good-tests.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/test-driven-development/writing-good-tests.md) | 51471c853306ff92ca8bb41dcaea05f31c0e46b03651f8f3c99754b7172f4ae1 |

保留：从独立预期检查真实行为、说明用例能发现什么错误、合理设置替身、保留必要副作用、缺陷回归先复现、修复后重验，以及检查断言是否真正有效。

改造：以测试质量方法为主；单元、接口、集成、端到端的选择、环境与工具核对、读写范围、失败接续和结果记录由本框架按D34–D37组织。项目开发顺序与测试约定优先，不要求所有工作套用统一TDD。既有正确行为补测可以直接通过，不为红灯删除实现；控制变量或错误变体仅在授权隔离条件下使用。部分原版“只测真实对象”的绝对措辞适配为明确实际依赖与替身边界，不把替身结果冒充真实集成。

未引入：上游其他Skill调用链、自动提交、删除已写业务代码后重做、强制每次全项目修复、额外测试策略或报告文档。两份方法正文及根LICENSE已完整读取；其中对writing-skills等其他资源的引用不保留为运行依赖，未宣称完整审计或安装这些调用链。

运行依赖为实际可用的Agent文件/命令工具、项目测试框架及其必要环境。没有固定的Node、Python、SQLite、浏览器或外部服务依赖；框架tests/work-testing/的本地HTTP、SQLite、Chromium及CDP辅助仅是本轮验证材料，不随技能安装，不构成通用测试运行器。execute-task、debug-issue、review-work按实际安装和授权协作，不是必须安装的原版上游依赖。

方法适配不保证全部技术栈、客户端或测试类型已验证；包检查、Agent行为、实际工具环境和真实业务效果分别记录。主说明与本NOTICE共同分发，保留下列完整MIT版权和许可。本说明不为ai-workflow整体选择许可证。

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

## 0.3.2

Updated shared references for artifact inspection and explicit read-only client diagnostics; original licenses preserved.


## 0.3.3

按D146同步每任务地基上下文、专用绑定与operation v3方法；业务record v1/v2及原许可保留，客户端自动事件接入不随本项提供。
