# 来源与适配声明

本包为 ai-workflow 的方法级改写，不调用原版流程，不代表上游背书；本声明不为整个框架选择许可证。

吸收 systematic-debugging 主说明的错误阅读、正常路径比较、组件边界取证、单一假设与最小验证。先收集必要信息、只读访问边界、诊断/修复/部署分界及记录采用框架 D44/D52。排除自动追加线上日志、打印环境凭据、固定三次试错、强制删除实现、原版Skill调用及其未引入脚本；补证、修复和重启都不是自动授权。

仅使用宿主已有工具，无随包脚本、安装器、CLI 或服务依赖。方法读取不产生写入；实际项目文件、构建产物及环境操作逐项遵守请求授权。状态只读，沿用既定文档，不引入上游配置、hooks、角色运行时或独立记录体系。

## Superpowers

固定来源：https://github.com/obra/superpowers/tree/22f0b463e7a5e579904dd6211a520321035526f7

| 实际采用方法文件 | SHA-256（原始字节） |
| --- | --- |
| [skills/systematic-debugging/SKILL.md](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/systematic-debugging/SKILL.md) | `51c6435d98c83c42c96ba7c35725a0b2c376cd487fb1a4e6bd0ddbe7e33ef202` |

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
