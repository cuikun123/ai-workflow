---
name: execute-task
description: "用于已有获准迭代任务的实施、恢复或验收反馈修复。独立且明确的低影响文案、只读请求不自动加载完整执行方法；仅规划、独立诊断/审查和部署请求由对应方法处理。"
metadata:
  version: "0.3.3"
  capability: "implementation"
---

# 执行当前已获准任务

推进当前可验收成果，组织必要检查、真实独立审查和反馈修复，交用户验收后完成对应收尾。来源及原完整许可见[NOTICE](NOTICE.md)。


先按当前请求选择流程深度：明确低影响内容直接处理，局部功能按影响展开，关键未知或高风险采用完整流程。需要判断时读[选择方法](references/common/routing.md)；显式调用也不默认加载所有参考。保留原任务等待、项目规则和实际权限。

## 先定位

核对项目AGENTS、当前任务与实际代码；已有适用计划和授权直接推进普通步骤。查询只核对并报告，待验收保持等待，暂停/阻塞按原记录恢复。缺范围或目标版本时只补查必要依据，不猜最新目录、重开迭代或越过下一任务。

完整安装可用[只读查询](references/common/runtime-query.md)取得当前位置与问题。涉及候选、证据或验收，读[工作契约](references/common/work-contract.md)；接手、委派、写记录或执行外部动作，读[写入契约](references/common/write-contract.md)。同一轮内容不变可复用，不默认加载其他能力全文。

## 按当前动作读取

| 当前动作 | 需要读取 |
| --- | --- |
| 实施、恢复执行、修复反馈 | [实施方法](references/implementation.md) |
| 组织独立审查、关闭发现、交付验收 | [审查与验收](references/review-and-acceptance.md) |
| 已获准Git保存、集成、合入或清理 | [Git方法](references/git-workflow.md) |
| 新任务的v2输入、摘要、验收后规格同步 | [规格与记录工具](references/common/spec-runtime.md) |
| 已有v1任务的结构化状态写入 | [原状态协议](references/common/state-runtime.md) |

需要testing、diagnosis、review、foundation等专项时，按[能力表](references/common/capabilities.json)定位已安装提供者，带同一候选与原授权，结果返回当前caller。缺固定资源用skills check核对并报告，不能以兜底掩盖包损坏；升级/发布/线上问题分别沿原请求，不从执行授权推定。

## 交付与收尾

主Agent统一tasks、verification与状态，专项只返回结果。交付说明给实际成果、能看到的结果、检查与未确认项，必要检查不重复转交用户。明确验收后用spec sync预览并同步本任务，引用工具收据完成closeout；重复请求沿原内容，中断按准确操作恢复。新v2任务按已确认验证政策检查；普通功能与PR独立审查要求保持，低影响简化核对不冒称独立审查。
