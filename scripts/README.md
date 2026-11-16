# 工具命令

源码入口为 `node bin/iterlane.mjs <命令>`；操作外部项目时指定 `--project <dir>`。已安装项目使用 `node .ai-workflow/bin/iterlane.mjs <命令>`，默认定位自己的目录。安装步骤见[快速开始](../docs/quickstart.md)。

| 命令 | 用途 |
| --- | --- |
| `check [--package <dir> \| --project <dir>] --json` | 检查资源包或项目；`--documents` 增加文档检查 |
| `validate --state <file> --json` | 检查状态文件结构 |
| `status --json` | 查询任务、等待条件和依据是否有效 |
| `doctor --json` | 分类诊断资源、状态、版本、日志和锁问题 |
| `init --project <dir> [--preview \| --repair \| --resume \| --undo] --json` | 初始化、同版本补缺及未完成初始化恢复 |
| `spec check --json` | 检查需求、场景、任务引用和声明增量 |
| `skills check --json` | 检查技能依赖、参考和共享资源 |
| `spec sync --iteration <path> --task <id> --request-id <id> --expected-revision <n> [--preview] --json` | 同步当前已验收任务；预览零写，执行生成收据 |

状态写入使用 `transition`，受控恢复使用 `recover`，版本操作使用 `upgrade/rollback`。所需内容、来源包、操作编号和内容版本由主流程按项目实际记录准备，不凭例子猜测；接口见[接入设计](../docs/design/integration.md)。

诊断退出成功只表示完成诊断，健康情况看结果字段。冲突或无法确认归属时保留现场；资源修复不覆盖业务资料，不借修复升级版本。

## 构建与测试

- `npm run build`：构建运行工具、技能、模板、结构定义和许可，输出到 `dist/`。
- `node scripts/build.mjs --out <dir>`：指定构建目录，只替换通过检查的同类资源包。
- `npm run ci`：运行必测集、构建和打包，汇总与原始事件输出到 `.artifacts/`；不自动调用模型。

构建从单一共享来源生成各技能的参考副本，并检查摘要一致性。依赖锁定在根锁文件中；分发包运行无需 npm 或源码开发依赖。

退出码：0 成功，2 参数无效，3 环境不支持，4 包或依赖损坏，5 格式/状态无效，6 读写或构建失败，7 冲突，8 操作未完成或无法安全恢复。
