# 来源与适配声明

0.2.0按本框架Git决定接入固定发布标签、远端核验、部署触发权限及线上补丁顺序；由主Agent使用已有Git/平台/部署工具，条件缺失如实报告。本地适配无新增上游来源、脚本或自动安装依赖；以下0.1.0边界保留历史含义。

本包为 ai-workflow 的方法级改写，不调用原版流程，不代表上游背书；本声明不为整个框架选择许可证。

GSD verify-and-ship 仅采用 Why a passing verification can turn stale 的证据对当前内容适用性检查；该文 ship 是 PR 流程，不提供本包部署回退能力。Superpowers 仅采用 verification-before-completion 的实际命令、退出结果与证据判断。部署、失败回退、数据核验及重试等待来自框架 D42/D43；不采用 GSD 自动 UAT、状态归档、PR、hooks 或其他调用链。

仅使用宿主已有工具，无随包脚本、安装器、CLI 或服务依赖。方法读取不产生写入；实际项目文件、构建产物及环境操作逐项遵守请求授权。状态只读，沿用既定文档，不引入上游配置、hooks、角色运行时或独立记录体系。

## GSD Core

固定来源：https://github.com/open-gsd/gsd-core/tree/fa03ab369b34c4b5f734f48d4985d091f21795ad

| 实际采用方法文件 | SHA-256（原始字节） |
| --- | --- |
| [docs/how-to/verify-and-ship.md](https://github.com/open-gsd/gsd-core/blob/fa03ab369b34c4b5f734f48d4985d091f21795ad/docs/how-to/verify-and-ship.md) | `fce834d702a6bcc67a9052e60a88e1d2ae455206642c2a091313b0b0bb9ab50f` |

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

## Superpowers

固定来源：https://github.com/obra/superpowers/tree/22f0b463e7a5e579904dd6211a520321035526f7

| 实际采用方法文件 | SHA-256（原始字节） |
| --- | --- |
| [skills/verification-before-completion/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/verification-before-completion/SKILL.md) | `2befe7fc55bcadaa3d97dd9e8efeb633d2561c0ebe74c5a8b17c4d9e7e4520b3` |

完整原许可：

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

## 0.3.0：U3结构与工具接入

本包将入口与条件方法分层，共同规则在源码_shared单一维护，由构建复制到包内references/common并校验摘要；新任务使用完整Iterlane的v2记录/规格工具。方法可独立携带，运行功能依赖完整固定安装，不包含独立调度器。以上来源和许可原文保留为历史，不因本轮重构新增外部执行权限；本段说明当前包版本与资源布局。


## 0.3.1修订

按D135接入任务轻重、条件读取与按能力交接，保留原方法职责和全部许可；验证政策采用实际命令/观察及明确审查方式，不照搬“稍有关联即强制调用”的触发。

## 0.3.2

Updated shared references for artifact inspection and explicit read-only client diagnostics; original licenses preserved.
