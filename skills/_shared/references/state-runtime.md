# 状态工具与结构化记录

本说明适用于dev.4及dev.5项目内工具；doctor/recover为dev.5新增入口，旧版本不能据此调用。它维护工作书签和已有文档中的稳定记录，不执行业务Git/部署/数据库操作，不认证人类消息或独立审查身份。实际用户确认和来源仍由主Agent从真实交互核对；工具的`acceptance_verified`、`source_authenticity_verified`始终为false。

## dev.5诊断与受控恢复

只读诊断：`node .ai-workflow/bin/iterlane.mjs doctor --json`。report_version=1；findings分别给出category/code、证据、影响和next_step，local_valid仅表达本地检查。客户端默认为not_probed，不发模型请求；成功诊断的退出0不表示资源健康、来源认证或用户验收。

明确提供本地客户端观察时加`--client-evidence <json>`。严格JSON字段为evidence_version=1、project_root（本项目绝对根）、observed_at（规范UTC时间，YYYY-MM-DDTHH:mm:ss[.SSS]Z）、client、status及failure；status为connected/failed/unknown，failed时failure为transport/authentication/timeout/ui_control/unknown，其他状态failure=null。这是调用方观察声明，不能附自由文本、凭据或把示意输入当真实连接；连接问题不成为回滚安装的依据。

恢复由原主流程先核对授权、来源及实际文件，再预览和执行：

| 对象 | 只读预览命令（确认前置后去掉preview执行） |
| --- | --- |
| 缺失资源/区块 | `node .ai-workflow/bin/iterlane.mjs recover --repair --package <同一固定来源包> --preview --json` |
| 安装中断 | `node .ai-workflow/bin/iterlane.mjs recover --resume --operation-id <实际uuid> --package <同一固定来源包> --preview --json` |
| 状态写入中断 | `node .ai-workflow/bin/iterlane.mjs recover --resume --operation-id <实际uuid> --expected-revision <实际n> --preview --json` |
| 核对后的过时书签 | `node .ai-workflow/bin/iterlane.mjs recover --refresh --expected-revision <实际n> --request-id <稳定ASCII_ID> --preview --json` |

有限还原将resume换成undo；只还原已核实的本次写入。refresh只重绑定可核实依据，不更换任务、消除验收等待或自动批准新内容。recovery_candidates只是需要继续核对的候选，须准确指定操作ID/revision，预览后文件变化会再次拒绝。

来源包用于同版本repair或安装恢复，与项目不得重叠；缺少来源不自动下载浮动版本。改动资源、未知日志/锁、多个未完成操作和不支持版本保留现场。入口缺失或无法启动时使用相同固定分发包的完整工具检查，并显式指定project；旧包没有这些入口时报告能力限制，不伪称诊断完成或自动升级。

恢复结果中的operation与diagnostics分别描述实际操作和剩余问题；部分修复成功不代表全部故障消失。原待验收的书签恢复后仍等待，不重试部署、Git、数据库或模型请求。

## 查询与写入

先运行项目内`check --json`。查询使用`node .ai-workflow/bin/iterlane.mjs status --json`，必要时用`check --documents --json`核对记录、需求及本地链接。原始state、真实tasks/verification和必要依据仍须回读，不能只凭声明状态继续。

实际获准写入时，原主流程准备严格JSON操作文件，再运行`node .ai-workflow/bin/iterlane.mjs transition --input <file> --json`。新包的全部工作流写操作统一使用operation_version=3；业务record_version仍为1或2，不跟着操作版本改成3。旧operation v1/v2仅可诊断，未完成写入由匹配旧工具恢复。每份操作含以下字段，未知字段和通用set-state不支持：

```json
{
  "operation_version": 3,
  "request_id": "本次稳定的ASCII请求ID",
  "expected_revision": 0,
  "action": "record",
  "data": { "record": "这里填写下面的完整记录对象，不是字符串" }
}
```

此示意不是真实任务或可直接执行的批准。request_id须匹配`[A-Za-z0-9][A-Za-z0-9_.-]*`，最多128字符；同一请求原样重试不重复写，不得换内容复用ID。expected_revision从实际status取得，不能猜或覆盖冲突。

| action | data |
| --- | --- |
| record | record：完整记录对象；只追加task/confirmation/check/review/blocker/resolution/closeout，不能注入task.progress或自造checkpoint/progress |
| prepare | iteration、task（无任务时null）、confirmations引用数组，可选phase；明确指定目标，不挑最新目录 |
| select | prepare字段，加selection_ref；只有前项已完成/未开始或明确暂停且有有效选择依据时切换 |
| context_bind | iteration、task、expected_snapshot、impact（unaffected/affected）、reason；当前未完成任务、实际摘要与revision一致，工具同次写入影响说明与专用绑定记录 |
| task_revise | iteration、task、expected_definition_sha256、reason、declaration；完整新声明保留当前任务ID/phase/progress，不注入progress或改其他/历史任务 |
| start | 空对象；ready且当前必要确认/依赖与最新专用任务绑定具备 |
| verify | 空对象；执行进入检查，待验收的候选需要重验时可回检查；已验收收尾阶段还需authorization_ref |
| await | waiting_for；task_acceptance另含check_refs及review_refs数组，真实结果/版本仍由主流程核验 |
| confirm | confirmation_refs数组；非验收可选next_phase，不能直接跳已完成 |
| closeout | 空对象；实际待验收得到对应用户确认后开始收尾 |
| complete | closeout_ref；当前验收、检查/审查与规格/Git收尾记录内容须适用 |
| pause | confirmation_ref（purpose=pause）、reason；只依据真实暂停/切换指令登记 |
| block | blocker_refs数组、reason；保存原位置与等待事实 |
| resume | 暂停时空对象；阻塞时resolution_ref；原等待验收仍恢复同一等待。已保存的closeout需重验时另给verification_authorization_ref，须为当前实际operation_authorization |
| refresh | 空对象；只在位置/引用可核实且无歧义时重绑定依据，不猜任务或改验收 |

## 每任务读取与绑定

1. 用context inspect取得当前公共规则、项目AGENTS和全部foundation原文，实际阅读并核对适用范围；保留返回snapshot_sha256。context guard的fresh只说明磁盘来源仍匹配，不能代替当前任务的专用绑定。
2. 通过prepare/select选定当前已获准任务后，准备context bind：iteration/task取当前实际对象，expected-revision取实际status，request-id稳定，expected-snapshot用本次真实摘要；impact/reason说明实际影响。CLI为node .ai-workflow/bin/iterlane.mjs context bind --iteration <实际路径> --task <ID> --expected-snapshot <摘要> --expected-revision <n> --request-id <稳定ID> --impact unaffected --reason <真实理由> --preview --json。核对预览再去掉preview，成功后用返回revision准备start。
3. 同一会话接续T2也必须核对T2自己的committed绑定，不能复用T1。已有对应任务、定义与当前snapshot相同的有效绑定可复用，不重复登记；查进度和独立小修改不伪造任务。
4. 地基变化后重新inspect，核对现有授权、约定和实际影响。bind仅允许地基过时，不顺带刷新scope/design/tasks/verification等其他过时资料；先通过正式记录、确认或recover --refresh处理已核实的依据，再绑定。普通record/refresh不产生专用绑定，不能消除该门槛。
5. 要修订当前任务声明时，用artifacts inspect --kind definition --path <当前tasks.md>取全表定义摘要，提交v3 task_revise。declaration填写该记录版本全部声明字段，去掉phase/progress；工具保留它们及身份。修订不批准新定义，重新登记适用方案/计划确认（必要时await plan_confirmation再confirm），之后bind/start。不要先verify来绕过过时绑定，不手改JSON或沿用失效验收。

任务处于paused、blocked或待验收时，修订后先record真实的新scope/design/plan确认，再用confirm仅提交这些confirmation_refs，不传next_phase。该修复只接纳适用确认，保留phase/status/waiting_for、checkpoint和blocker；随后context bind，暂停/阻塞仍须原resume（阻塞须有效resolution），待验收仍保留等待并按需要重新verify。不要用新的计划确认冒充task_acceptance或绕过暂停。已验收收尾任务暂停后发生声明变化，普通resume不能沿用失效验收；具备当前operation_authorization时，可用resume的verification_authorization_ref直接恢复到verify，阻塞仍须resolution。该动作清空原检查/审查/收尾引用，保留历史验收记录，不自动验收或实施。

start、resume、verify、交验收、接受验收、closeout/spec_sync/complete会重新核对绑定。工具提供并绑定资料，不认证AI已理解或业务检查通过；绑定的observation不能塞进产品check_refs替代必测项。客户端自动注入尚属后续接入阶段，当前按本节显式调用。

## 记录格式

明确暂停当前任务时，执行顺序为：

1. check/status回读当前iteration、task与revision n；读取本条真实用户指令。
2. 计算一个稳定成果文件（例如本轮scope.md）的原字节SHA-256。准备action=record的完整confirmation：task为当前任务ID，source.role=user且reference/text定位本条指令；data为purpose=pause、result=approved、artifacts文件清单及supersedes。源文件及已存在记录保持当前内容，引用冲突时先核对。
3. 运行transition --input <record操作文件> --json；成功后用返回revision准备action=pause，data为confirmation_ref（刚登记ID）及reason。
4. 运行第二份操作并回读status/check。checkpoint由工具保存原status、waiting_for、检查与审查引用；原先待验收仍保留该等待。两次操作各有独立request_id，首份已提交时只接续第二份。

这条顺序只登记已获得的暂停授权；操作文件属于本次临时输入。普通任务正文、检查/验收声明与工具生成的结构化进度各有明确来源，回读后再整理必要说明。

记录放当前轮tasks.md或verification.md，使用完整行标记、严格JSON围栏和匹配ID的结束标记。一般正文保持原样；示例中的标记须包在更长的Markdown围栏内。

````markdown
<!-- iterlane:record T1 -->
```json
{
  "record_version": 1,
  "id": "T1",
  "kind": "task",
  "iteration": "docs/iterations/001-example",
  "task": "T1",
  "source": {
    "role": "assistant",
    "reference": "实际可定位的来源",
    "text": "相关原文，不抄录凭据或无关对话"
  },
  "data": {
    "title": "实际获准任务的标题",
    "phase": "execute",
    "depends_on": [],
    "requirements": []
  }
}
```
<!-- /iterlane:record T1 -->
````

task只放tasks，task值与id一致；其他记录只放对应轮verification。工具维护progress；普通“已完成”文字不会猜解为稳定任务或批准。引用形式为`{"path":"docs/iterations/001-example/verification.md","record_id":"真实记录ID"}`；依赖用显式task记录引用，可跨轮但不按目录顺序推定。Requirement标题采用`### Requirement: CAP-001 标题`，不复制示例需求进真实模板。

所有记录共同字段为record_version/id/kind/iteration/task/source/data，task在轮级确认时可null。source.role仅声明user/assistant/tool，source.reference/text须真实可定位且相关；role=user不是人类来源认证。正文或JSON的`approved:true`不代表批准。

| kind | data要求 |
| --- | --- |
| confirmation | purpose（scope/design/plan/task_acceptance/operation_authorization/retry_decision/pause）、result（approved/rejected）、artifacts、supersedes引用数组；source.role须user，仍核对真实交互 |
| check | result（passed/failed/not_run）、command、exit_code、test_count、evidence及artifacts；source.role须tool，不能把未运行描述成通过 |
| review | result、context_id、must_fix_open、artifacts；source.role须assistant，独立上下文及实际审查由主流程核验 |
| blocker | reason、condition |
| resolution | result=resolved、blockers引用数组、evidence |
| closeout | result=completed、specs（synced/not_needed）、git（completed/not_applicable）、reason、reference、artifacts；记录不是实际Git操作，原Git权限与验收规则不变 |

artifacts/evidence为非空数组：`{"kind":"file","path":"相对文件","sha256":"原字节摘要"}`；或kind=definition（文档正文/任务定义的独立摘要域）；或`{"kind":"git","commit":"实际40位提交","scope":["明确目录或文件"]}`。definition不替代basis原字节，运行记录和progress不自动使同一任务定义失效；实际内容改变必须重查确认适用性。Git核对发现外部filter/编码时先报告，不擅自执行转换器。

## 中断与限制

未完成写入阻止新的状态或安装操作。先status检查实际revision和操作归属，再显式`transition --resume --expected-revision <n> --json`或`--undo`；只处理本次匹配的文件变化。原文件、锁、临时文件或来源不确定时保留，不能删除未知内容。undo使用新的revision，不能恢复旧数字。

状态工具只能校验本地记录形状、引用、内容版本与语义位置。它不是权限沙箱，不能认证整份记录的协调伪造，也不能把记录中某次检查/审查/验收声明当作独立运行事实。历史验收、实际操作及未运行限制分别记录，必要用户验收和真实审查要求继续成立。
