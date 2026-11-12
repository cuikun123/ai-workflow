# 框架 Skills

十一项能力为同一框架服务。先定位当前成果，再按请求使用需要的方法；主 Agent 管正式记录、审查与验收，专项返回结果，不另起一套流程。

| 能力 | 当前包版本 | 什么时候用 |
| --- | --- | --- |
| [workflow-guide](workflow-guide/SKILL.md) | 0.1.2 | 依据明确确认定位当前工作，核对待办；开轮、暂停恢复与概览维护交接对应方法，查询只读。 |
| [clarify-design](clarify-design/SKILL.md) | 0.1.5 | 澄清范围与方案；主Agent按明确请求准备后续迭代资料、记录暂停恢复、维护已确认项目概览。 |
| [discuss-design](discuss-design/SKILL.md) | 0.1.0 | 从相关角度比较、质疑取舍，给推荐并保留分歧。 |
| [plan-tasks](plan-tasks/SKILL.md) | 0.1.3 | 接收明确迭代资料，按可验收成果安排任务和内部步骤。 |
| [execute-task](execute-task/SKILL.md) | 0.1.3 | 推进当前成果、验证与审查，提交验收后等待；明确切换保留验收事实，记录齐备后再判断接续。 |
| [build-foundation](build-foundation/SKILL.md) | 0.1.0 | 建最小工程、真实连通验证及必要基础约定。 |
| [review-work](review-work/SKILL.md) | 0.1.3 | 按请求或关键方案需要审查方案/计划，审查实现、核验反馈及修复后复查。 |
| [debug-issue](debug-issue/SKILL.md) | 0.1.2 | 找原因，按适用授权修复和重验。 |
| [test-work](test-work/SKILL.md) | 0.1.2 | 按风险选测试层次、补有效用例并执行。 |
| [release-work](release-work/SKILL.md) | 0.1.0 | 准备或执行具体获准发布，失败先按获准方案回退，再等待重试决定。 |
| [handle-incident](handle-incident/SKILL.md) | 0.1.0 | 线上先问必要信息再调查，具体方案获同意后交接修复。 |

上表汇总各包 SKILL.md 的 metadata.version，历史版本及验证仍按当时记录解释。每项只有 SKILL.md 与 NOTICE.md；完整方法及必要运行规则随包，固定来源、适配边界及完整许可见 NOTICE，不依赖业务项目读取框架 docs。框架测试留在 tests/，包无上游 CLI 或运行脚本依赖。

共同交接包括项目/成果、请求模式、目标内容或运行版本、原始依据与确认、允许操作、已有证据、未决项和返回位置。沿用既定 scope/design、tasks/verification、foundation 和 releases，不写 state.yaml，不建立平行记录体系；缺能力如实交付材料，不临时安装上游。Git 全部归独立专题。

普通后续开轮、暂停恢复记录及overview维护由主Agent按clarify-design条件承接；入口只定位交接，其他专项不因缺迭代就自动创建。线上修复迭代安排不使用普通开轮例外。资料准备、候选入轮和暂停/恢复都不替代设计确认、实施授权或用户验收。

这是仓库能力源码，未全局安装。项目级接入可将整个单项目录放到 .agents/skills/ 同名目录；目标已存在时先核对，不直接覆盖。完整安装器、初始化器、通用状态运行时与强制权限隔离尚未实现。实际检查、行为场景、独立审查、真实客户端与真实项目限制见 [验证记录](../tests/README.md)，不把源码存在或测试通过当用户验收。

参见 [能力适配设计](../docs/design/capability-reuse.md)。
