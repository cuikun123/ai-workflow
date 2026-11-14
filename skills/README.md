# 框架 Skills

十一项能力服务于同一工作流：先定位当前成果，再调用所需方法。**主 Agent 管任务、正式记录、审查与验收，专项返回结果。**

## 按需要选择

| 能力 | 当前包版本 | 什么时候用 |
| --- | --- | --- |
| [workflow-guide](workflow-guide/SKILL.md) | 0.2.1 | 开始/继续的入口、定位工作、核对待办、交接下一步；查询只读 |
| [clarify-design](clarify-design/SKILL.md) | 0.2.0 | 澄清范围与方案，按明确请求准备迭代资料、记录暂停恢复、维护项目概览 |
| [discuss-design](discuss-design/SKILL.md) | 0.2.0 | 多视角比较与质疑，说明推荐、代价及分歧 |
| [build-foundation](build-foundation/SKILL.md) | 0.2.0 | 建立最小工程，验证真实连通和必要基础约定 |
| [plan-tasks](plan-tasks/SKILL.md) | 0.2.0 | 按可验收成果安排任务与内部步骤 |
| [execute-task](execute-task/SKILL.md) | 0.2.0 | 执行当前任务，组织验证审查，等待验收并完成适用收尾 |
| [test-work](test-work/SKILL.md) | 0.2.0 | 按需求与风险选择检查、补有效用例并执行 |
| [debug-issue](debug-issue/SKILL.md) | 0.2.0 | 找原因，在适用授权内修复和重验 |
| [review-work](review-work/SKILL.md) | 0.2.0 | 审查方案、计划或实现，核验反馈和复查修复 |
| [release-work](release-work/SKILL.md) | 0.2.0 | 准备或执行获准发布，失败回退并等待重试决定 |
| [handle-incident](handle-incident/SKILL.md) | 0.2.0 | 线上先问必要信息再调查，方案获同意后交接修复 |

版本取自各包 `metadata.version`，历史验证按当时版本解释。

## 各自负责什么

| 工作 | 主责 |
| --- | --- |
| 普通开轮、暂停恢复记录、已确认项目概览 | 主 Agent 使用 `clarify-design`，入口只定位交接 |
| 保存、同步主线、分支与 worktree、PR 验收、Squash 和清理 | `execute-task` |
| 固定发布标签、部署结果核对 | `release-work` |
| 紧急修复轮、线上版本基线、恢复优先、主线覆盖及返回 | `handle-incident` |

普通资料准备不替代线上修复安排，其他专项不因缺少迭代就自动开轮。实际操作由宿主真实工具完成，按项目核对目标和权限，独立审查使用全新上下文。

## 共同边界

- 交接项目与成果、请求模式、目标版本、原始依据和确认、允许操作、证据、未决项及返回位置。
- 沿既定范围、计划、验证、基础约定和发布记录保存资料，不写通用 `state.yaml`，不另起报告体系。
- 资料准备、候选入轮、暂停或恢复不替代设计确认、实施授权或用户验收。
- 明确切换保留原验收事实，记录齐备后再判断接续。
- 缺能力如实交付材料，不伪称调用或临时安装上游。

## 包结构与接入

当前workflow-guide为0.2.1，其余十项为0.2.0，源码各含`SKILL.md`和`NOTICE.md`。D110取消固定两文件限制，第1步包检查已允许必要的嵌套参考、模板和脚本：

- 主说明包含完整方法及必要运行规则，不依赖业务项目读取框架源码文档。
- NOTICE 保存固定来源、适配边界和完整许可。
- 测试留在框架 `tests/`，包不依赖上游 CLI 或运行脚本。

项目级使用保留整个单项目录，放入 `.agents/skills/` 同名目录；目标已存在时先核对，不直接覆盖。

这些是仓库源码，未全局安装；项目内安装/初始化、同版本显式修复及未完成安装的有限恢复已实现，通用状态转换/进度恢复、升级迁移和强制隔离未实现。D117已明确第2、3步用户验收；十一项Skills的只读/讨论/准备代表场景、业务样例及codeg网页验证分别见[验证记录](../tests/README.md)。这些结果不代表所有分支、Codeg Agent会话入口、GitHub或生产均通过，详情见[接入设计](../docs/design/integration.md)。

源码存在或测试通过不代表用户验收。来源方法的组织见[能力适配](../docs/design/capability-reuse.md)。
