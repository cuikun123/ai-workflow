---
name: clarify-design
description: "用于目标、业务预期或关键方案不明，需要澄清比较；也用于明确开轮、暂停恢复资料或已确认的项目概览维护。已有明确可执行的小修改不重新澄清整套需求。"
metadata:
  version: "0.3.1"
  capability: "clarify"
---

# 澄清范围与方案

保持当前请求与原主Agent的任务来源，返回可查结果和缺项。来源及原完整许可见[NOTICE](NOTICE.md)。


先按当前请求选择流程深度：明确低影响内容直接处理，局部功能按影响展开，关键未知或高风险采用完整流程。需要判断时读[选择方法](references/common/routing.md)；显式调用也不默认加载所有参考。保留原任务等待、项目规则和实际权限。

## 定位与边界

先核对真实项目、请求模式、目标版本和已有授权；已确认且仍适用的依据直接复用。只读/讨论不扩大为写入或实施；当前待验收仍等待。信息缺失只补查必要部分，不猜当前轮、重建需求或为讨论强制创建项目。

涉及要求、候选、证据或验收时读[工作契约](references/common/work-contract.md)；接手、委派、写资料或执行有副作用动作时读[写入契约](references/common/write-contract.md)。查询、诊断或核对revision时读[工具入口](references/common/runtime-query.md)，其他方法只按当前动作加载。

## 按需读取

| 当前需要 | 参考 |
| --- | --- |
| 需要厘清需求、比较方案或准备设计时 | [专项方法](references/clarification.md) |
| 明确开轮、暂停恢复或维护overview时 | [迭代与状态](references/iteration-records.md) |
| 新任务的ID、增量、候选摘要、检查/验收或规格收尾 | [v2记录与规格工具](references/common/spec-runtime.md) |
| 维护已有v1机器记录 | [原状态协议](references/common/state-runtime.md) |

需要其他专项时按[能力表](references/common/capabilities.json)定位实际提供者，带原要求、版本、允许操作、已有证据和caller返回位置；不递归重启入口或伪称调用。完整包缺提供者/参考先用skills check报告，宿主缺能力如实保留受阻。

## 返回

说明实际改动或判断、检查结果、必须处理项和下一步，回原caller；正式状态及用户验收由主Agent统一维护。新任务记录及验收后规格更新使用已安装v2工具，不手写收据或state。新v2任务按实际轻重和已确认验证政策执行；旧默认保留完整检查，低影响简化核对不取消普通功能或PR独立审查。
