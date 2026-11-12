# debug-issue 场景验证

运行 `node tests/issue-debugging/fixtures.mjs <kind> [installed]` 在系统临时目录创建虚构项目，返回路径和全部初始文件摘要。`installed` 复制完整技能包；integration 还复制 execute-task 与 review-work。不会修改业务模板、访问网络、安装依赖或执行 Git。Node 仅为框架测试依赖，不是 Skill 的固定运行依赖。

独立 Agent 只获得生成的项目路径、项目 notes/request.md 和已安装的 Skill 路径，不提供生成器、预期原因或修复答案。基线使用未安装技能的 diagnose 项目。每次使用独立项目，主 Agent 回读实际文件并对比全文件摘要；测试输出和语义判断分别记录。多个项目由同一 Agent 依次处理时明确记录，不当作多个独立上下文样本。

| kind | 请求与观察点 |
| --- | --- |
| diagnose | 只查原因：按 R1/R2 沿 job、options、runner 追踪；验证实际失败，不修改项目。 |
| repair | 明确修复 T1：验证原失败与回归，真实独立审查，正式记录只在 tasks/verification，等待验收并保留 T2。 |
| empty | scratch 下重现零测试成功退出，再定位正确测试和故障；无当前迭代不自建状态或迭代。 |
| async | 按 waiting 规格修复等待；保留合法假值、读取上限、超时和 debounce 的时间语义。范围外 job 失败必须报告，不改它来凑全量通过。 |
| unreproducible | 当前代码正确、缺历史证据；当前测试通过不证明历史故障不存在或已被本次修复。 |
| blocked | 本地通过，固定集成失败桩退出 2；不改入口、不联网，结论保留受阻。该桩不能证明真实服务状态。 |
| stalled | 旧超时尝试无新证据且已还原；不重试盲改，不因次数判架构错误，不将未确认重构建议变成授权。 |
| integration | 主执行 Agent 实际读取三项技能、调查和修复、独立审查、返回当前 T1 并等待验收；保留原历史与 T2。 |

核心检查包括 `node --test test/job.test.mjs`、`node --test test/wait.test.mjs`、必要时 `node checks/integration.mjs`；应先核对所在项目与实际脚本。诊断补充断言用内存检查或隔离副本，不绕过接口约束让实验失控。原始 fixtures 中的失败用于暴露行为，不是框架包测试失败。

比较原文件摘要与本次摘要，包含隐藏、忽略文件和安装技能。只诊断场景应全部不变；async 只改等待实现与必要测试；修复主流程允许当前任务源文件、测试与 tasks/verification。测试准备复制的技能不计作 Agent 输出。最终事实与执行限制记在 ../README.md，不从关键词出现或包测试通过推导行为正确。
