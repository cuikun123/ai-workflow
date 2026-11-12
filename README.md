# AI Workflow（暂定名）

面向个人开发者、也可用于工作场景的 AI 开发工作框架。

当前状态：设计与模板骨架已建立，已有十一项 [Skill 源码](skills/README.md)。D64 新增统一入口与恢复、工程地基、发布、线上排障及多视角讨论，并增强原六项的协调交接。验证范围、未完成检查与限制见 [框架验证](tests/README.md) 和 [当前交接](docs/handoff.md)。完整安装器、初始化器、通用状态运行时及独立 CLI 尚未实现；`ai-workflow` 只是暂定仓库名。

## 范围

- 首版聚焦 Codex，服务从零开始的个人 Web 项目和后续小迭代。
- 核心流程保持技术栈无关；第一套验证方向为 Java、React、MySQL，具体框架和版本尚未选定。
- 关键节点由用户确认，阶段内部由主 Agent 统筹，按需多 Agent 协作。
- 吸收并适配成熟开源能力，保留自己的流程与文档管理体系。
- 框架接入初始化、项目地基、功能迭代、发布与维护分别设计。

## 阅读入口

1. [恢复讨论与当前状态](docs/handoff.md)
2. [文档索引](docs/README.md)
3. [已确认与待定的决策](docs/decisions.md)
4. [后续工作路线](docs/roadmap.md)
5. [业务项目模板说明](templates/README.md)

本仓库的 `docs/` 保存框架自身的设计；`templates/project/` 保存交付给业务项目的目录与文件模板。

## 使用边界

可读取对应 Skill 的完整路径并让 Agent 用于明确指定的业务项目；plan-tasks 整理计划，execute-task 在具体确认与授权具备时推进当前任务，提交后等待用户验收；review-work 检查实际产物和审查意见；debug-issue 调查原因并按适用授权修复；test-work 按需求选择测试层次、补充用例并实际检查。clarify-design 按请求澄清、调查并整理本轮 scope/design，按需交接 plan-tasks；候选反馈进入 backlog，有效规格按既定生效时点更新。各项证据与进度沿用适用的本轮 verification.md、tasks.md。项目级放置按既定布局将整个单项技能目录放入目标项目 .agents/skills/ 同名目录，不得只复制主文件；目标位置已有内容时先核对，不覆盖。当前没有完整安装器，`myflow init` 等仍是示意命令。未安装本机全局技能或修改 OpenSpec 参考仓库；真实客户端发现与调用的证据边界见 tests/README.md。

各包当前版本见[Skills索引](skills/README.md)，共同沿用 D62 的要求、目标版本与验收收尾。workflow-guide 负责定位与交接，execute-task 管当前成果，专项返回证据；主 Agent 统一正式记录，不递归执行或重复审查。检查不替代用户验收，项目文档结构和两文件包保持不变。D65协调修复及已授权的后续文档职责实现进度见[当前交接](docs/handoff.md)。

许可证、正式名称、分发形式和 Git 自动操作策略尚未最终确定。

## 仓库骨架

```text
ai-workflow/
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── docs/                # 框架设计、决定、路线与交接
├── skills/              # 入口、设计讨论、地基、计划执行、检查、发布与排障
├── templates/           # 业务项目空文档骨架与候选种子
├── scripts/             # 工具操作占位
├── schemas/             # 结构定义占位
├── profiles/            # 可选技术参考，当前只记用户偏好
├── adapters/codex/      # 首版接入方向与调查入口
├── tests/               # 包检查、隔离场景与验证记录
├── examples/            # 示例与真实验证规划
└── sources/             # 上游候选和许可核对状态
```
