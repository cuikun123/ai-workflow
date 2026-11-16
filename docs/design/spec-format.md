# 业务规格格式

一份规格描述一个业务能力的**当前有效行为**，按目的、范围、需求和可验证场景组织；它不是某轮任务清单，也不与迭代一一对应。

## 内容格式

正文用中文，结构标记使用 Purpose、Scope、Requirements、Requirement、Scenario。以下只说明格式，不预置业务决定。

```markdown
# 业务能力名称

## Purpose
描述解决的问题与价值。

## Scope
描述覆盖范围、边界及相关规格引用。

## Requirements

### Requirement: CAP-001 需求名称
系统 MUST 满足一项具体且可观察的行为要求。

#### Scenario: S01 场景名称
- **GIVEN** 前提
- **WHEN** 操作或事件
- **THEN** 预期结果
- **AND** 必要的其他结果
```

## 写作与编号

- 每项需求尽量只表达一项可观察行为。
- 场景按风险覆盖成功、异常、边界和权限，不机械填满所有类别。
- 可补术语、状态转换、计算示例及功能特有的数据规则。
- 公共约定通过引用复用，技术实现进入设计资料。

**编号建议**：用稳定编号关联范围、任务和验证，如 `EXP-001`；文案微调不改号，删除后不复用。

ID与场景定位规则见下文。跨文件移动、需求拆并不自动推断，须声明增量并确认关系。

## 何时更新

1. 拟修改行为先进入本轮范围和设计。
2. 本轮获准变更用于对应候选版本，其余有效规则继续遵守；旧环境核对旧版本依据。
3. 成果验收且必要检查、审查满足后，只同步实际交付变化，保留其他规则、编号及用户修改。
4. 无业务变化不改规格；中断时保留范围和恢复依据，见[文档管理](documents.md#当前内容与历史)。

保留一份当前规格，Git 保存历史，迭代解释变更原因。第一轮只描述实际交付能力，未来设想进待办。

## 格式与工具的边界

- 采用固定OpenSpec方法并实现本框架明确子集，不声明完全兼容上游CLI或任意Markdown。
- 已实现身份/增量/关联检查及验收后单任务同步，v1旧资料不自动迁移；格式检查不证明业务正确。

<a id="下一轮规格机器契约与同步方案待确认"></a>
## 规格机器契约与同步

身份、增量、场景覆盖和同步使用下列契约；程序检查结构，业务语义与真实批准由Agent/宿主核对。CLI与日志版本见[接入设计](integration.md#规格与验证记录)。支持声明格式内的新增、修改和移除，不做自然语言语义合并、跨文件移动或整份规格删除。

### 身份、定位与历史

- Requirement 沿用当前 ID 字符规则：`[A-Za-z0-9][A-Za-z0-9_.-]{0,127}`；项目内大小写别名冲突，引用必须大小写一致。推荐 `CAP-001`，已有合法编号不自动改号。
- 新受管场景采用 `#### Scenario: S01 场景名称`，身份为 `{requirement_id, scenario_id}`；同一需求内场景ID唯一。名称和文案微调保留ID。
- 受管文件含唯一Purpose、Scope、Requirements二级标题，Requirement仅在Requirements下，Scenario归最近一项Requirement；每项有效需求至少一个场景，场景至少有WHEN/THEN，GIVEN/AND按实际情况使用。未满足的旧格式走legacy诊断，不自动补业务预期。
- 新需求/场景由规格整理环节分配ID，plan-tasks只引用。既有未编号正文只读提示，阻止受影响同步；显式编号补齐单独展示前后对照并获准，不把全部旧文档自动迁移。
- 当前有效规格及已成功同步的历史增量共同保留身份；已交付后移除的ID不再复用。草案占用冲突也要报告，不能通过重编号掩盖。
- 扫描既定 specs 与 iterations 中的明确记录；上限1000文档、单文档1MiB，沿用安全路径/严格UTF-8检查。超限明确报告，不截断后宣布完整。

### 增量放在既有 scope.md

引入 workflow-record v2 的 `spec_delta`，使用既有 `iterlane:record` JSON围栏，每条记录归本轮 `scope.md`，`task`必须为具体任务ID。Markdown正文继续写业务范围和理由；机器记录承担身份及可执行变化，不新增delta目录或第二份任务表。

| data字段 | 约束 |
| --- | --- |
| `base` | 涉及文件的 `{path, sha256}`；文件不存在时sha256为null，与空文件不同 |
| `operations` | 非空数组，每项含 `operation_id`、`action`、`path`、`requirement_id`、`before_sha256`、`after_markdown`、`removed_scenarios`、`reason` |
| `action` | `ADDED`、`MODIFIED`、`REMOVED`；同条增量内同一需求仅一项操作 |
| `before_sha256` | 原需求区段原始UTF-8字节SHA-256；ADDED为null，其他必有 |
| `after_markdown` | ADDED/MODIFIED为完整Requirement及场景区段；REMOVED为null |
| `removed_scenarios` | 明确列出被移除的场景ID；与前后差异完全一致，删除必须给reason |
| `new_spec_headers` | 数组项为`{path, markdown}`；仅对不存在的目标必有，markdown包含非空Purpose/Scope及Requirements标题，同一path唯一 |

`operation_id`只在所属delta内唯一，引用为 `{path, record_id, operation_id}`。示例标记均为测试说明，不进入模板业务正文：

```json
{"operation_id":"O1","action":"MODIFIED","path":"docs/project/specs/example.md","requirement_id":"CAP-001","before_sha256":"原区段64位摘要","after_markdown":"### Requirement: CAP-001 标题\n行为要求\n\n#### Scenario: S01 正常情况\n- **WHEN** 操作\n- **THEN** 预期\n","removed_scenarios":[],"reason":"本轮已确认的行为变化"}
```

ADDED不得覆盖已有需求；MODIFIED不得漏掉未声明移除的场景；REMOVED必须命中原身份及前像，其removed_scenarios列出该需求全部原场景。保留未涉及区段、注释、用户修改和行尾字节。新规格无文件时，增量还须提供对应new_spec_headers；同步只新建该文件，不从未来设想生成正文。

同轮不同任务修改同一规格文件时声明依赖，后一任务在前一任务收尾后基于真实新基线重新生成增量，并重核对受影响确认；首版不自动重基线。base文件摘要及目标需求区段摘要均须匹配，其他人即便只改该文件另一需求或注释，也保留修改并报告基线冲突；不为自动合并猜测其语义。未涉及文件、文件内未涉及区段及原行尾保持。

### 任务、场景与验证关联

- v2 task保留`requirements`，增加`delta_refs`及`scenario_refs`；前者引用spec_delta记录，后者使用需求/场景身份。无业务变化时delta_refs为空并给`spec_change_reason`。
- v2 check/review用`covers`列出实际覆盖的场景；引用按本任务的“有效规格＋获准增量”解析，不能把候选场景提前当成当前有效行为。
- 必测场景由获准任务及风险确定，程序核对所声明场景有适用证据；不强制每项需求所有历史场景重跑。移除场景用增量前像定位并验证相关行为退出，不能因从规格删除而失去历史引用。
- v2的scope definition摘要包含spec_delta全部语义字段及基线；task definition包含delta_refs、scenario_refs、execution_mode及verification_policy，progress/检查/收据不进入definition。正文不变但机器变化时旧确认也失效。候选验收绑定实际业务产物、任务定义及增量，不绑定将被同步改变的有效spec后像、state或生成记录；发现宽泛Git/file范围覆盖这些可变输出时拒绝同步并说明需要重核对的候选范围。
- 工具仍不认证人类来源、检查真实执行或审查身份；对应真实性字段保持false。结构覆盖不证明断言有效或业务需求完整。

候选视图只在未同步时将本任务获准delta应用到前像；已有有效spec_sync收据则核对当前后像，不再叠加同一delta。历史completed任务按当时delta/收据解析场景关联，不要求当前有效spec退回旧版本。

### sync的输入、结果与恢复

实际入口：`spec check`只读检查当前格式/引用，`spec sync --task <id> --preview`计算验收后变化；项目根、迭代、request-id、revision及CLI参数见接入设计。

1. 读取安装版本、当前任务、delta、实际确认、检查与审查依据。必须处于该任务已验收的closeout位置；preview也不把未验收候选当成可发布规格。
2. 按结构化区段计算变化，检查ID生命周期、删除声明、依赖与目标前像。目标需求被修改、路径不安全、增量冲突或必要证据不适用时拒绝，保留现场。
3. preview列出每个需求的ADDED/MODIFIED/REMOVED、前后摘要、文件变化、未受影响内容的保持及拒绝原因，零写入。
4. 执行使用既有单项目锁、精确前后像和语义日志；spec、spec_sync收据、任务进度与state.basis在同一可恢复操作计划内写入。state最后写，成功后回读核对；不另建一套事务实现。
5. `spec_sync`收据只由工具生成，归verification，含task、delta/验收/检查/审查引用、request_id、各目标前后摘要、操作ID及结果。v2 closeout以`sync_ref`引用收据；填`synced`文字不再足以通过complete。
6. 无业务变化也由工具核对空delta及理由，生成`not_needed`收据；不能借空声明掩盖已声明业务变化。
7. 相同request-id和内容返回已有结果，不重复写；同ID换内容、撤销后复用或未完成操作须拒绝并给恢复位置。resume/undo经现有recover按operation-id/revision处理，恢复不覆盖后来改动。

spec_sync.data固定含`delta_refs`、`acceptance_ref`、`check_refs`、`review_refs`、`request_id`、`operation_id`、`targets`、`operations`及`result`。targets项为`{path, before_sha256, after_sha256}`，不存在的前像为null，后像为实际64位SHA；operations引用具体delta/operation_id，result为synced或not_needed。not_needed的delta_refs、targets及operations为空；closeout.specs须与收据result一致。工具按语义重建核对收据，不仅检查字段存在。

历史收据证明当时同步结果，后续已验收变化不使历史验收自动失效。未收尾任务则必须核对当前后像；后像被改时保留原验收事实并报告同步冲突。

### 运行入口与容量

项目内使用`node .ai-workflow/bin/iterlane.mjs spec check --json`，外部入口显式指定`--project`。可用`--iteration docs/iterations/<名称> --task <ID>`限定任务；成功退出0、结构/引用错误5、参数错误2，检查零写。

`spec sync --iteration <path> --task <ID> --request-id <唯一请求> --expected-revision <当前版本> [--preview] --json`只处理当前已验收v2任务；恢复沿`recover --resume|--undo --operation-id <操作> --expected-revision <当前版本> --json`。有限undo只移除本操作可证明新建的规格文件，不删整个目录。移除最后需求保留头部和历史身份，后续可新增不同ID。

计划写前核算64MiB日志读上限，包括前后像、目录、临时写入和回退空间；拟新目录计入现有1000目录上限。超限在业务写入前拒绝。后续编辑、额外文档或已写新文件被外部删除会阻断恢复；工具不自动重基线，不承诺非协作编辑器竞争或断电绝对恢复。
