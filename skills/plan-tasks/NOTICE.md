# 来源与许可

0.1.3补充明确开轮请求的资料交接和暂停/恢复依据核对；本项仍只编排已有目标迭代的计划，不自行开轮或写overview。属于本地协调规则更新，无新增上游来源、依赖或许可变化。

本包 0.1.1 按 D62 对齐本框架的有效规格、本轮获准变更及验收收尾计划；这些是本地流程适配，未新增上游来源、依赖或脚本。以下为 0.1.0 首次适配的来源记录，固定摘要和完整许可保持不变。

本目录是 ai-workflow 任务计划 Skill 的 0.1.0 适配版本，依据 D55 融合下列三份上游说明的方法。改写为中文，统一输入、输出和接续；不是三个原版 Skill 的串行调用。日期：2026-11-09。

| 来源文件 | 固定 commit | 原文 SHA-256 |
| --- | --- | --- |
| [Superpowers writing-plans](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/writing-plans/SKILL.md) | 22f0b463e7a5e579904dd6211a520321035526f7 | a6c67c1900064347c2a329990dd3c555657c51c3ec53b259a08aa01a2c26139a |
| [Spec Kit tasks](https://github.com/github/spec-kit/blob/c43849408ac0de2ca6a52f14eaae71449776057b/templates/commands/tasks.md) | c43849408ac0de2ca6a52f14eaae71449776057b | 2f9176c6e7c23d2a83d2bd018ffa1e67aee977389a57f2a3fe35fe987b425944 |
| [Spec Kit analyze](https://github.com/github/spec-kit/blob/c43849408ac0de2ca6a52f14eaae71449776057b/templates/commands/analyze.md) | c43849408ac0de2ca6a52f14eaae71449776057b | ffe0640ebe778795737937f2d4ec6f0149d7d55b72692e25369a668f985d1dfe |

保留：按成果组织完整增量与依赖；文件职责、接口和验证方法的必要细化；需求覆盖、歧义、冲突、超范围与一致性检查。

改造：成果与技术子步骤分层；读取项目既有 scope、design、spec、foundation、tasks 和 verification；输出归当前迭代；保留进度与用户验收事实；纳入框架的独立审查、复查和逐成果用户验收；按实际影响选择测试。

未引入：上游安装器、CLI、setup-tasks/check-prerequisites 的 Bash/PowerShell/Python 脚本、hooks 与 handoffs、constitution 或独立文档模板树、上游执行技能及 ledger、提交/清理逻辑、固定发现数量及统一 TDD 步骤。本目录不运行或引用这些资源；不需要为本 Skill 安装完整上游项目。源文件引用链中的这些资源按“不保留”处理，不声明已审计整个上游依赖树。

本目录运行依赖为具备文件读取和受授权编辑工具的 Agent，及采用约定文档布局的业务项目；没有额外脚本、Node、Python 或外部服务运行依赖。模型遵循、自动发现及宿主权限由实际环境决定，说明文字不构成强制写入屏障。

上游原文及改编部分保留 Superpowers 和 Spec Kit 的 MIT 版权与许可；完整原文统一收录于下文，随本目录分发时保留。本声明没有为 ai-workflow 整个仓库选定许可证。

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

### Spec Kit

```text
MIT License

Copyright GitHub, Inc.

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
