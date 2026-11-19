# 来源与许可

0.2.0补暂停保存与Git断点的文档衔接，以及handle-incident明确交来紧急修复轮后的既定资料准备和返回记录。Git操作交原执行主Agent按execute-task处理，本项不自行建立分支、提交或部署。无新增上游来源、依赖或脚本，以下0.1.x保留历史含义。

0.1.5明确计划流程委托开轮或资料准备后返回原调用方，避免“开轮并规划”组合请求重复启动plan-tasks。仅补本地交接条件，无新增来源、依赖或许可变化；历史版本及原验证范围分别保留。

0.1.4按本框架已确认的文档职责补齐普通后续开轮、暂停恢复记录、获准候选入轮关联及overview维护，明确路径、确认、生效和中断保留规则。主Agent统一写入，任务计划仍交plan-tasks；不引入上游新文件、运行依赖、安装器、通用state或Git操作。以下较早版本说明作为历史保留。

0.1.3将地基交接中的框架内部决定编号改为包内可直接理解的起步、质量及工程验证规则。属于本地说明补正，固定上游来源、许可、运行依赖和写入边界不变；不包含后续开轮职责实现。

本包 0.1.1 按 D62 对齐本框架的有效规格、本轮获准变更及验收交接；这些是本地流程适配，未新增上游来源、依赖或脚本。以下为 0.1.0 首次适配的来源记录，固定摘要和完整许可保持不变。

clarify-design 0.1.0 根据 D61 适配以下方法，中文编排与文件、授权及接续规则由 ai-workflow 提供。不是原项目的官方产品或完整运行时。

## 固定来源

| 仓库与固定 commit | 文件 | SHA-256（原文 LF） | 本包取用 |
| --- | --- | --- | --- |
| obra/superpowers · 22f0b463e7a5e579904dd6211a520321035526f7 | [skills/brainstorming/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/brainstorming/SKILL.md) | 2c9ca71f94886f9ca9f4aef055f7cafb3e1a9bdf3aeebf8f4cb547c69405d207 | 理解目标、复述核对、方案比较及按规模设计；不采用原文目录、强制问答节奏、自动提交或整套调用链。 |
| github/spec-kit · c43849408ac0de2ca6a52f14eaae71449776057b | [templates/commands/clarify.md](https://github.com/github/spec-kit/blob/c43849408ac0de2ca6a52f14eaae71449776057b/templates/commands/clarify.md) | 5260d798c5671deb9ac7e59d6ffdb69b30c26fb28878d3cc25e30fb71cacc734 | 需求、数据、体验、依赖、失败和可验收性查漏；不采用路径脚本、hooks、五问/短答案限制或直接覆盖有效规格。 |
| mattpocock/skills · 4ae2317ddb22b046e26455e4f9c9b3aaaf62212d | [skills/productivity/grill-me/SKILL.md](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grill-me/SKILL.md) | caaf8b8de1684f96e26b28f3c29189db5c89cce4b73e1c93d86164f66ef88637 | 仅核对入口，未复制；其内容转调用 grilling，不能把单个入口当完整方法。 |
| mattpocock/skills · 4ae2317ddb22b046e26455e4f9c9b3aaaf62212d | [skills/productivity/grilling/SKILL.md](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grilling/SKILL.md) | a146842ed93ca43d833550fa9adf02e58cb63c83fea9d4b4522995b82242d4e2 | 按决策依赖分轮澄清和事实先调查；不采用遍历所有分支、每个决定都问用户或默认子 Agent。 |
| mattpocock/skills · 4ae2317ddb22b046e26455e4f9c9b3aaaf62212d | [docs/productivity/grill-me.md](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/docs/productivity/grill-me.md) | 3ad2294740ad7de999cbaa1e99badd8b2b1461359639749dea379bfc8b6341dc | 核对无状态定位及原型适用说明；未引入关联的 to-spec、grill-with-docs、wayfinder 或 prototype。 |
| bmad-code-org/BMAD-METHOD · a867e1604b365d48ea03cbd109da1066ba0c84bc | [skills/bmad-ux/SKILL.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/skills/bmad-ux/SKILL.md) | 7053f91a2a9e733fd6e1361f449c4ba33fcfef44f0e4c60ebba2d9daf35562c1 | 用户流程、界面状态、可访问性和需求/界面覆盖视角；不采用双文档、memlog、配置、脚本或外部交接。 |
| bmad-code-org/BMAD-METHOD · a867e1604b365d48ea03cbd109da1066ba0c84bc | [skills/bmad-architecture/SKILL.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/skills/bmad-architecture/SKILL.md) | c8b62cc4725bafc2bd5fa3159a076a41ca84a114d3cdd8caaa4a94358b715378 | 模块不变量、依赖和共享数据归属，以及技术适配核对；不采用 spine/memlog、强制辅导模式或运行链。 |

## 依赖、写入与采用边界

原文均已阅读，但未运行原版工作流。采用文件为 brainstorming/SKILL.md、clarify.md、grilling/SKILL.md、bmad-ux/SKILL.md、bmad-architecture/SKILL.md 的方法。grill-me 入口及说明仅作核对，不是新增必需依赖。

Superpowers 引用 builder-check-prompt、visual-companion 和其他技能；Spec Kit 调用前置路径脚本及配置 hooks 并修改规格/检查单；Matt Pocock grilling 要求可用的子 Agent，grill-me 要求原版 Skill 调用工具；BMAD UX/architecture 依赖 _bmad、uv、配置解析、memlog、参考模板、审查与外部交接。这些运行脚本、参考模板、工具链和全套依赖均未引入，也未逐项审计。实际保留的方法已自包含改写进主文件。

BMAD 固定快照来自 v7 预览线；本包只使用主说明的视角，不宣称该运行时稳定或已验证。适配能力使用宿主实际提供的文件读取、网络研究和必要执行工具；缺少工具时如实保留未核对项。plan-tasks 和 review-work 为按场景使用的本框架能力，读取前核对可用性，不运行时下载依赖。本包自身只有 SKILL.md、NOTICE.md，无脚本、安装器、状态写入器或自动 Git 操作。

四个固定快照的根 LICENSE 全文保留如下。BMAD LICENSE 中的相对链接是原文文字，其对应上游文件为 [CONTRIBUTORS.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/CONTRIBUTORS.md) 和 [TRADEMARK.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/TRADEMARK.md)，均已阅读；本项目仅作来源署名，不使用其品牌标识或声称官方背书。框架整体许可证仍未选定。

## obra/superpowers

原文：[LICENSE](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/LICENSE)。

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

## github/spec-kit

原文：[LICENSE](https://github.com/github/spec-kit/blob/c43849408ac0de2ca6a52f14eaae71449776057b/LICENSE)。

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

## mattpocock/skills

原文：[LICENSE](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/LICENSE)。

```text
MIT License

Copyright (c) 2026 Matt Pocock

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

## bmad-code-org/BMAD-METHOD

原文：[LICENSE](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/LICENSE)。

```text
MIT License

Copyright (c) 2025 BMad Code, LLC

This project incorporates contributions from the open source community.
See [CONTRIBUTORS.md](CONTRIBUTORS.md) for contributor attribution.

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

TRADEMARK NOTICE:
BMad™, BMad Method™, and BMad Core™ are trademarks of BMad Code, LLC, covering all
casings and variations (including BMAD, bmad, BMadMethod, BMAD-METHOD, etc.). The use of
these trademarks in this software does not grant any rights to use the trademarks
for any other purpose. See [TRADEMARK.md](TRADEMARK.md) for detailed guidelines.
```

## D64 协调增强

0.1.2 在既有方法与许可范围内补充本框架的共同交接、单一主责、按风险选择检查及新增专项接续。未新增上游方法文件、运行依赖或调用链；新增专项是否实际可用须先核对完整说明，正文提及名称不等于已经调用。

本地dev.4适配：状态/文档工具和公共引用接入；许可、固定上游及原方法边界保持。

当前版本 0.3.3：每任务地基上下文、专用绑定与 operation v3 方法；业务 record v1/v2 及原许可保留。
