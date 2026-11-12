# 来源与许可

0.1.3补充本框架方案/计划审查的触发、检查对象与阶段证据边界，沿用关键方案按需检查及原有反馈核验职责。属于本地规则补正，未新增上游来源、依赖或调用链；下列历史适配、固定摘要和完整许可保留。

本包 0.1.1 按 D62 对齐本框架的有效规格、本轮获准变更及验收交接；这些是本地流程适配，未新增上游来源、依赖或脚本。以下为 0.1.0 首次适配的来源记录，固定摘要和完整许可保持不变。

review-work 0.1.0 按 D57 方案 A 将以下方法融合为中文审查与反馈核验 Skill。统一来源为 [Superpowers](https://github.com/obra/superpowers/tree/22f0b463e7a5e579904dd6211a520321035526f7)，固定 commit：22f0b463e7a5e579904dd6211a520321035526f7。2026-11-09 经官方 GitHub API 读取原文和根 LICENSE，SHA-256 如下（上游原始字节）。

| 上游文件 | SHA-256 |
| --- | --- |
| [requesting-code-review/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/requesting-code-review/SKILL.md) | 2180e14a448e9410bec88e6646a2d1f0ce7fdd58de27388c1e052e929679d2bc |
| [requesting-code-review/code-reviewer.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/requesting-code-review/code-reviewer.md) | 82e370be6b3447523816286195571e4216ba56ba1ad6ad0e87862294c4c78dcb |
| [receiving-code-review/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/receiving-code-review/SKILL.md) | 091df1629510af1b92fc4abd6f96732ebedb4cb2c0f3457e8f2740b0504a2438 |
| [LICENSE](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/LICENSE) | a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400 |

采用方法级改写，未复制上游整套工作流。发起审查的方法用于组织原始依据、实际范围和独立检查；模板用于需求、质量、架构与测试视角，以及具体发现和未判断事项；反馈接收的方法用于事实核验、适用性判断和有依据的修复复查。

以下适配均已落实到正文：

- Git SHA 范围改为实际可用的内容定位；没有基线时报告判断限制，不为审查创建提交或工作树。
- 上游分级映射为框架的必须修复、改进建议和待核实；合并准备度改为本次审查结论，不能代替用户验收或合并授权。
- 规格外的合理期望改为有依据的通用正确性检查或待核实业务规则；意见缺项按依赖处理，不停止全部独立工作。
- 主 Agent 管正式记录与修复安排，独立审查者只检查并返回；现有任务执行入口和本项职责互补，未安装专项时执行能力仍保留基本方法。
- 框架沿用已有 tasks.md、verification.md，无适用迭代则在对话报告；不写 state.yaml，不附加平行报告。

未引入上游 Git 命令、工作树示例的执行、GitHub 评论发送、自动接续下一任务、固定角色工具名、外部脚本、hooks、CLI 或其他 Skill 调用链。BMAD 的方法和资源本次未采用。正文包含模板方法，包只有 SKILL.md 与本 NOTICE，不要求额外 UI 元数据。

运行由宿主 Agent 与实际可用的读文件、终端等工具完成；必要独立审查还需要真实子 Agent 工具。未安装脚本、服务或原版 Superpowers，不以文字说明替代工具权限。包测试及开发用的 .mjs 文件位于框架 tests/，不随本包安装。完整客户端接入和真实项目效果须另行验证。

## 原始许可证

### Superpowers

以下为原 MIT 许可全文，版权与许可保留并不为整个 ai-workflow 框架选定许可证。

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
