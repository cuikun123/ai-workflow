# 开发路线

2026-11-18按D148暂不继续框架开发，先保存当前源码并转向真实项目试用。C4—C7保留为未实施计划，下文的实施顺序不表示本次继续授权；C3与D147检查完成，用户验收仍分别记录。


## 已有能力

安装与诊断、任务状态与恢复、需求关联、验收后规格同步、按需技能和任务轻重判断已实现。原有范围已通过用户验收；规则见[规格契约](design/spec-format.md)、[工作流程](design/workflow.md)和[接入设计](design/integration.md)。


## 当前试用优化

以下四项已完成实施，等待本轮用户验收：

| 优化 | 成果 |
| --- | --- |
| 配套试用包 | 解压后直接安装，附使用说明与收藏示例 |
| 客户端自检 | 核对技能发现和真实只读状态查询 |
| 手工步骤工具化 | 文件摘要命令、示例初始化、应用检查脚本 |
| 退化评测 | 检查小改动、普通功能、权限变化和验收等待 |

真实评测已发现两类读取超预算：普通功能和待验收“继续”。工具可用与减负达标分别判断，当前不声称全部优化通过。版本、检查结果和证据见[验证记录](../tests/README.md#当前试用版)。

## 使用者文档修订

目标：读者能理解框架、开始一个任务、核对成果并在中断后恢复。新增使用指南与安装说明分别承担教程和接入职责，正式规则保留在design，当前状态和证据仍归交接与验证页。

| 成果 | 实施与检查 |
| --- | --- |
| 使用指南与入口 | 核心概念、收藏任务完整教学对话、用户确认与验收、问题处理；主要README与读者导航 |
| 技术说明 | 流程模式、验证政策和检查记录解释；内部称呼及历史锚点引用整理 |
| 文档分发 | 同步生成来源，教程进入文档验证包；核对链接内容、实际解包与安装命令 |

三项按顺序连续实施，最终独立审查与用户验收分别记录；不重打旧固定包，不授予提交推送或公开发布。实际完成情况见[交接](handoff.md)与[验证记录](../tests/README.md)。

正文与分发来源已修订并回写；工具包、ZIP与已安装项目的文档路径已验证，独立复查已关闭必要问题。完整轮409/411及两项补验2/2分别记录，不称完整轮全绿；文档候选待用户验收，详见验证页。

## 下一步

用户已按D144确认开始以下计划，并用Pi替换Cursor，C1已按D145、C2已按D146验收，C3任务绑定与恢复已实现并通过必要检查，候选待验收。原使用指南和试用优化继续待验收，不因转入设计而登记通过。其他减负、真实业务新项目、跨平台、公开分发、生产和多Agent编排仍保持原范围。

## 多客户端地基约束与用户包计划

2026-11-17：用户按D144将Cursor改为Pi，并要求开始。路线二及以下计划进入实施，首批为Codex CLI、Claude Code、Pi CLI/TUI；C1、C2已验收；C3任务绑定与恢复已实现并完成AI检查及可复现CLI演示，成果待用户验收，C4—C7尚未开始，实施授权不代表成果验收。

**目标**：三类客户端进入同一框架规则，每个任务使用当前地基，用户包不包含维护资料。

**设计依据**：[客户端与分发](design/integration.md#多客户端与用户包设计草案)、[地基上下文与绑定](design/documents.md#地基上下文与任务绑定草案)。采用现有Node.js 24/JavaScript ESM、AJV/YAML和写锁/日志；新内部候选拟dev.12，state v1和业务record v1/v2保留。推荐主Agent内联按成果执行，独立审查按既有门槛安排，不因设计含多个客户端而自动并行委派。

**全局约束**：只在确认后隔离实施并核对回写；不提交/推送框架仓库、不改全局客户端/模型/代理、不自动安装客户端、不覆盖用户配置或业务资料；固定旧包保留。本轮仅拟支持dev.11与dev.12的明确来源升级/回滚，不扩大任意历史迁移。真实客户端缺环境时标未验证，不能用模拟通过验收该客户端。

| 任务 | 可验收成果 | 依赖 |
| --- | --- | --- |
| C1 | 只含用户资料的运行包、tgz、ZIP及安装目录，必要方法/许可完整；24/24检查与独立复查通过，已按D145验收 | 无 |
| C2 | 项目上下文读取、地基目录与摘要变化诊断 | C1 |
| C3 | 当前任务绑定、启动/恢复/验收门槛和可恢复日志 | C2 |
| C4 | 客户端配置管理、Codex接入及共同hook适配协议 | C3 |
| C5 | Claude Code新会话与同会话跨任务的真实接入 | C4 |
| C6 | Pi原生扩展、新会话与同会话跨任务的真实接入 | C4，执行顺序在C5后 |
| C7 | dev.11↔dev.12受控升级、回滚和最终候选交付 | C1—C6 |

每项含实现、必要检查、独立审查、问题修复及用户验收；技术步骤不是额外验收任务。单项通过才按原规则接续，末轮检查跨客户端和跨协议衔接。未通过项和旧失败保留，不拼局部补验为完整轮全绿。

### C1：用户分发边界

修改`package.json`、`package-lock.json`候选版本及`scripts/package-docs.mjs`、`scripts/build.mjs`、`scripts/deliver.mjs`、`src/package.mjs`和混合职责的现有用户说明；检查资源copyTree是否夹带维护README。构建到明确的新候选目录并固定摘要，不用旧dist输出试验新功能，也不原地覆盖固定旧产物。用户包导航由明确白名单生成，许可/运行必需模板不按普通文档删除。主要测试在`tests/runtime/distribution.test.mjs`、`delivery.test.mjs`和`tests/helpers/document-links.mjs`。

- [x] 写负面断言：runtime、tgz、ZIP与安装目录不得出现design/decisions/handoff/roadmap/tests验证页/维护者AGENTS；读取全部可交付Markdown核对用户链接和内部本机路径。
- [x] 修改白名单与用户导航，保留十一项完整技能、必要schema/模板、示例、完整许可；将维护说明映射现有资料。
- [x] 执行`node --test --test-concurrency=1 tests/runtime/distribution.test.mjs tests/runtime/delivery.test.mjs tests/runtime/example-init.test.mjs`，以真实打包、解包、安装和零断链验收；记录本轮实际数，不套用旧12/12。

### C2：最新项目上下文

新增`src/foundation-context.mjs`及`tests/runtime/foundation-context.test.mjs`；修改`src/cli.mjs`、`src/workflow-status.mjs`、`src/managed-blocks.mjs`、`src/installation.mjs`。接口为设计中的`inspectProjectContext(projectRoot)`及只读context inspect/guard；输出字段、canonical摘要、256份地基/1MiB单文件/4MiB总内容和错误分类按设计固定，并核对现有文档/artifacts总上限。

- [x] 编写并实测失败用例：六份0字节文件合法；改内容、新增/删除成员、丢失基础文件、别名、链接越界和超限能区分诊断；只读命令前后文件完全一致。
- [x] 实现原字节读取和排序快照；将地基文件及初始design.md纳入basis，status比较地基目录与已绑定集合，不自动刷新state。
- [x] 执行`node --test --test-concurrency=1 tests/runtime/foundation-context.test.mjs tests/runtime/workflow-status.test.mjs tests/runtime/installation.test.mjs`；真实初始化后改地基应报告过时，原文件和等待不被修改。

实施与必测37/37、独立审查修复复查及真实ZIP只读验证通过；相关扩展回归结果见[验证记录](../tests/README.md#c2最新项目上下文)。C2用户已按D146验收，C3已实现并完成必要检查，候选待验收，C4不提前开始。

### C3：每任务绑定与恢复

新增`src/context-binding.mjs`、`tests/runtime/context-binding.test.mjs`；修改`src/workflow-transitions.mjs`、`src/workflow-journal.mjs`、`src/workflow-log.mjs`、CLI及相关工作流skills/共享方法。`planContextBinding(root, input, options)`输出新operation v3 context_bind计划，impact/reason同次规划写入verification；业务记录复用v2 observation和tasks.md既有全表definition域。全部dev.12工作流写操作统一v3并与record v1/v2解耦，旧操作输入只读/诊断，新包拒绝旧版写入。日志v3额外记录foundation inventory，绑定须回核同项目/任务/snapshot的committed专用日志及记录后像，普通record日志不能冒充。

- [x] 实测负例：只有context inspect未绑定、其他任务旧绑定、普通record伪声明、普通refresh、地基变化、任务definition变化、待验收“继续”不能通过新start；只读和独立小修改不建立假任务。
- [x] 实现context bind的digest/revision/当前任务检查、preview零写、稳定ID与精确去重；start/resume/verify/await/closeout核对实际绑定，保留等待与验收事实。
- [x] 实现v3 task_revise：前像/revision/全表definition核对，只修当前未完成任务声明，保留ID/phase/progress及其他记录；更新政策或依赖后旧计划确认失效，重新确认和bind前不准实施。测试progress注入、循环依赖、改历史任务、并发、中断和精确重复请求。
- [x] 给所有新协议写入阶段注入中断：目录成员或文件变化后resume/undo拒绝并保留；无变化可恢复，state最后提交且revision不倒退。
- [x] 执行`node --test --test-concurrency=1 tests/runtime/context-binding.test.mjs tests/runtime/workflow-transitions.test.mjs tests/runtime/workflow-recovery.test.mjs tests/runtime/workflow-cli.test.mjs tests/runtime/spec-sync-workflow.test.mjs`；交付T1完成、地基更新、T2先被拒绝再按新依据开始的可复现CLI演示（批准/review为合成前置，无真实模型会话）。

C3五份必测81/81；扩展18文件160/162及CLI4/4、旧初始化1/1补验分别保留，真实ZIP安装与Markdown图核对通过。实施、AI检查与用户验收分开记录，C3成果待验收；细节见[验证记录](../tests/README.md#c3每任务绑定与恢复)。

### C4：客户端管理与Codex

D147下的独立上下文减负按用户授权先行，不改变C4范围或验收状态：

- [x] 在foundation-context测试新增manifest不出正文、七文件哈希/原snapshot算法一致及篡改拒绝，先观察红灯。
- [x] 仅修改inspectProjectContext的contents投影过滤manifest；内部读取校验保持，绑定用例核对manifest artifact并验证已有绑定可继续。
- [x] 跑foundation-context全文件与受影响绑定定向用例，独立只读复查；新目录构建/打包、真实解包CLI与全Markdown链接核对，按前像备份回写并清理临时测试副本。

新增`src/client-adapters.mjs`、`src/client-config.mjs`、`src/client-hooks.mjs`及`tests/runtime/client-adapters.test.mjs`、`client-config.test.mjs`、`client-hooks.test.mjs`；修改安装/日志/CLI、scripts/build.mjs、src/package.mjs的userPackageResources、`src/client-probe.mjs`、doctor与`adapters/codex/README.md`。适配器接口`planClientBindings(projectRoot, clientIds, options)`返回明确files/blocks/bindings；`handleClientEvent(clientId, event, input, options)`返回Claude事件输出或Pi原生扩展结果，输入上限1MiB，默认不写业务状态。manifest v3、安装日志v4与既有安装日志v3示例分开。

- [ ] 建立三个固定client ID和拟议init --clients、clients attach；Markdown管理区块、精确Pi扩展文件及JSON条目级归属写入同一计划。原生hook设置按已读取官方协议，不使用模型判定型prompt hook。
- [ ] 实测重复键、外来同名文件、已有用户hooks、已有CLAUDE.local.md、重复attach、用户改动、精确撤销、并发和中断；任何用户条目不能因数组替换丢失。
- [ ] 对Claude/Pi事件输入、明确deny、脚本内部错误、未触发/启动失败和宿主默认放行分别写测试；不能仅exit 1冒充拦截，也不能按Shell字符串前缀放行任意程序。
- [ ] 验证新会话缓存已是最新而当前未完成任务仍绑定旧snapshot时，guard仍deny；验证旧输入v1/v2不能写入dev.12，v3 record可合法携带业务record v1/v2。
- [ ] 验证旧绑定下可经精确受控record/非验收confirm/refresh修复依据及保留记录的必要正文调整，随后重新bind；guard仍拒绝代码写入、任意Shell副作用和提前交验收/收尾，不能形成修确认与绑定互相等待的循环。
- [ ] 执行三份新增runtime测试和installation/install-recovery/client-probe回归；沿Codex既有基线做新会话真实读取、context调用和任务门槛用例，原全局配置不变；没有原生hook证据时标明该层未提供。

Pi扩展调用同一确定性事件处理器；C4构建新增runtime/client-events.mjs导出handleClientEvent，Claude通过命令入口适配、Pi通过原生回调适配，不要求框架安装整个Pi运行时或TypeScript编译依赖。

### C5：Claude Code真实接入

维护`adapters/claude-code/README.md`（拟新增）及C4适配实现；新增`tests/end-to-end/claude-client.mjs`和其确定性证据核验测试。复用现有端到端客户端日志/前后文件模式，不另建正式报告。

- [ ] 从已登录真实CLI固定版本；在已初始化的隔离项目合并CLAUDE导入与项目hooks，不改个人配置，不复制凭据。缺条件记录受阻，不自动安装或换模型。
- [ ] 两个独立会话核对自动入口和当前内容；同一会话让T1按明确合成验收收尾后修改地基，再核对T2必须获取新约定。检查PreToolUse正常deny和guard故障行为，分别保存实际工具事件与前后像。
- [ ] 执行确定性证据核验和C4相关回归，以真实行为通过而非文件存在验收；人工/控制器批准、真实工具执行和框架用户验收分别记录。

### C6：Pi真实接入

维护`adapters/pi/README.md`（拟新增）及C4适配实现；新增`tests/end-to-end/pi-client.mjs`和其证据核验测试。官方阅读快照为4afe78de1e51162c01c946dcf080e6a266685a01、Pi包1.5.2；真实测试从本机CLI固定实际版本和Node环境，不自动升级或安装客户端。

- [ ] 在隔离项目验证AGENTS读取与`.pi/extensions/iterlane.ts`自动发现，保留其他扩展；至少观察一次真实交互启动，CLI JSON模式补充事件证据，不用SDK/RPC模拟代替原生客户端。
- [ ] 两个新会话及同会话T1→变更→T2验证当前规则；用before_agent_start提供上下文、tool_call返回`{block:true,reason}`拒绝旧依据写入。扩展禁用、未加载、回调异常和正常block分别验证，框架任务门槛不能被旧绑定绕过。
- [ ] 执行确定性证据核验、C4回归和真实文件前后像核对；Pi本机/登录/模型缺条件时保留未验证，不复制凭据文件或把协议测试记成客户端支持。

### C7：固定相邻升级与交付

修改`src/version-plans.mjs`、`src/version-packages.mjs`、`src/version-log.mjs`、`src/version-journal.mjs`、CLI及相关诊断；新增`tests/runtime/client-upgrade.test.mjs`。版本日志v3支持dev.11准确来源到dev.12及返回，保留旧dev.5/dev.6协议。新增全部确定性必测文件注册`scripts/ci.mjs`；只做与范围匹配的客户端模型调用。

- [ ] 实测精确来源匹配、当前任务未收尾/遗留日志拒绝、被改维护文件保留、用户JSON条目保留、升级/回滚重复请求与各写入阶段中断；业务文件、revision和历史验收不回退。
- [ ] 实现新manifest/客户端归属迁移及回滚，维护文档只删除明确管理且等于前像者；其他历史版本明确拒绝。
- [ ] 执行client-upgrade和现有version回归，再运行完整必测集合与构建/打包；完整轮、超时、失败和补验分别记录，不能用单项通过代替完整轮。
- [ ] 从固定新包真实解包安装，复核三客户端的实际支持范围、地基变更链、零维护文档、零断链、许可和摘要；保留源码/检查/审查/用户验收状态，交付新候选，旧ZIP保持原字节。

### 审查重点与收口

重点检查五类失败：同一输入接续多个任务的旧上下文（C3/C5/C6）；已有CLAUDE.local或用户hooks覆盖入口（C4/C5）；Pi扩展未加载/禁用/异常被误记强制保护（C4/C6）；新地基成员插入时写入/恢复漏查（C2/C3）；升级删除用户改过的维护资源或回滚清掉业务记录（C7）。各项对应负例必须实际运行。

已按D146验收C2并开始C3，C3成果验收通过后再按计划接续。实现、AI检查和用户验收逐项记录；原试用优化、文档候选和新的客户端支持不合并验收，不授予框架Git写操作、公开发布或生产部署。
