---
name: workflow-guide
description: "用于采用Iterlane的项目，在请求开始/继续已有工作、定位当前成果、查询状态或处理工作流中断时。目标明确且无需工作流管理的独立拼写/排版不自动启用；显式点名时仍可使用入口。"
metadata:
  version: "0.3.3"
---

# 定位工作与按需交接

先定位本次请求和实际状态，再选择需要的方法；保持原主Agent的任务与记录责任。来源及完整许可见[NOTICE](NOTICE.md)。


先按当前请求选择流程深度：明确低影响内容直接处理，局部功能按影响展开，关键未知或高风险采用完整流程。需要判断时读[选择方法](references/common/routing.md)；显式调用也不默认加载所有参考。保留原任务等待、项目规则和实际权限。

## 先看当前需要

先核对项目AGENTS与明确目标；独立低影响文件请求直接处理。需要定位工作流状态时，使用[只读工具](references/common/runtime-query.md)查check/status；只问进度就报告当前成果、等待和下一步，不写入或加载整组技能。结果有歧义时读取相关业务记录，不从最大目录号、最近时间、草案或空占位猜当前任务。

推荐能力先看[能力映射](references/common/capabilities.json)和宿主可见的技能元数据；确定需要后才读提供者入口与当前动作的参考。能力ID不是原生技能名称，不启动第二套入口或调度服务。

| 当前情况 | 读取或交接 |
| --- | --- |
| 明确开始/继续、找下一候选，或位置冲突 | [定位方法](references/navigation.md) |
| 暂停、恢复、部分写入或外部结果未知 | [恢复与交接](references/recovery.md) |
| 需要判断规格、确认、检查或验收 | [工作契约](references/common/work-contract.md) |
| 接手、写记录或依赖真实工具 | [写入契约](references/common/write-contract.md) |

想法/方案交clarify或design_discussion，任务安排交planning；当前已获准成果交implementation，最小工程交foundation；专项检查、诊断、审查分别交testing、diagnosis、review。发布与线上问题分别交release、incident并核对该请求的实际授权。当前待验收就保留等待，不因“继续”先做下一任务。

## 实际记录与返回

新任务及验收后收尾按[v2规格与记录工具](references/common/spec-runtime.md)，既有v1记录按[原状态协议](references/common/state-runtime.md)；只在明确升级/回退请求时读[版本方法](references/common/version-runtime.md)。已有v1与未声明新政策的v2保持原默认；新任务按实际轻重声明验证政策。

固定包提供者或参考缺失用skills check报告实际资源/安装问题，宿主缺能力则保留受阻；不能以兜底掩盖坏依赖。专项带原请求、版本、权限、证据及caller，返回方法和实际结果，主Agent统一记录。
