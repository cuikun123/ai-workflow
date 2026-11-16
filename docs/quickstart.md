# 安装与日常使用

适用于 Windows 本地新项目。准备 Node.js **24.18.0**、PowerShell 和系统 `tar`，取得维护者提供的安装包，无需克隆源码仓库或全局安装。

本页使用固定安装示例；文件名、版本和校验值必须配套。与当前试用包的区别见[发布说明](releasing.md)，文件位置见[验证记录](../tests/README.md)。

## 1. 解开工具包

解压交付 ZIP，在解压目录打开 PowerShell。以下变量在后续步骤中继续使用：

```powershell
$releaseDir = (Get-Location).Path
$artifact = Join-Path $releaseDir 'iterlane-0.3.0-dev.6.tgz'
$expectedSha = '144e327b3d8ea284b54bc00318b2b403ac17341b1b07ed5eaa15d72db5ae4e34'
if ((Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedSha) { throw '分发包摘要不匹配' }
$toolsDir = Join-Path $releaseDir 'runtime'
New-Item -ItemType Directory -Path $toolsDir -ErrorAction Stop | Out-Null
tar -xf $artifact -C $toolsDir
if ($LASTEXITCODE -ne 0) { throw '分发包解压失败' }
$sourceEntry = Join-Path $toolsDir 'package/bin/iterlane.mjs'
node $sourceEntry check --json
if ($LASTEXITCODE -ne 0) { throw '分发包检查失败' }
```

应返回 `ok:true`，版本与示例安装包一致。摘要验证文件一致性，不是来源签名；已有解包目录先核对，不直接覆盖。

## 2. 安装到新项目

默认创建 `my-new-project`，可改成你明确要创建的新目录；已有业务项目不适用此示例。

```powershell
$projectDir = Join-Path $releaseDir 'my-new-project'
New-Item -ItemType Directory -Path $projectDir -ErrorAction Stop | Out-Null
node $sourceEntry init --project $projectDir --preview --json
if ($LASTEXITCODE -ne 0) { throw '初始化预览失败' }
```

核对预览的目标目录和将写入的文件，然后执行：

```powershell
node $sourceEntry init --project $projectDir --json
if ($LASTEXITCODE -ne 0) { throw '初始化失败，请保留现场并阅读错误' }
Set-Location $projectDir
node .ai-workflow/bin/iterlane.mjs check --documents --json
if ($LASTEXITCODE -ne 0) { throw '项目检查失败' }
node .ai-workflow/bin/iterlane.mjs status --json
node .ai-workflow/bin/iterlane.mjs doctor --json
```

安装后有 `.agents/skills/`、`.ai-workflow/`、`AGENTS.md` 和 `docs/`，任务尚未开始。项目内工具可独立运行；模型登录与连接需要客户端自身的条件。

## 3. 在 codeg 中开始

打开新项目根目录并创建会话，先说“查询当前项目状态，不改文件”。随后说明真实需求，由 AI 澄清、规划、实施和检查，你确认关键方案并逐任务验收。

通常不必先选技能；需要明确入口时可调用 `$workflow-guide`。想先体验应用，可运行[收藏示例](../examples/bookmarks/README.md)。

## 日常操作

| 想做什么 | 可以这样说 |
| --- | --- |
| 讨论需求 | “我想做……，先明确范围和方案，暂不实施。” |
| 按已确认方案推进 | “方案确认，安排任务并开始当前任务。” |
| 看进度 | “做到哪里了？只查询，不改文件。” |
| 暂停 | “暂停当前任务，保留检查点。” |
| 换会话恢复 | “恢复暂停的任务，保留原验收状态。” |
| 查故障 | “先定位原因，说明修复范围。” |
| 验收 | 核对成果后说“这个任务验收通过”，仅批准对应成果 |
| 检查升级 | “查看版本和兼容条件，先预览，不执行。” |

查询、诊断和其他命令见[工具说明](../scripts/README.md)。不要自行猜操作编号或改写恢复日志；失败时保留输出，先诊断再处理。

## 支持与限制

| 项目 | 范围 |
| --- | --- |
| 环境 | Windows 11 x64、本地 NTFS、PowerShell 5.1；其他平台需另行验证 |
| 运行时 | 已实测 Node.js 24.18.0；包要求 `>=24.18.0 <25`，不代表其他版本均已实测 |
| 客户端 | Codex CLI 0.169.0 及所选 codeg 查询、暂停和新会话恢复路径 |
| Git | 本机 Git 2.55.0.windows.2；特殊过滤器和覆盖属性需核对，安装器不执行业务 Git 收尾 |
| 模型服务 | 使用客户端现有配置；连接、限流和重连不由框架保证 |
| 恢复与版本 | 按明确项目、内容版本和操作记录恢复；只使用支持的兼容路径，不自动重试部署 |
| 项目范围 | 新建个人 Web 项目和本地示例；旧项目接管、生产、更多技术栈及强隔离尚需验证 |

项目日志绑定原目录，直接搬移或复制整个项目不是已支持的迁移方式。修复保留业务资料和无法确认归属的现场。框架检查记录与文件一致性，不认证验收或审查身份。
