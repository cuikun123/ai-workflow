# 业务项目文档管理

本页说明**资料放哪里、何时更新、写入中断后怎样恢复**。开发顺序见[开发流程](workflow.md)，确认依据见[决策记录](../decisions.md)。

## 文档结构

以下结构已批准，用于业务项目；框架自身资料仍放在本仓库 `docs/`。

```text
业务项目/
├── AGENTS.md
└── docs/
    ├── project/
    │   ├── overview.md
    │   ├── backlog.md
    │   ├── foundation/
    │   │   ├── README.md
    │   │   ├── engineering.md
    │   │   ├── experience.md
    │   │   ├── security.md
    │   │   ├── quality.md
    │   │   └── operations.md
    │   └── specs/
    │       ├── README.md
    │       └── 按实际能力创建的规格文件
    ├── iterations/
    │   ├── 000-foundation/
    │   │   ├── scope.md
    │   │   ├── design.md
    │   │   ├── tasks.md
    │   │   └── verification.md
    │   └── 按实际工作创建的后续迭代目录
    ├── workflow/
    │   └── state.yaml
    └── releases/
        └── 按实际发布创建的记录
```

框架资源与技能入口另放 `.ai-workflow/`、`.agents/skills/`，见[项目安装布局](integration.md#项目安装布局)。

### 初始化时写多少

| 对象 | 初始内容 |
| --- | --- |
| 普通固定 Markdown 文档 | 真正空文件，由地基和迭代按阶段填充 |
| `AGENTS.md`、`state.yaml` | 最小有效说明与导航 |
| 空目录 | 可用零字节占位文件供 Git 跟踪 |
| 功能规格、后续迭代、发布记录 | 实际发生时创建，不预置示例业务 |

文件存在不等于已填写、确认或验收。阶段检查只要求当时必需的内容，后续文档合法为空不阻碍前一阶段完成。初始化器和定位校验的实际状态见[交接](../handoff.md)。

## 各文件职责

v2机器增量保存在scope.md的spec_delta记录，同步收据保存在verification.md的spec_sync记录，tasks.md仍是唯一任务表；不另建业务delta目录或平行报告。格式和写入边界见[规格契约](spec-format.md#规格机器契约与同步)。

| 文件或目录 | 保存什么 |
| --- | --- |
| `overview.md` | 当前项目方向、目标用户与范围 |
| `backlog.md` | 尚未进入本轮的想法与后续工作 |
| `foundation/README.md` | 基础约定导航 |
| `engineering.md` | 结构、构建、开发与工程约定 |
| `experience.md` | 体验与界面约定 |
| `security.md` | 安全、敏感数据与访问边界 |
| `quality.md` | DoD、测试和通用质量要求 |
| `operations.md` | 环境、启动、部署、日志与排查 |
| `specs/` | 当前有效业务行为与规则 |
| `scope.md` | 本轮范围、验收、相关规格与变更 |
| `design.md` | 方案与关键取舍 |
| `tasks.md` | 唯一任务清单、进度与调整原因 |
| `verification.md` | 检查和验收依据、结果、缺口及恢复条件 |
| `state.yaml` | 当前工作、阶段、确认和任务引用等轻量导航 |
| `releases/` | 实际发布内容、版本、产物和环境结果 |

`state.yaml` 是当前工作的书签，不积累完整需求、任务或验证历史。恢复时回读实际资料，由受校验工具更新；不能单凭书签判断工作或验收已完成。

<a id="第0步状态结构与转换"></a>

## 状态结构与转换

### 三种事实分别存放

| 事实 | 位置与主责 | 不能据此推定 |
| --- | --- | --- |
| 框架安装了什么 | `.ai-workflow/manifest.json`记录包版本、兼容schema与受管理资源；机内未完成写入见操作日志 | 安装完整不等于客户端调用成功或业务任务完成 |
| 工作停在哪里 | `docs/workflow/state.yaml`是当前迭代、任务、阶段和阻塞的轻量书签，由受校验工具更新 | state写着完成不等于真实证据满足；不能从旧书签发明下一任务 |
| 目标、进度与验收依据 | 既有scope/design/tasks/verification、specs及发布记录；主Agent统一维护、引用用户确认和实际结果 | AI检查通过不等于用户验收，历史验收不自动适用于后来修改的内容 |

任务和证据仍保存在Markdown中，只有需要程序引用的部分使用稳定ID和结构化记录块。记录格式见下面的接口说明；恢复器不猜造不存在的标识。

### state v1字段

状态字段见[JSON Schema](../../schemas/state-v1.schema.json)和`src/state.mjs`。`validate`检查结构与安全路径；`status`和文档检查进一步核对引用、摘要及位置。格式通过不认证真实批准。

| 字段 | 类型/取值 | 职责及约束 |
| --- | --- | --- |
| `schema_version` | 整数，首版1 | 表达状态数据格式，不等同于框架包版本；不支持的值拒绝写入，不自动改号 |
| `revision` | 从0开始的非负整数 | 每次成功变更加1；写入必须提供期望旧值，旧值不符即冲突；恢复也不倒退revision |
| `current_iteration` | 项目相对目录或null | 例如`docs/iterations/000-foundation`；只引用实际目录，不按最大编号决定当前轮 |
| `current_task` | 稳定任务ID或null | 引用当前轮tasks中的唯一任务；计划尚未形成时允许null，不能伪造任务 |
| `phase` | `clarify / plan / build / execute / verify / accept / closeout / release / maintenance`或null | 分别表示澄清、计划、地基、执行、检查、验收、收尾、发布和维护；phase与任务状态分开 |
| `status` | `not_started / ready / running / awaiting_user / blocked / paused / completed` | 表示当前工作状态；不能把“文件存在”映射为ready或completed |
| `waiting_for` | null或`scope_confirmation / plan_confirmation / task_acceptance / operation_authorization / retry_decision` | 当前status为awaiting_user时必须明确等待原因；其他状态为null，暂停前等待原因从断点记录恢复 |
| `checkpoint_ref` | 记录引用或null | 指向tasks/verification中的最近可恢复断点，保留暂停前阶段、状态、等待原因和未完事项；历史仍留在原文档 |
| `confirmation_refs` | 当前工作所需确认记录引用数组 | 仅保存定位信息，不嵌入全部批准历史；每项记录须明确确认类型、对象、适用范围和来源 |
| `blocker_refs` | 当前未解阻塞的记录引用数组 | 原因、证据和解除条件在原记录中；不复制长日志 |
| `basis` | 路径与SHA-256数组 | 当前书签依赖的任务、确认及导航输入的实际文件摘要；用于发现过时与冲突，不包含state自身，不作为授权证明 |
| `updated_at` | UTC时间 | 仅辅助诊断，不用于挑选当前任务、判断授权新旧或处理并发 |

记录引用建议为`path + record_id`，路径用项目相对路径，标识在对应文件唯一。拒绝绝对路径、目录穿越、指向不受支持位置的链接及无效引用；行号可辅助查看，不作为稳定身份。v1拒绝未知字段和非法组合，不静默容忍拼错字段。

初始化建议：实际建立`000-foundation`后引用该目录，`current_task=null`、`phase=clarify`、`status=not_started`、`revision=0`、等待/断点为null，确认和阻塞为空；写入时间与basis来自实际生成文件。不预置已确认需求、任务、通过测试或用户验收。

`current_iteration=null`时任务与phase必须为null，不允许running；需要执行或验收具体任务时任务引用必须存在。blocked需要阻塞依据，paused需要断点依据。已验收但尚未收尾，用`phase=closeout`、`status=ready/running/blocked`及有效验收引用表示，不提前写completed。

### 状态转换规则

| 转换 | 必须满足的依据 |
| --- | --- |
| 未开始→可开始→执行中 | 本阶段所需的确认、授权、资料与依赖具备；澄清阶段不反过来要求已有设计或计划，但进入实施必须具备相应确认。建目录和普通“继续”不补成批准 |
| 执行/检查→等待用户验收 | 当前成果对应的必要检查、审查及必须修复项满足，提供可定位成果与验收步骤；测试没跑不等于通过 |
| 等待验收→收尾 | 用户明确确认对应成果及内容版本；AI自检、沉默或状态字段不能代替用户确认 |
| 收尾→已完成 | 只同步已验收的实际交付变化，相关记录及适用Git收尾完成；无业务变化可记录无需同步规格，不能伪造变更 |
| 任意活动阶段→被阻塞 | 记录原工作位置、阻塞证据与解除条件；只读查询发现问题时先返回诊断，不暗中改变state |
| 活动/等待/阻塞→暂停 | 用户明确暂停或切换，先在原文档保留断点及原等待/阻塞事实；不因暂停清除未验收状态 |
| 暂停/阻塞→恢复 | 回读断点、当前文件、适用确认及解除条件，恢复原阶段；原来待验收就恢复等待，不能自动跳到执行或完成 |
| 已完成→新工作 | 新目标及开轮条件具备后显式更新引用；不能根据最新目录自动选择 |

状态转换通过语义操作提交，不能提供可随意赋值为completed的通用绕过入口。输入至少包含期望revision、目标转换、当前basis和必要记录引用；工具核验后原子替换单个state并输出新revision。涉及多个文档时先按[恢复协议](integration.md#第0步恢复边界)保存操作记录、更新文档并回读，最后更新state。

phase不是强制所有请求从头走一遍的线性流水线；独立审查、诊断或发布仍按请求和必要前置进入，不能因加入状态机取消已有独立调用能力。恢复新revision取可核实的最高已提交revision之后的值；无法核实则停止写入，不能任意归零。

### 验收与内容绑定

建议在现有verification记录中保存稳定验收记录ID、用户确认原文/来源、任务ID、验收结果和成果标识。成果标识优先引用对应Git提交；有未提交内容时，使用本次成果范围内的相对文件清单与内容摘要，不能只用任务名或时间戳。引用指向的成果变化后，必须重新判断原验收是否适用；只新增无关日志不能抹去真实历史验收。

`basis`变化只表示书签需要重新核对，不自动把既有验收改成失败。状态恢复先读实际成果和验收记录；对同一成果已有且可核验的确认继续沿用，不重复询问。没有可恢复的用户确认依据、对象不匹配或存在矛盾时保持未确认，不从`approved: true`之类字段自行推定。

本地记录和摘要能防止误用、帮助追溯，不能证明恶意Agent没有伪造记录。首版不宣称状态文件是权限沙箱；用户确认仍来自实际人类交互及可定位来源，可信宿主记录不可用时如实保留验证限制。行为评测需专门覆盖伪造/缺失确认不得推进的场景。

### 读取、过时与写入中断

- status只读返回声明状态、实际引用核对结果和下一步条件；额外诊断区分有效、过时、损坏及安装/写入未完成，不通过读取自动重写书签。
- tasks/verification等被人工修改后，basis不符则报告过时。获准恢复时读取实际资料、保留原验收事实，唯一可确定才生成新revision；歧义保持阻塞。
- 不支持的schema、重复字段、损坏YAML、旧revision或未完成写入日志均禁止继续状态变更；原文件和恢复依据保留。
- 仅本框架工具通过项目写锁协作；外部直接编辑仍可能发生，需要前后摘要核对。多个worktree和Git合并冲突按既有Git规则处理，不宣称此处已实现多Agent调度或跨目录事务。
- 状态转换、引用、摘要新鲜度与写入恢复由运行工具检查；实际批准及检查来源仍由主Agent核对。

## 状态与文档运行工具

下面介绍基础v1记录和状态接口，v2需求增量及同步字段见[规格契约](spec-format.md)，验证政策见[任务轻重](workflow.md#任务轻重与加载方式)。状态仍为v1，不自动迁移旧项目或业务资料。

### 接口与记录

- `status --project <dir> --json`：只读返回声明状态、实际任务/记录引用、basis新鲜度、必要文档与资源/未完成写入问题、能否安全接续。存在问题时诊断不写state；不把声明状态或source.role当真人确认认证。
- `check --project <dir> --documents --json`：在资源检查外核对记录ID、当前任务、普通行内Markdown本地链接和识别到的规格需求编号。空白初始业务文档合法；阶段推进另外核对当时必需资料。
- `transition --project <dir> --input <json> --json`：输入含`operation_version=1`、`expected_revision`及语义action；支持`record/prepare/start/verify/await/confirm/closeout/complete/block/pause/resume/refresh/select`。没有通用set-state或任意指定completed入口。
- `transition --project <dir> --resume|--undo --expected-revision <n> --json`：仅处理本轮状态/文档写入的未完成操作；不执行Git、部署或数据库补偿。

沿既有`tasks.md`和`verification.md`使用独立标记块，正文保持中文Markdown。例如`<!-- iterlane:record T1 -->`、一段严格JSON围栏、`<!-- /iterlane:record T1 -->`。ID与JSON内id必须一致，文件内唯一；普通代码示例中的标记不当运行记录。文档解析支持本版本声明的普通标题、围栏和行内链接，不宣称任意Markdown解析器。

记录共同字段为`record_version/id/kind/iteration/task/source/data`。source声明role（user/assistant/tool）、可定位reference及相关原文text；检查类型、来源声明、对象及内容绑定，仍由实际交互和主Agent核对确认来源。工具输出`acceptance_verified=false`等真实性限制，不提供新的宿主签名或权限沙箱。

| kind | data及存放约束 |
| --- | --- |
| task | tasks中声明title、工作phase（build/execute/release/maintenance）、depends_on与requirements；工具管理当前任务的progress，声明接口不得注入已完成progress |
| confirmation | verification中记录purpose（scope/design/plan/task_acceptance/operation_authorization/retry_decision/pause）、approved/rejected结果、对象artifacts及明确supersedes引用；来源须声明user，AI检查记录不能替代 |
| check/review | verification中记录实际结果、命令/证据或独立上下文来源、未关闭必修项及artifacts；格式/摘要通过不声称独立执行过检查或认证审查身份 |
| checkpoint/progress | 工具生成的暂停前位置/等待/阻塞/引用与转换事件；不允许通过普通record操作自造已完成状态 |
| blocker/resolution | verification中记录原因、解除条件、对应阻塞及解除证据；解除记录不能改变原等待验收事实 |
| closeout | verification中记录规格同步或无需同步的理由、适用Git收尾依据及完成结果；工具不执行Git收尾 |

任务进度以tasks中的结构化记录为主，state只复制当前任务的必要位置。旧普通文字不会猜解为稳定任务ID或程序可验证批准；尚无任务记录的初始澄清仍可使用工具。

### 内容与依据

artifacts支持：原文件路径/SHA-256；文档definition摘要（正文及任务定义，排除工具运行记录与progress）；指定Git提交与明确文件/目录范围。definition与原文件摘要是不同域，不能用它代替basis的原字节SHA。工具改变progress或追加运行记录不使同一任务定义的确认自动失效；真实定义/代码变化则重新核对对应确认。

Git依据仅只读核对已有提交和声明范围，关闭可选锁、外部diff/textconv及fsmonitor；发现自定义filter/working-tree-encoding时不盲目调用转换器，报告证据不支持。文件范围内新未跟踪内容、改动或错误提交不匹配。无Git时可按原设计使用明确文件清单/SHA，不伪造Git结果。

当前确认引用须匹配purpose、迭代/任务与成果对象。同一对象存在未明确取代的相反确认时停止，不能凭时间戳挑一条。历史已验收成果保留；新任务的合法变更不自动把已完成历史任务改成失败，但当前成果的收尾不得借用旧内容版本批准。

scope/design/plan确认分别覆盖当前轮scope/design/tasks文档；task_acceptance精确绑定当前任务，轮级null确认仅用于适用阶段确认。pause、selection及收尾重验授权同样校验相反确认与supersedes。引用检查遍历任务依赖、确认取代与解除阻塞引用，拒绝缺失、错误kind及循环，不按目录编号推断依赖。

status回读当前轮四项工作资料及overview，核对task.progress、记录引用、schema和所有basis原字节。有效但过时的书签只诊断；refresh只有当前位置与记录一致、依据无矛盾时重新绑定basis并增revision，不更换任务/阶段、不抹历史验收。损坏state或无法唯一核实的位置不自动重建。

### 合法转换与恢复

prepare/select明确指定实际迭代及任务，不选择最大目录。澄清不要求已有方案；plan须具备scope/design确认，build/execute须有scope/design/plan确认和已完成依赖。当前未验收任务不得直接切到下一任务；明确暂停另行保存原位置后才可按有效选择依据切换。

start从ready进入running；verify从build/execute/release/maintenance的running进入检查，收尾重验还须当前ready/running及适用授权；await(task_acceptance)须有适用的检查/独立审查记录、必修项关闭和内容版本依据；confirm(task_acceptance)仅从真实待验收位置进入closeout。closeout开始及complete核对验收版本、规格/Git收尾记录；不能在awaiting_user直接complete。独立调用保持相应必要前置，不要求全部阶段从头走一遍。

pause/block保存原phase、status、waiting_for及引用到checkpoint。resume或select恢复暂停任务时重新核对原阶段条件；blocked只能通过具备解除证据的resume恢复，普通await或收尾重验不能绕过。原先awaiting_user仍恢复同一等待，不自动执行任务或重试部署。重入相同操作不重复写；revision必须精确匹配，溢出或未知revision拒绝。

### 写入与Git字节保护

抽出已验证的单项目锁和持久化替换原语供安装与状态工具共用。状态操作日志放`.ai-workflow/.local/workflow-operations/`，安装日志位置保持；两个命名空间均阻止另一个工具越过未完成写入。有效日志前失败停止，不能猜造可恢复归属。

日志保存语义输入、读依赖摘要、各目标前后像/摘要、操作ID/时间、步骤与nonce/PID锁。取得共锁后规划，并在任何目标写入前完整核对读依赖和前像，再持久化日志、更新受控tasks/verification、必要attributes/manifest，最后原子更新state并标记提交。每次替换前后重验；外部文档修改不覆盖，未知临时文件/锁保留。恢复重放须重新从前像验证同一语义计划，不能信任被改成completed的后像。已提交日志后进程退出遗留的匹配锁可通过resume核验并清理，不重做操作或增加revision；仍存活或未知所有者拒绝。

resume只完成同一计划；undo只还原匹配的受管理变化，并以新的revision表达恢复后的书签。state已写到n时undo至少写n+1，未写state时也不倒退已核实的revision。无法核实原文件/版本时拒绝。重试undo继续同一恢复，不能误转回apply；部分还原及后续用户修改均保留。

安装manifest增加受控`state_document_paths`，attributes由固定框架范围和这些精确docs路径计算；状态工具把当前basis/记录所需docs路径纳入同一日志更新。不扩大到整个docs或业务代码，不削弱原文件摘要。旧版本拒绝混用，兼容迁移属于第6步。

## 开轮与项目方向维护

主 Agent 使用 `clarify-design` 承接明确的资料准备请求；入口只定位交接，计划归 `plan-tasks`，执行收尾归 `execute-task`。

### 准备新一轮

**前置条件：**

- 已有业务项目，用户明确要求开轮或相应资料整理。
- 原轮完成验收、必要检查、规格收尾和整轮衔接检查；或用户明确暂停切换。
- 原任务待验收且未明确暂停时，继续等待；只讨论或查询时不初始化。

**准备顺序：**

1. 核对项目、目标目录和已有确认。
2. 创建既定 `scope.md`、必要的 `design.md`，以及可为空的 `tasks.md`、`verification.md`；计划与证据随后由对应阶段填写。
3. 保留适用确认，未确认部分标作草案；目录创建不批准范围或实施。
4. 候选真正获准入轮后，在 `backlog.md` 保留原条目并关联新范围。

命名沿项目约定；无约定时可建议三位编号加短名称。普通名称冲突在授权内选不覆盖资料的名称，归属歧义先澄清。

### 暂停、切换与返回

1. 在原 `tasks.md` 保存确认依据、日期、目标路径、未完成事项、原验收状态及恢复条件。
2. 先保存现轮暂停，再准备新轮或记录旧轮恢复；新 `scope.md` 关联原轮收尾或暂停依据。
3. 依赖记录写入失败时停止后续切换，分别保留已写现场和未完成部分。
4. 恢复依据是明确确认及实际资料，不能凭“唯一未标暂停目录”、最大编号或修改时间推定。

明确切回旧轮的指令可同时作为现轮暂停和旧轮恢复依据，不重复索取相同确认。部分写入、冲突或缺失保持未知，只澄清受影响部分。

紧急修复沿用同一结构，记录必要范围、方案、任务与证据；可预先约定修复验收、发布、主线处理和清理后返回。条件具备时直接恢复原状态，待验收仍等待。具体顺序见[线上故障处理](workflow.md#线上故障处理)。

### 维护项目方向

- 项目方向已确认、文档写入授权具备时，首次填写或更新 `overview.md`；没有当前迭代也可响应明确维护请求。
- 文件缺失但项目目录及归属明确时，可创建该文件，不补建整套结构。
- 记录已确认方向无需等功能验收，但不能把未来目标写成已交付能力。
- 未确认方向留在对话、待办或设计；普通迭代不机械改项目概览。

非紧急问题默认进待办，明确纳入本轮时关联范围。原任务未满足要求的问题留在原任务修复，不转入待办推迟。

## 验证与验收记录

**对话给简短结论，文件留可定位依据。** 无适用迭代时在对话交付，不为记录而另建迭代或平行报告。

| 记录 | 最少保留 |
| --- | --- |
| 检查 | 对象与范围、执行方式、必要环境、实际结果、关键证据 |
| 缺口 | 失败、未执行或不适用的原因，以及适用的补齐条件和下一步 |
| 验收 | 对应成果、体验或检查步骤、预期、限制、提交及用户反馈 |
| 进度 | 实施、AI 检查、待验收、用户已验收与未完成收尾分别记录 |

- 结果区分通过、失败、未执行和不适用，只覆盖实际检查范围。
- 不复制完整日志，不写凭据或敏感数据。
- 按完整成果记录任务，技术子步骤完成不等于成果通过验收。
- 任务成果、验收安排或交付顺序调整，保留确认与原因。

`verification.md` 可保存详细发现、核验、修复、重验与复查依据；对话不逐轮抛回技术意见清单。受管记录格式和任务关联字段由workflow-record schema及规格契约定义；无适用迭代时仍在对话交付。

### Git、发布与升级记录

- **暂停保存**：原任务记录允许保存范围、提交断点、远端备份结果与恢复条件；记录不代替真实保存。
- **改动归属**：同属当前任务且允许入库的其他来源改动可一并保存；其他任务分开，归属未知保留现场。
- **检查范围**：只记本次涉及的目录，不为全局“干净”改其他任务状态。
- **发布**：关联标签、提交、产物与成功、失败或回滚结果；补丁发布提交与后来进入主线的提交分别识别。
- **框架升级**：在既有任务和验证记录中保存实际前后版本，计划目标与已生效版本分开；不能核实则保留未知。

这些操作的权限和步骤见[Git 工作流](git-workflow.md)与[框架升级](integration.md#框架升级)，不另建台账或版本历史体系。

## 当前内容与历史

| 位置 | 时间含义 |
| --- | --- |
| `project/` | 当前有效方向、约定与业务规格 |
| `iterations/` | 每轮变更过程，结束后保留原位 |
| `releases/` | 实际发布历史 |

一个规格可涉及多轮，一轮也可影响多个规格。简单迭代可将必要设计放在 `scope.md`；地基模板保留 `design.md`。

### 验收后同步规格

由主 Agent 在执行流程中负责：

1. **记录验收事实**：明确用户验收的是哪个成果、哪个内容版本。
2. **核对必要条件**：检查、审查和必须修复项是否满足。
3. **同步实际交付变化**：只更新相关 `specs/`，保留未变规则、其他成果、编号及用户修改；无业务变化记录无需同步。
4. **回读核验**：`tasks.md` 记收尾进度，`verification.md` 记验收依据、已同步与待同步范围、结果及缺口。

不能把整轮 `scope.md` 覆盖成有效规格。必要检查未完时，保留验收事实和缺口，暂不同步受影响变化；补齐后核对原验收是否仍适用，内容改变则重新验收。

**执行依据**：本轮明确获准变更只适用于对应行为和版本，其余有效规则继续遵守。旧环境使用旧版本依据，草案不覆盖确认；两份适用确认冲突时先澄清。

公共约定按自身确认、落实及生效时点更新，不能同时保留冲突的有效规则。

### 写入中断后恢复

- 写前回读、写后核对，保留用户修改。
- 比对实际文件、验收内容和后续变化，只补未完成部分。
- 不能凭旧记录覆盖文件，也不重复索取同一验收。
- 无法安全写记录时在对话交付断点；收尾未完保持未完成状态。

以上是 Agent 的操作规则，不是事务保证、自动触发器或新状态协议。

## 地基上下文与任务绑定草案

状态：读取与诊断已实现并验收；任务绑定、v3 写入与修订已实现并检查，待用户验收；客户端接入与迁移尚未提供。本节读取与诊断已验收；下节绑定与新日志接口已在本次隔离候选实现，不能当作主目录旧 dist 或已有业务项目的能力。

### 读取、摘要与目录变化

`docs/project/foundation/`继续是项目公共约定，普通Markdown格式和既有正文保留，不要求迁移成另一套规则schema。已确认、生效且适用的约定必须遵守；新增全局红线建议由foundation/README导航到原文，避免复制两份冲突正文。未填写、不适用、待补和生效范围由AI与用户按阶段核对，工具不认证文档语义完整。

新增`src/foundation-context.mjs`，输出`inspectProjectContext(projectRoot)`。返回`{context_version:1, project_root, framework, project_rules, foundation, snapshot_sha256, contents, semantic_completeness_verified:false}`：framework包含固定运行版本及实际公共规则文件摘要；project_rules包含项目AGENTS原字节摘要；foundation为排序的`[{path,sha256}]`；contents包含公共启动规则、项目规则和全部地基Markdown原文。snapshot由前述身份与摘要字段的canonical JSON计算，不把时间或模型自述纳入身份。

地基递归枚举真实目录中的`.md`文件，包含初始六份、合法空文件及后来拆分的文件；目录成员与内容都比较。拒绝链接/重解析点、越界、不正规文件、大小写或Unicode归一化别名。最多256份地基Markdown，单文件1MiB、总上下文原文字节4MiB；同时服从已有全项目文档和record v2 artifacts的1000项上限，绑定前把AGENTS、公共规则和任务definition计入总数。超限拒绝并说明需整理范围，不静默截断红线，不扩v2 schema上限。原字节摘要和既有Git行尾保护保持。

已实现只读接口：`context inspect [--project <dir>] --json`、`context guard [--project <dir>] --expected-snapshot <sha256> --json`。inspect不写业务文件、state或批准；guard只比较当前来源、目录和内容，返回`fresh/stale/unknown`。CLI参数错误沿USAGE，损坏资源沿PACKAGE_INVALID，地基/规则变化沿CONFLICT并附稳定诊断码。hook负责把此结果转换为宿主协议，不把CLI退出码直接当通用hook语义。

初始basis补入实际六份地基文件与`000-foundation/design.md`；状态读取同时枚举地基成员，与basis中的地基路径集合及原字节摘要比较，分别报告`FOUNDATION_MEMBERSHIP_CHANGED`、`STALE_FOUNDATION`。六份基础文件缺失报告不完整；其他已绑定扩展文件新增/删除报告变化。state仍是书签，不加完整规则正文或另一份规则数据库。

C2实现说明：framework以安装版本、source_manifest_sha256和七份公共启动文件摘要标识来源；project_root为规范化真实目录，contents为排序的path/text数组，原BOM和行尾保留。快照不包含state revision或updated_at，不因普通进度更新而失效。guard返回fresh/stale/unknown，非fresh用非零退出及结构化data报告；语义完整性始终未认证。

D147正文减负：共享manifest仍属于七份内部读取、完整校验与摘要依赖，但不再进入contents的path/text数组。规则、能力信息、项目AGENTS及全部foundation原文继续返回；framework.files保留manifest摘要，snapshot仍按原身份域计算，context bind仍保存该文件哈希。只过滤对模型的正文输出，不删文件、不跳过读集或改变历史记录格式。工作流以framework.files、project_rules和foundation的排序摘要列表枚举内部读取依赖，不再以contents正文清单决定journal读集；保持原路径顺序，优化前未完成的v3日志仍可精确重放。

新初始化项目同时把地基纳入basis和受保护文档路径，删除整个basis中的地基项也会被识别。旧书签且安装路径未声明跟踪时显示untracked，保持原语义，不静默迁移。context可在工作书签损坏时读取仍完整的已安装规则；未完成写操作、框架损坏、地基缺失/别名/超限/坏UTF8均拒绝。读取末尾复核身份、目录与字节；全部内容复读之后再次核对成员及初读文件身份、size和纳秒mtime/ctime，拒绝可观察的读取期间变化。这不是跨文件原子快照，也不提供对外部编辑器的强隔离。地基仅核对路径、UTF-8、容量、成员和摘要，不自动纳入业务规格编号或记录schema检查。

### 任务绑定与重新核对

候选接口`context bind --iteration <path> --task <id> --expected-snapshot <sha256> --expected-revision <n> --request-id <id> --impact unaffected|affected --reason <说明> [--preview] --json`，共用工作流锁、日志和恢复。它只绑定已选择的当前任务，不选择下一任务、改变phase、批准方案或登记验收；候选摘要或revision不符时拒绝。impact/reason记录实际影响核对，不认证该判断正确。预览零写，request-id重复按现有精确请求去重。

绑定在本轮verification中生成已有v2 observation类型的check记录：method固定为`iterlane.foundation-context/v1`，expected/actual为同一snapshot摘要，source声明工具提供上下文而非认证AI阅读；artifacts精确绑定全部地基、项目规则、公共启动规则以及当前tasks.md的既有definition域。该域仍为正文＋全表任务定义、排除progress，并结合当前task ID定位；不发明单任务definition或改变旧字段含义。记录不作为业务测试通过证据，也不塞入原有产品check_refs代替必测项。ID由request-id的SHA256派生，符合现有ID长度约束。state.basis更新实际地基路径和摘要，revision只按一次语义写入递增，原phase/等待/验收事实保持。

复用已有record v2 observation形状，不修改v2字段含义，不新增业务记录kind；绑定使用新增operation v3的`context_bind`语义动作，不通过普通record动作伪装。记录source.reference指向本次operation ID。运行时必须核对对应已committed的工作流v3日志，动作确为context_bind、同一项目/任务、同一snapshot，且后像含这条确切记录；只有字段形状或source.role=tool合法不足以取得绑定。普通record/refresh不能生成此专用日志动作。新工具继续读取旧operation v1/v2与业务record v1/v2；新动作不借用旧版本解释。恶意修改本地日志或绕过运行入口仍在现有真实性边界外。

`prepare/select`可选择获准任务并核对确认，真正`start`前必须有与当前任务定义及snapshot一致的绑定。resume、进入verify、交验收、收尾操作均重新核对；state的普通refresh不能代替上下文绑定。绑定可处理唯一明确的地基过时，但其他坏记录、任务位置矛盾、来源冲突和未完成日志仍拒绝，不借绑定解除原等待。

地基变化后先重新读取，在对话核对影响和已有适用确认，再通过bind的impact/reason由工具在同次日志内写入verification说明和绑定记录，不先手改verification制造额外STALE_BASIS。bind仅接纳地基内容/目录变化；进入前其他basis必须有效，verification只允许本操作规划的新增说明与记录。手工更改verification、scope/design/tasks等造成的其他过时，先按已有授权通过正式记录/确认/恢复核对，不能由bind一起刷新。普通record/refresh纵使更新了书签，也不能生成专用context_bind日志，启动门槛继续要求有效绑定。

实质规则变更没有适用授权时保持待确认；用户已经明确内容和适用任务，无须每个任务重复确认。impact=affected时先完成必要范围/方案/计划确认与影响检查安排，再绑定新依据；仍存在坏确认、未核对任务定义或无法判断影响时拒绝进入实施。unaffected记录理由和原证据适用性，不能仅为了让摘要匹配就宣称原证据仍适用，也不自动将历史验收改为失败。

审核时以当前snapshot、适用约束与实际候选交接，不能只交实现摘要；接受审查结果与验收前回核snapshot。工具验证的是绑定与资料一致性，约束是否适用、检查是否充分和模型是否遵守仍须实际检查/独立审查；方法不提供“读过即保证正确”的认证。

地基变化需要修订已有任务的验证政策、需求或依赖时，本轮新增operation v3 `task_revise`，通过transition结构化输入执行；当前record只能追加，不能假称已支持修改。输入包含当前iteration/task、expected_revision、expected_definition_sha256（tasks.md全表definition）、request_id、reason和新的任务声明字段。只允许当前未完成任务，保留record版本、ID、phase、progress及其他任务/记录原字节；拒绝注入progress、改历史验收、改任务身份或已完成任务。新声明按原v1/v2 schema和依赖/需求/验证政策检查，旧计划确认随定义变化报告过时，修订本身不批准新定义。

task_revise在同一v3日志保存前后像、verification修订理由和状态revision，保留原位置/等待与验收事实。新确认和context_bind满足前不能实施；影响已交付候选的检查、审查和验收仍按原规则重核，不借“保留progress”沿用失效证据。普通正文编辑仍不得改结构化记录；任务声明的正式修订统一由该动作承担。

C3实施收口：新版检查入口及verificationIssues均排除method=iterlane.foundation-context/v1，绑定观察不能计入产品必测类型或check_refs。暂停、阻塞或其他等待中已记录的当前scope/design/plan确认可用confirm正式接纳，仅更新实际确认引用，保持phase/status/waiting_for、checkpoint与blocker；之后bind，原resume仍核对绑定、阶段和实际resolution，恢复时带上新适用阶段确认。

保存的closeout因声明修订而验收/证据过时，普通resume继续拒绝；resume可另给verification_authorization_ref，须为当前有效operation_authorization，且只允许保存的closeout ready/running。阻塞仍须resolution；该受控路径恢复到verify并清空检查/审查/收尾引用，历史验收记录保留，不授权实施或自动验收。该参数落实既有重验授权原则，不提供通用phase覆盖。

### 多文件写入与兼容

dev.12全部工作流写操作统一使用operation v3/workflow journal v3，包含record、prepare/select、start、pause/resume、verify/await/confirm、closeout、spec_sync、complete、context_bind和task_revise；每次apply、重放和undo均核对精确foundation目录清单、内容读集合与前后像。不得只让bind写v3而其他操作仍漏查地基成员。旧v1/v2操作输入可诊断读取，dev.12写入明确拒绝并提示使用新接口；旧未完成日志由匹配旧工具在升级前恢复，不隐式转换。

运行协议版本与业务record版本解耦：operation v3的record载荷仍校验record v1/v2，新绑定生成v2，历史v1任务的progress/checkpoint继续保持对应合法record版本。旧字段语义、spec inventories两项结构和已有schema不改义，v3日志额外保存foundation inventory。state最后提交，attributes只保护具体业务路径；目录新增/删除或前像被改时保留现场。相关CLI和所有实际写状态的skill参考统一改为新operation输入，不让旧示例在新包里误调用。

同一会话可以复用工具已提供且摘要未变的正文；每个任务仍重新检查摘要并绑定自己的任务。独立上下文实施者和审查者必须取得对应内容，不能复用另一Agent的记忆。客户端会话缓存仅为`.ai-workflow/.local/`下的可丢弃运行数据，按项目/客户端/会话隔离，不认证身份、不替代verification里的任务依据；丢失后重新inspect。没有任务的只读/独立小修改采用只读上下文核对，不伪造业务任务。

## 任务全流程文档一致性归档目标

2026-11-18按D150归档，新增工程成果尚未实施。完整任务及成功条件见[框架升级计划](../roadmap.md#真实使用驱动的框架升级计划)。本节补充设计目标，不改变现有已实现协议或伪称具备新校验。

scope保存范围和拟变更，design保存取舍，tasks保存任务与进度，verification保存实际依据，foundation保存适用公共约定，specs保存实际验收交付行为，state作导航；PR/main核对实际候选与合入结果。下一阶段必须使用上一阶段真实输出及适用内容版本，普通正文不能成为与机器进度并列的另一权威状态。

一致性需要核对成果、边界、依赖、验收、确认、检查和审查与候选的对应关系。工具校验身份、引用、摘要和状态；主Agent核对普通正文含义和实际操作，不能用文件存在或哈希一致代替语义及来源判断。公共约定或任务声明变化时检查影响和适用确认，再绑定；候选变化后重核受影响检查/审查；用户验收后只同步实际交付变化。第二轮以当前规格及历史为依据，不覆盖旧验收或复用旧绑定。

中断、冲突、部分写入和旧Markdown任务纳管要有可观察的诊断及受控恢复；保留文件、历史和等待状态，事后补记不倒填为当时真实执行。具体跨文档写入接口、原子边界及外部编辑限制在实施设计中落实，不以说明文字承诺跨文件强隔离。

该成果负责内容、依据、进度与证据正确，计划最后的文档优化负责表达、导航、去重和过时说明。验收复用主场景相关节点和必要变化/中断分支，不给每份文档另建重复测试或平行报告。

## 拆分与扩展

- 公共规则按职责组织；业务规格按独立主题、实际增长拆分，行数只作提醒。
- 不改含义的整理与引用修复可直接做；语义、范围或规则变化按确认要求处理。
- 上游必要产物无既定归属时，先讨论结构调整，不丢弃、不强塞、不另建平行体系。
