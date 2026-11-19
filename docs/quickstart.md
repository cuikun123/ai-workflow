# 快速开始：五步安装到新项目

照着做完这一页，你的新项目就装好了 Iterlane，可以开始和 AI 一起开发。全程大约 10 分钟。

## 开始前准备

- 一台 Windows 电脑。
- 安装包 **`iterlane-0.3.0-dev.12-trial.zip`**，向维护者索取。GitHub 上的“Download ZIP”是源码，不是这个安装包。
- 两个**分开的**文件夹。本页用下面两个举例：

| 文件夹 | 放什么 |
| --- | --- |
| `D:\Code\Iterlane` | 解压出来的安装工具 |
| `D:\Code\my-project` | 你要开发的项目，必须是**空的** |

想用别的位置也可以。把下面命令里对应的路径一起换掉，双引号保留。

所有命令都在 **PowerShell** 里执行：在开始菜单搜索“PowerShell”并打开。命令里写的是完整路径，所以在哪个目录打开都行。

## 第 1 步：确认已安装 Node.js 24

```powershell
node --version
```

- **看到 `v24.18.0` 或更高的 `v24.x.x`**：继续下一步。
- **提示“无法识别 node”**：先安装 [Node.js 24](https://nodejs.org/en/download)，再重新打开 PowerShell。
- **看到其他主版本（如 `v22`、`v25`）**：换成 Node.js 24。

## 第 2 步：解压安装包

1. 在资源管理器里右键 ZIP，选“全部解压”。
2. 目标文件夹填 `D:\Code\Iterlane`。
3. 确认这个文件存在：

```text
D:\Code\Iterlane\runtime\bin\iterlane.mjs
```

如果 `runtime` 外面多了一层文件夹，把那层里面的内容移到 `D:\Code\Iterlane` 下。

## 第 3 步：检查安装包

先新建空文件夹 `D:\Code\my-project`，然后执行：

```powershell
node "D:\Code\Iterlane\runtime\bin\iterlane.mjs" check --json
```

输出会有很多文字，这是正常的。

- **找到 `"ok":true`**（冒号后可能有空格）：安装包完好，继续。
- **看到 `false` 或红色报错**：先别继续。保存输出，交给维护者或 AI 排查。

## 第 4 步：安装到项目

**先预览**，这一步不会写任何文件：

```powershell
node "D:\Code\Iterlane\runtime\bin\iterlane.mjs" init --project "D:\Code\my-project" --preview --json
```

确认输出里有 `"ok":true`，目录是你的项目。路径显示成 `D:\\Code\\my-project` 是正常的，指的是同一个目录。

**再正式安装**：

```powershell
node "D:\Code\Iterlane\runtime\bin\iterlane.mjs" init --project "D:\Code\my-project" --json
```

看到 `"ok":true` 后，项目文件夹里会多出 `AGENTS.md`、`.agents`、`.ai-workflow`、`docs`。这些是框架的工具和资料，应用代码还没有开始写。

**最后检查项目**：

```powershell
node "D:\Code\my-project\.ai-workflow\bin\iterlane.mjs" check --documents --json
node "D:\Code\my-project\.ai-workflow\bin\iterlane.mjs" status --json
```

第一条有 `"ok":true`，第二条的 `data` 里有 `"valid":true`，就装好了。

这时还没有任何任务，`docs/project/foundation/` 下的文件也是空的，都是正常的。这些内容会在第一轮开发里补上。

## 第 5 步：让 AI 开始工作

在你的 AI 编码工具里打开 `D:\Code\my-project`，新建一个会话。

**先让 AI 确认安装**，把这段发给它：

> 先读项目根目录的 AGENTS.md，实际运行项目里的 status 和 context inspect，核对框架、当前任务和地基。先只读，告诉我是否安装正常，不改文件。

**再告诉它你想做什么**：

> 我想做【你的项目目标】，第一版需要【主要功能】。先帮我讨论范围、技术方案、地基和验收方式，暂不实施。

接下来怎么确认方案、怎么验收，见[使用指南：第一次打开项目](usage.md#第一次打开项目)。

如果 AI 没有主动读 `AGENTS.md`，直接让它读。目前不是所有 AI 工具都会自动读取。

## 遇到问题

| 看到什么 | 怎么办 |
| --- | --- |
| 找不到 `iterlane.mjs` | 回到第 2 步，多半是解压时多了一层文件夹 |
| 提示没有 `package-lock.json` | 这套流程不需要 npm，从第 3 步重新开始 |
| 输出 `ok:false` 或报错 | 保存命令和完整输出，让 AI 排查。不要删除锁文件、日志，也不要反复重装 |
| 项目文件夹里已有代码 | 停下。目前只支持全新的空项目，不要用这套流程覆盖已有项目 |

[支持范围与版本说明](releasing.md) · [使用指南](usage.md) · [命令参考](../scripts/README.md)
