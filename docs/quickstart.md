# 安装与日常使用

适用于 Windows 本地新项目，准备 Node.js **24.18.0**、PowerShell 和系统 `tar`。取得维护者提供的 **0.3.0-dev.11 试用 ZIP**，解压后在该目录打开终端。`runtime/` 已经是完整工具，无需克隆源码、安装开发依赖或再次解开 tgz。

## 安装到新项目

```powershell
node runtime/bin/iterlane.mjs check --json
mkdir my-new-project
node runtime/bin/iterlane.mjs init --project my-new-project --preview --json
```

第一条应返回 `ok:true` 和版本 `0.3.0-dev.11`。核对预览的目录和文件，然后安装：

```powershell
node runtime/bin/iterlane.mjs init --project my-new-project --json
cd my-new-project
node .ai-workflow/bin/iterlane.mjs check --documents --json
node .ai-workflow/bin/iterlane.mjs status --json
```

安装后有项目技能、工具入口和资料目录，任务尚未开始。已有业务目录不能按这个例子覆盖安装；失败时保留现场和输出，先诊断再处理。

## 确认 AI 能使用

已有 Codex 客户端并完成登录时，运行：

```powershell
node .ai-workflow/bin/iterlane.mjs doctor --client --json
```

`client.status:connected` 表示本次实际发现了项目技能并执行了只读状态查询。失败查看 `client.failure`；失败报告位于 `error.details[0]`。找不到入口时可加 `--client-cli <Codex的JS或exe入口>`。它使用现有模型和连接配置，可能消耗一次模型调用；不修改配置，也不自动重试。默认不加 `--client` 的 doctor 只检查本地安装。

随后在客户端打开项目根目录、创建会话，先说“查询当前项目状态，不改文件”，再提出真实需求。通常不用自己选择技能；明确入口时可调用 `$workflow-guide`。

## 先体验收藏示例

在试用包解压目录创建另一个空目录：

```powershell
mkdir bookmark-demo
node runtime/bin/iterlane.mjs init --example bookmarks --project bookmark-demo --preview --json
node runtime/bin/iterlane.mjs init --example bookmarks --project bookmark-demo --json
cd bookmark-demo
node scripts/check.mjs
node server.mjs
```

打开终端显示的本地地址，试添加收藏、刷新和重启后保留数据；按 Ctrl+C 结束。检查脚本真正运行应用测试，将结果保存在 `evidence/checks/`。示例没有预置业务批准或验收，默认初始化也不附带示例代码。

## 日常操作

| 想做什么 | 可以这样说 |
| --- | --- |
| 讨论需求 | “我想做……，先明确范围和方案，暂不实施。” |
| 开始实施 | “方案确认，安排任务并开始当前任务。” |
| 看进度 | “做到哪里了？只查询，不改文件。” |
| 暂停或恢复 | “暂停当前任务，保留检查点。” / “恢复暂停的任务，保留原验收状态。” |
| 查故障 | “先定位原因，说明修复范围。” |
| 验收 | 核对成果后说“这个任务验收通过”，仅批准对应成果 |

AI 准备文件验证引用时，可用 `artifacts inspect --path <相对文件> --json` 取得实际摘要，不必临时编写计算命令。规格同步仍在对应任务明确验收之后执行。更多命令见[工具说明](../scripts/README.md)。

## 支持范围

目前实测 Windows 11 x64、本地 NTFS、PowerShell 5.1、Node.js 24.18.0 和 Codex CLI 0.169.0。包要求 `>=24.18.0 <25`；其他版本、平台和客户端配置需另行验证。所选 codeg 路径的历史查询/恢复验证，不代表所有宿主均可用。

工具检查本地记录和文件一致性，不认证人类批准或审查身份。项目日志绑定原目录；旧项目迁移、任意历史升级、强隔离、生产部署和公开发布尚未完成。连接、限流和重连由客户端及模型服务决定，已有失败和限制见[验证记录](../tests/README.md)。
