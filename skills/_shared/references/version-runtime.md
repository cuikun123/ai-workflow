# 相邻版本升级、回退与中断恢复

dev.6首条已实现路径是完整固定包dev.5→dev.6→dev.5，state/record保持v1。不同版本与同版本不同来源摘要分别核对；未知/手动安装、dev.4及更早、后续未登记版本或不兼容schema不能自动迁移。需要实际检查结果才能宣称验证通过。

日常先使用项目内`node .ai-workflow/bin/iterlane.mjs check --json`、`status --json`和`doctor --json`核对资源、状态及日志。普通包check必须使用该包自己的同版本入口；跨版本来源兼容只由显式upgrade/rollback核实，不用dev.6的普通check认领dev.5。doctor退出0表示诊断运行，不表示健康；看local_valid/findings。当前任务须已验收并完成适用收尾，初始未开任务状态也可升级；未验收、暂停或运行中的业务不能因升级被视为通过。

版本写入使用完整固定dev.6外部分发包。下例`<dev6-package>`和`<fixed-dev5-package>`必须是已提供、实际完整且与项目不重叠的来源目录，不能当可直接执行的路径，也不能猜最新网上版本。dev.5原安装入口不具备upgrade/rollback，损坏或混合入口也不能作为恢复工具。

```powershell
node <dev6-package>/bin/iterlane.mjs upgrade --project <project> --from-package <fixed-dev5-package> --expected-revision <actual-n> --preview --json
```

只读预览列管理资源及区块的新增、替换、删除，manifest、本地历史/去重记录及版本日志操作；不建锁、目录、备份或临时文件。明确获准执行后去掉`--preview`，工具会重新核对所有输入。成功返回实际from/to版本、来源摘要、operation_id及保留的revision；同版本匹配重跑返回unchanged。

回退先查当前status的revision及`.ai-workflow/.local/version-state.json`的previous_upgrade_id，并核对用户指定的操作。只能选择这个明确的前一成功升级，不能按最新目录挑版本。完整旧来源保存在本次版本日志的受控前像中，回退使用新工具读取并核实它；当前业务/state原字节保留，后来新增的业务文档/记录/代码不会被整个项目快照覆盖。

```powershell
node <dev6-package>/bin/iterlane.mjs rollback --project <project> --operation-id <actual-previous-upgrade-uuid> --expected-revision <actual-current-n> --preview --json
```

按已有授权核对预览后去掉`--preview`。回读原生项目内check/doctor/status：版本实际回到dev.5、资源及当前状态有效，revision保留当前值，原日志及新增业务修改均保留；来源摘要只证明本地一致性，不能认证人的验收、模型连接或真实执行来源。

版本操作中断时由doctor输出VERSION_INCOMPLETE及确切操作ID。使用完整固定dev.6外部包，对应日志目标包/旧包及当前state均须可核实；旧工具不认识v2日志会停止正常写入，不删除未知锁或日志绕过它。

```powershell
node <dev6-package>/bin/iterlane.mjs recover --project <project> --resume --operation-id <actual-pending-uuid> --expected-revision <actual-current-n> --package <dev6-package> --preview --json
```

resume接续原记录方向；对未完成操作的有限还原把resume替换为undo。rollback中断的undo回到该次回退开始时的dev.6资源，不还原业务/state。成功提交后的正式版本回退用rollback，不能用undo改写已提交结果。部分undo只能继续undo；提交后遗留锁/归档收口只能按确切ID完成已核实收口，不重复业务。

活锁/未知所有者、坏日志、多个未完成操作、错误ID/revision/来源、变动管理文件或备份均保留并停止。区块外资料保留，区块内改动拒绝覆盖。没有完整日志的准备中断不能自动认领，需保留现场核对。

跨版本原始日志保留原字节；成功请求使用committed去重投影，已undo的请求使用rolled_back撤销标记，保持原生ID生命周期。相同成功请求重试不重复写；已撤销请求原样重试拒绝，复用两类request-id改revision或参数则CONFLICT。这些兼容缓存不是可恢复的业务操作，也不证明原操作由目标版本执行；dev.6的doctor提供来源映射，旧dev.5解码器不能显示该映射，来源需核对版本历史。工具不自动重试模型、Git、部署或业务动作。
