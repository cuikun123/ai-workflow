# 来源与适配声明

0.2.4接入dev.6显式相邻版本upgrade/rollback及固定外部工具恢复，新增公共版本协议，保留业务/state、原日志及跨版本去重来源边界；没有增加上游来源或依赖，用户主动操作，不自动升级或批准业务验收。

0.2.3接入dev.5只读doctor和受控recover及预览，沿既有公共状态参考说明故障类别、相同来源包、operation-id/revision与未核实观察边界。未增加上游来源或依赖，不自动恢复、联网探测、升级或批准业务验收。

0.2.0接入本框架已确认的Git识别和交接：普通任务Git首尾与暂停保存交execute-task，线上修复交handle-incident；入口保持导航及只读查询边界。本地适配未增加上游来源、脚本或安装依赖，以下0.1.x为历史说明。

0.1.2补明确开轮、暂停恢复和项目概览的交接，以及依据具体确认定位当前轮的规则；入口继续只定位和交接，写入由原主Agent按clarify-design的条件处理。固定来源、完整许可和运行依赖不变。

0.1.1补充本框架后续目标推荐的待办读取、候选与完成事实核对，以及空缺/受阻资料和只读边界。属于本地规则补正，固定来源、许可和运行依赖不变。

本包为 ai-workflow 的方法级改写，不调用原版流程，不代表上游背书；本声明不为整个框架选择许可证。

保留 BMAD 的按实际资料和可用能力导航、GSD 的中断点与恢复依据核对。改为本框架单一主责、只读状态及逐任务验收；不采用 uv、状态重建、handoff 删除或自动外部动作。

仅使用宿主已有工具，无随包脚本、安装器、CLI 或服务依赖。方法读取不产生写入；实际项目文件、构建产物及环境操作逐项遵守请求授权。状态只读，沿用既定文档，不引入上游配置、hooks、角色运行时或独立记录体系。

## BMAD-METHOD

固定来源：https://github.com/bmad-code-org/BMAD-METHOD/tree/a867e1604b365d48ea03cbd109da1066ba0c84bc

| 实际采用方法文件 | SHA-256（原始字节） |
| --- | --- |
| [skills/bmad/SKILL.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/skills/bmad/SKILL.md) | `a2740b6080a7b79a5a854d7c1261d029e126d19794c4d7038898264f43f1fa64` |
| [skills/bmad/references/help.md](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/skills/bmad/references/help.md) | `4b13799ff9ff33e0408ea9f861b7e53e857bbebb85662401656a21fe5bc175d0` |

完整原许可：

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

署名：[CONTRIBUTORS](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/CONTRIBUTORS.md)；商标：[TRADEMARK](https://github.com/bmad-code-org/BMAD-METHOD/blob/a867e1604b365d48ea03cbd109da1066ba0c84bc/TRADEMARK.md)。完整许可保留贡献者与商标条款，不冒充官方。

## GSD Core

固定来源：https://github.com/open-gsd/gsd-core/tree/fa03ab369b34c4b5f734f48d4985d091f21795ad

| 实际采用方法文件 | SHA-256（原始字节） |
| --- | --- |
| [gsd-core/workflows/resume-project.md](https://github.com/open-gsd/gsd-core/blob/fa03ab369b34c4b5f734f48d4985d091f21795ad/gsd-core/workflows/resume-project.md) | `bfaa76506389f8b10efdde14b08c27eff0d98cf7433b6a4fd2de822555aafcda` |

完整原许可：

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

## Superpowers：按需发现方法

固定来源：https://github.com/obra/superpowers/tree/22f0b463e7a5e579904dd6211a520321035526f7

实际适配skills/using-superpowers/SKILL.md（SHA-256：82c5c8866ad7f5dd4440ce66bd7806ba48a2f13771beae5cf112e53f08fe36ba）的原生发现、先看元数据和相关方法后展开的原则。不采用1%相关即强制调用规则、全量触发、配置修改或自动Git。关联Codex参考已核对，配置/模型/提交建议未引入。

完整原许可（LICENSE原字节）：

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

当前版本 0.3.3：每任务地基上下文、专用绑定与 operation v3 方法；业务 record v1/v2 及原许可保留。
