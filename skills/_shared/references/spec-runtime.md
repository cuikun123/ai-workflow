# v2记录与验收后规格工具

本参考用于新任务的结构化计划、检查与收尾。完整新包支持record/operation v2，state仍为v1；已有v1任务沿[原状态协议](state-runtime.md)处理，不自动迁移。旧默认仍是test_suite与independent；明确声明政策的新v2任务可使用direct/light/full及对应检查。流程判断见[选择方法](routing.md)。

## 先取得真实摘要

运行spec check，必要时限定iteration/task。成功JSON中的specifications给文件path/sha256；requirements给id/path/区段sha256/scenario_ids；definitions给scope/tasks等声明定义的path/sha256。用这些实际返回值准备base、before_sha256和definition artifacts，不自行重写Markdown解析或猜摘要。

业务文件原字节SHA-256可用Node crypto计算：node -e "const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" <相对文件>。操作JSON通过文件传给transition，不将用户文本拼到shell命令里。

## 任务与增量输入

所有记录共用record_version=2、id、kind、iteration、task、source和data。source的role/reference/text定位真实且相关指令、检查或审查；字段存在不认证来源。准备action=record的操作：operation_version=2、稳定request_id、从status取得的expected_revision、data.record完整对象。

任务kind=task放tasks.md，task等于id；data有title、phase、depends_on、requirements、delta_refs、scenario_refs及spec_change_reason。scenario_refs项为requirement_id/scenario_id，delta_refs与depends_on用path/record_id引用；进度由工具生成，不注入progress。新任务另给execution_mode、非空execution_reason和verification_policy（required_check_types、required_scenario_refs、review_mode）；业务引用/增量及发布维护不能用direct，full/业务任务不能用simplified。

范围中的spec_delta有同轮task归属。data.base列path/文件sha256（新文件null），new_spec_headers列新文件path/markdown，operations列operation_id、action、path、requirement_id、before_sha256、after_markdown、removed_scenarios和reason。ADDED无旧区段，MODIFIED提供完整替换，REMOVED明确全部移除场景；新文件需显式Purpose/Scope/Requirements头。

任务与delta归属在展示范围/设计/计划时一起核对；可以准备草案，真实确认后才实施。记录注册次序可先task再delta，全部关联齐全后再次spec check、获取最终definition摘要。不要把补写字段当新批准或把未确认变化自动改绑旧确认。政策/定义变化会使原计划确认失效，status/spec指出STALE_PLAN_CONFIRMATION；先进入verify并等待真实新计划确认，不能用refresh或新check替代批准。缺失必需证据仍不能进入验收。

## 检查与验收记录

v2 check通过check_type声明test_suite/command/observation。test_suite需实际命令、exit_code=0、test_count>=1；command需实际命令、exit_code=0、test_count=null；observation的三项执行字段均null，并给method/expected/actual与证据。所有必需类型和必测场景须有适用通过引用；失败或not_run/not_applicable不能充当通过，未执行给reason且exit_code/test_count=null。review的mode须与政策匹配，result=passed、must_fix_open=0，context_id定位真实上下文；simplified只用于低影响非业务，不能称独立审查。

候选artifacts共同包含实际产物、tasks definition及delta所在scope definition。确认、检查与审查引用相同当前内容；不绑定会变化的有效spec、state或生成记录。真实task_acceptance confirmation仍用purpose/result/artifacts/supersedes，不能把AI报告作为用户验收。

共用prepare/start/verify/await/confirm/closeout等语义动作沿state-runtime的data形状，operation_version取2；v2 record另支持spec_delta。record操作成功后使用返回revision继续，引用仍按path/record_id。待验收保持等待，明确confirm后才进入closeout。

## 同步与完成

验收后由主Agent运行：node .ai-workflow/bin/iterlane.mjs spec sync --iteration <本轮路径> --task <ID> --request-id <稳定ID> --expected-revision <实际n> --preview --json。预览的files列出全部计划写入，除规格外还可能包括需要更新的任务、验证、state，以及需要更新的.gitattributes管理区块和安装manifest；执行另外产生本地锁/日志。先核对全部路径、副作用是否在授权内，再核对验收及当前前像，去掉preview执行，正常重复请求保留原ID与原revision/内容，不能换内容复用。

工具只更新当前已验收任务的增量，返回operation_id、revision和sync_ref；state最后写。无业务变化也生成not_needed收据。同期不同任务改同文件，后一任务在前项收尾后基于真实新前像调整并重核对受影响确认，不自动重基线。

closeout记录增加sync_ref，specs与工具收据的synced/not_needed一致；complete引用closeout_ref并核对已提交同步日志。不要手工造spec_sync、改spec或用synced文字假报完成。Git收尾仍需原实际授权和适用方法。

中断用recover --resume或--undo，加准确operation-id与当前expected-revision；先preview再按原授权处理。后来修改、未知日志/锁及已登记写入后被删除的新文件保留并报告冲突；恢复原来待验收则仍等待，不重试部署。容量超过日志/目录限制会在业务写入前拒绝，处理范围后使用新的请求，不伪造恢复材料。
