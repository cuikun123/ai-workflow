# 成熟能力的吸收与适配

**以本框架的流程和文档为主，吸收成熟方法后统一适配。** 不把多个上游流程直接串联；框架能力融合也不替代具体业务需求下的开源调研。

## 来源与状态在哪里查

| 内容 | 位置 |
| --- | --- |
| 来源、采用范围、候选与核对状态 | [来源目录](../../sources/catalog.yaml) |
| 当前 Skill 版本与入口 | [能力索引](../../skills/README.md) |
| 固定文件、版本摘要、裁剪、依赖和完整许可 | 各包 `NOTICE.md` |
| 实际运行范围、失败与缺口 | [验证记录](../../tests/README.md) |
| 确认依据 | [决策记录](../decisions.md) |

候选、静态阅读、方法适配和运行验证是不同状态。BMAD 采用固定预览线方法，不承诺其运行时稳定；锁定某些方法不表示整包和全部依赖已获准。

## 已适配的方法

| Skill | 吸收的主要方法 |
| --- | --- |
| `clarify-design` | Superpowers 理解与方案比较，grilling 决策追问，Spec Kit 歧义检查，BMAD 体验与架构视角 |
| `plan-tasks` | Spec Kit 成果组织与覆盖检查，Superpowers 技术步骤细化 |
| `execute-task` | Superpowers 执行、协作、修复复查和证据判断，GSD 可观察验收与恢复 |
| `review-work` | Superpowers 审查发起、审查模板与反馈核验 |
| `debug-issue` | Superpowers 系统调试、根因追溯、条件等待和分层校验 |
| `test-work` | Superpowers 测试质量和能暴露问题的回归验证方法 |
| `workflow-guide` | BMAD 入口导航、GSD 中断点核对及Superpowers原生发现/按需阅读 |
| `build-foundation` | BMAD 架构边界、依赖和数据归属检查 |
| `release-work` | GSD 证据适用性与 Superpowers 完成前验证 |
| `handle-incident` | Superpowers 证据调查、正常路径对照和最小实验 |
| `discuss-design` | BMAD 议题选视角、相互质疑及体验与架构分析 |

验收等待、部署权限、失败回滚和线上调查前置按本框架规则执行；GSD ship 是 PR 流程，不是部署器。审查不照搬固定发现数，也不把建议直接当需求。

## 适配后怎样协作

- **一个主责**：主 Agent 保留当前任务、正式记录和验收责任；入口定位交接，专项返回方法与证据。
- **同一组依据**：交接项目与成果、请求模式、目标版本、原始要求及确认、权限、已有证据、未决项和返回位置。
- **按阶段写资料**：方向、待办、范围、计划、证据和规格各归其位，见[文档管理](documents.md)；缺迭代不自动开轮。
- **确认与证据有效**：已有适用确认不重复问，设计和计划可一并准备但不自动批准实施；内容或环境变化后补受影响检查。
- **讨论如实说明**：同一 Agent 的多视角分析不冒充独立审查，实际委派按[协作规则](multi-agent.md)。
- **缺能力准确诊断**：固定包依赖或参考损坏用skills check报告；宿主工具缺失说明受阻，不以兜底掩盖依赖失效，不递归重启流程。

## 包与运行边界

十一项Skill均改为简短入口与按需专项references；共享规则、能力映射和状态/规格工具说明维护于_shared，构建生成各包common副本并核对摘要。确定性逻辑继续由框架CLI执行。完整许可和来源随包保留，业务项目不需读取框架源码文档。

Git 方法分配给现有执行、发布和故障处理能力，见[Git 工作流](git-workflow.md)；未新增 Git Skill 或上游来源。

**未直接引入**：上游 CLI、hooks、安装器、固定角色、自动会议记录、memlog、ledger、独立 UAT 或平行文档树。

Skill 由 Agent 使用真实工具执行，不自动成为进程、服务、另一个模型或权限沙箱；真实环境、部署、新依赖及重要范围、数据、安全和成本变化仍按具体授权处理。

## 引入与更新

引入前核对：

1. 具体仓库、文件、固定版本及采用理由。
2. 许可证、署名、再分发要求和关联依赖。
3. 脚本、写入位置、副作用及权限。
4. 保留和裁剪范围、文档归属、验证方法。
5. 实际验证结果和未解决问题。

新产物先映射既定结构，确有缺口再讨论调整。项目使用固定能力版本；上游更新先评估、适配并验证，再由用户主动升级，不自动覆盖。

整体MIT与TY署名及第三方许可随包保留。安装、版本和升级机制见[接入设计](integration.md)，当前完成状态见[交接](../handoff.md)。

## 技能结构、路由与规则维护

简单任务少读，复杂工作按需展开；公共规则可检查、技能可替换。流程与验收归[工作流](workflow.md#任务轻重与加载方式)，实际检查归[验证索引](../../tests/README.md)。

### 上游方法与本地职责

适配Superpowers固定commit `22f0b463e7a5e579904dd6211a520321035526f7`中using-superpowers的原生发现与按需阅读原则，sources已登记实际文件，完整MIT随workflow-guide包。通过GitHub contents API取得原字节并核对Git blob SHA与SHA-256；两次raw连接重置保留。关联Codex说明已核对，不采用配置、模型设置、自动提交或全量强制触发。

不照搬“稍有相关即强制调用”的全量触发规则。已有宿主发现机制负责暴露技能元数据；workflow-guide按用户意图、实际状态及已有授权定位能力；按真实请求与影响选择direct/light/full，见共享routing参考。保持现有十一项名称和显式调用入口，先重构职责与内部资源，不立即合并/新增专项技能。

不另建后台路由服务、SessionStart hook或多Agent调度器。静态元数据和确定性检查保证映射完整；具体业务意图判断由Agent完成，不能把文本匹配器称为完整语义路由。

### 资源布局

```text
skills/
├── _shared/                    # 单一维护来源，不含SKILL.md，不是新技能
│   ├── manifest.json           # capability、资源依赖、规则归属与来源
│   └── references/
│       ├── work-contract.md    # 规格/候选/确认及证据适用性
│       └── write-contract.md   # 主责、写前回读、历史保护及工具边界
└── <现有skill>/
    ├── SKILL.md                # 入口、边界、主要动作、参考触发条件
    ├── NOTICE.md               # 原许可及实际新增来源
    └── references/             # 各专项方法与例子
```

确定性工具继续归src及框架CLI，不为凑三层给每个Skill新建脚本。只新增必要的共享资源目录；业务文档结构保持原职责。

共享层选择“源码单一来源，构建时复制所需资源到每个包的`references/common/`”。相比所有包链接同一个外部目录，它保留现有单项包的可移植性与路径边界；代价是交付字节有副本，但副本由构建生成并做摘要一致性检查，不人工维护。runtime状态/版本说明也迁入共享来源，由构建复制到实际需要的包，入口使用本包相对链接。

开发源码的SKILL链接指向预定生成位置；源码检查通过构建到临时目录验证完整包，不提交生成副本。NOTICE与原许可保持原字节；构建后的单包可在无仓库路径、无兄弟技能目录时解析自己的方法参考。新增共享routing参考声明判断条件、必要确认和交接；不实现语义正则分类器。依赖框架CLI的运行功能仍明确要求完整Iterlane安装，不冒称单个Skill拥有运行时。

SKILL.md预算150行/10KiB（两者由工具检查），例外需在共享manifest显式登记；这是维护预算，不代替质量判定，不删除必要边界来达标。每个references文件在入口有明确“何时读取”，缺少必要参考必须报错，候选技能不提前读全文。

### 能力映射与交接契约

`manifest.json`使用schema_version=1；各capability声明`id`、`provider`、`request_modes`、`required_resources`、`fallback`与`return_contract`。provider须为十一项之一，单能力只有一个默认provider；替代实现通过显式修改映射和检查切换，不自动安装或按相似名称猜测。

| capability id | 初始provider | 主要范围 |
| --- | --- | --- |
| `clarify` / `design_discussion` / `planning` | clarify-design / discuss-design / plan-tasks | 需求方案、比较、任务安排 |
| `implementation` / `foundation` | execute-task / build-foundation | 当前成果实施、最小工程 |
| `testing` / `diagnosis` / `review` | test-work / debug-issue / review-work | 检查、调试、审查 |
| `release` / `incident` | release-work / handle-incident | 发布、线上问题 |

workflow-guide负责导航，专项使用能力ID和本包所需方法，返回实际caller；正文不枚举所有调用方，也不重新启动入口。交接统一字段：项目/迭代/任务、request_mode、execution_mode、目标内容/运行版本、原始要求及确认引用、允许读写/副作用、已有证据、缺项、caller与返回位置。

缺失分三类：完整固定包承诺的provider/参考缺失为PACKAGE_INVALID；宿主缺工具/独立上下文为环境能力受阻；可选外部扩展未安装按manifest中的`fallback=basic_method`或`report_gap`处理。基础兜底保留同一验收和证据要求，不能把独立审查改为角色扮演。技能删除/改名后映射、未知capability及静态引用检查必须失败。

`node bin/iterlane.mjs skills check --package <dir> --json`只读输出结构、provider、资源和共享摘要问题；随原check完整性检查执行。它不证明Agent真正选择了正确技能，实际读取/路由证据见验证索引，有限演练不构成普遍可靠性保证。

### 规则归属与退役

共享manifest中规则每条有`id`、`layers`、`source`、`applies_when`、`enforced_by`、`retire_when`及`resources`。layers可包含environment/preference/accountability/compensation多个值，允许同一规则同时有环境前提和问责目的；分类是维护维度，与SKILL/references/scripts的读取层次分开。

| 示例 | 归属及维护方式 |
| --- | --- |
| 独立审查需真实独立上下文 | environment＋accountability；缺条件报告受阻 |
| 默认单轮、逐任务等待 | preference；保持现有决定，用户可明确调整政策 |
| 不伪称验收、证据绑定、规格同步 | accountability；模型升级不自动取消 |
| 特定宿主编码重读、重复失败兜底 | compensation＋environment；达到具体评测条件后提出退役 |

规则来源指向D编号、项目规范或固定上游文件；工具执行和Agent核对分别标注，不把文字边界当权限沙箱。补偿规则退役须保留原/新行为对照与回归证据，正式决定保留历史；本轮不凭模型变强自动删除有效规则，也不建立独立报告树。
