# 命令参考

这些命令在终端运行。日常开发时，直接在 AI 对话里提需求就行，AI 会核对项目并替你准备命令。怎么配合开发见[使用指南](../docs/usage.md)。

## 命令写在哪里

第一次安装请按[快速开始](../docs/quickstart.md)操作。之后按你所在的位置选择命令开头：

| 你在哪里 | 命令开头 |
| --- | --- |
| 试用 ZIP 解压后的目录 | `node runtime/bin/iterlane.mjs <命令>` |
| 已安装的项目根目录 | `node .ai-workflow/bin/iterlane.mjs <命令>` |

几个通用参数：

- `--json`：输出 JSON，方便 AI 或程序读取。
- `--help`：查看当前版本的全部参数。
- `--project <目录>`：从项目外部操作某个项目时指定目录。在项目里运行时不用加。

## 只读查询

下面这些命令只查看，不修改项目文件。

| 命令 | 查什么 | 结果怎么看 |
| --- | --- | --- |
| `check --json` | 工具和资源是否完整 | `"ok":true` 表示完整 |
| `check --documents --json` | 加查文档引用和状态是否一致 | 同上 |
| `status --json` | 当前任务、在等什么、依据是什么 | 看 `data` 里的内容 |
| `doctor --json` | 工具、版本、状态、日志、锁有没有问题 | 看 `local_valid` 和 `findings`，命令成功不代表没问题 |
| `context inspect --json` | AI 开工前要读的规则和地基约定 | 输出里的 `snapshot_sha256` 用于后续核对 |
| `context guard --expected-snapshot <SHA256> --json` | 规则和约定在那之后有没有变 | `fresh` 表示没变；`stale` 或 `unknown` 要重新读取 |
| `validate --state <文件> --json` | 状态文件格式是否正确 | 只查格式 |
| `spec check --json` | 规格里的需求、场景和任务引用 | 只查关联和格式 |
| `skills check --json` | 技能文件是否齐全 | 缺文件或内容被改会报错 |
| `artifacts inspect --path <相对路径> --json` | 文件内容的摘要 | 可重复 `--path` 一次查多个；`--kind definition` 查任务定义 |

`check` 可以加 `--package <目录>` 检查工具包，或加 `--project <目录>` 检查项目。

## 分范围运行自动检查

日常开发用快速范围，合入前用完整范围。

```powershell
npm run ci:fast
npm run ci
```

快速范围排除依赖真实子进程、文件锁与崩溃恢复的慢用例，仍会构建、打包并检查生成文档。完整范围覆盖全部用例并校验必跑清单。两个范围的判定和要求不同，不能互相代替。

改了资源结构字段时先删除构建输出目录再运行，否则旧输出会与当前代码比较而报错。

## 检查工具操作

开发者可把实际工具参数写入 UTF-8 JSON 请求，再用 `guard check` 读取并判断。该命令只返回 allow、deny 或 unknown，不执行请求里的文件修改、工程命令或 Git 操作。

```powershell
node .ai-workflow/bin/iterlane.mjs guard check --project <项目目录> --input <请求文件> --json
```

只有 allow 的退出码为 0；deny 为 7；unknown 为 8；请求格式不正确为 2。它使用项目当前安装的框架与工作流记录。平台集成观察只能由受控模块调用方提供，命令行不接受模型提交的平台结果，因此最终 PR 集成在命令行返回 unknown。

## 检查 AI 工具能否连通

```powershell
node .ai-workflow/bin/iterlane.mjs doctor --client --json
```

只在你需要时运行。它用你现有的 Codex 配置，检查 AI 能否发现技能、能否完成一次只读查询。

- 会产生一次模型调用，可能计费。
- 不修改配置，失败也不会自动重试。
- 成功时退出码为 0，`data.client.status` 为 `connected`。
- 失败时退出码为 3，输出 `"ok":false`。原因在 `error.details[0].client.failure` 里。

可选参数：`--client-cli <入口文件>` 指定客户端，`--timeout-ms <1000..180000>` 设超时。

## 会写文件的命令

这些命令会修改项目。参数里的编号、版本号和确认依据，请让 AI 按实际记录准备，不要照抄示例。能加 `--preview` 的，先预览再执行。

| 命令 | 作用 |
| --- | --- |
| `init --project <目录> --json` | 安装到新项目。`--repair` 补缺失文件，`--resume` 继续未完成的安装，`--undo` 撤销 |
| `init --example bookmarks --project <空目录> --json` | 安装并附带收藏示例代码 |
| `context bind ...` | 把当前任务绑定到最新的规则和约定 |
| `transition --input <JSON 文件> --json` | 按确认和记录推进任务状态 |
| `spec sync ...` | 把已验收任务的变化同步到规格 |
| `recover ...` | 按日志恢复中断的操作，或修复缺失资源 |
| `upgrade` / `rollback` | 按已支持的固定路径升级或回退 |

完整参数用 `--help` 查看。JSON 输入格式见[状态与记录工具契约](../skills/_shared/references/state-runtime.md)。

遇到冲突时，工具会保留现场，不会覆盖你的业务资料。恢复操作只恢复框架记录，不会重做部署、Git 或数据库操作。

## 退出码

| 代码 | 含义 |
| --- | --- |
| 0 | 命令运行成功（诊断类命令要另看结果字段） |
| 2 | 参数错误 |
| 3 | 环境不支持 |
| 4 | 工具包或依赖损坏 |
| 5 | 格式或状态无效 |
| 6 | 读写或构建失败 |
| 7 | 冲突 |
| 8 | 操作未完成，或无法安全恢复 |

支持哪些升级路径见[版本与支持范围](../docs/releasing.md)。
