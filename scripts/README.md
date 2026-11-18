# 工具命令参考

这些命令在**终端**运行。日常开发可以直接在 AI 聊天中提出需求，让 AI 核对项目并准备命令；使用流程见[使用指南](../docs/usage.md)。

## 选择正确的入口

| 你在哪里 | 命令入口 |
| --- | --- |
| 试用 ZIP 解压目录 | `node runtime/bin/iterlane.mjs <命令>` |
| 安装后的业务项目根目录 | `node .ai-workflow/bin/iterlane.mjs <命令>` |

安装后的入口默认找到自己的项目；外部工具操作业务项目时，明确传 `--project <目录>`。`--json` 输出便于 AI 或程序分析，`--help` 查看当前完整参数。初始化步骤见[快速开始](../docs/quickstart.md)。

## 常用查询与检查

下表参数接在相应入口后面；这些查询不写业务文件。

| 命令 | 核对什么 | 怎样理解结果 |
| --- | --- | --- |
| `check [--package <目录> \| --project <目录>] --json` | 资源和安装完整性 | 通过不等于客户端接入或任务验收 |
| `check --documents --json` | 增加文档引用与状态一致性检查 | 不能证明业务预期正确 |
| `validate --state <文件> --json` | YAML 和状态字段结构 | 不核对真实批准或检查执行 |
| `status --json` | 当前任务、等待条件和依据 | 与实际文件、记录一起判断进度 |
| `context inspect --json` | 当前框架启动规则、项目AGENTS和地基原文及摘要 | 只读；语义完整性仍未认证，不批准任务或操作 |
| `context guard --expected-snapshot <SHA256> --json` | 当前内容是否仍匹配此前上下文 | fresh退出0；stale/unknown非零，不能用旧摘要强行继续 |
| `doctor --json` | 本地资源、版本、状态、日志和锁 | 退出成功表示诊断完成，健康情况看 `local_valid`、`findings` |
| `spec check --json` | 需求、场景、任务引用和声明增量 | 检查关联与格式，不认证业务语义 |
| `skills check --json` | 技能依赖、参考和共享资源 | 缺文件或内容漂移会报错 |
| `artifacts inspect [--kind file\|definition] --path <相对文件>... --json` | 文件或定义的实际内容摘要 | 摘要供记录引用，重复 `--path` 可查询多文件 |

## 客户端自检

```powershell
node .ai-workflow/bin/iterlane.mjs doctor --client --json
```

明确请求时才运行。它使用已有 Codex 连接配置，检查技能发现和真实只读状态查询，可能产生一次模型调用；不修改配置，也不自动重试。

可指定 `--client-cli <入口文件>` 和 `--timeout-ms <1000..180000>`。成功看 `client.status:connected`，失败看 `client.failure` 或错误中的 `details`。客户端连接问题与本地安装问题分别判断。

## 会写文件的操作

| 命令 | 用途与前置 |
| --- | --- |
| `init --project <目录> [--preview \| --repair \| --resume \| --undo] --json` | 新项目初始化、同版本补缺或未完成初始化恢复 |
| `init --example bookmarks --project <空目录> [--preview] --json` | 初始化带收藏示例的新项目 |
| `spec sync --iteration <路径> --task <编号> --request-id <请求编号> --expected-revision <当前版本> [--preview] --json` | 只同步当前已验收任务，执行生成收据 |
| `context bind --iteration <路径> --task <ID> --expected-snapshot <SHA256> --expected-revision <n> --request-id <ID> --impact unaffected\|affected --reason <说明> [--preview] --json` | 当前未完成任务绑定最新规则与定义；同次登记影响说明，保持等待与批准 |
| `transition --input <操作JSON> --json` | 使用operation v3按真实确认和记录转换状态；task_revise修订当前声明，业务record v1/v2保留 |
| `recover` | 根据准确日志编号、内容版本和匹配来源恢复 |
| `upgrade` / `rollback` | 按已支持的固定版本路径升级或回退 |

先核对项目、版本和授权；支持 `--preview` 的操作先查看目标和变化。编号、确认引用、JSON 输入和恢复方式由 AI 按实际记录准备，不照抄占位值。结构化接口与示例见[状态与记录工具契约](../skills/_shared/references/state-runtime.md)。

冲突时保留现场；资源修复不覆盖业务资料，也不借修复升级版本。恢复书签不会重做部署、Git 或数据库动作。

## 退出码

| 代码 | 含义 |
| --- | --- |
| 0 | 命令运行成功；诊断是否健康仍看结果字段 |
| 2 | 参数无效 |
| 3 | 环境不支持 |
| 4 | 包或依赖损坏 |
| 5 | 格式或状态无效 |
| 6 | 读写或构建失败 |
| 7 | 冲突 |
| 8 | 操作未完成或无法安全恢复 |

升级、回滚和恢复仅限明确支持的来源和路径；当前支持边界见[版本说明](../docs/releasing.md)。
