# 框架技能

通常直接向项目里的 AI 说明需求，入口负责定位当前工作，并按任务影响选择直接、轻量或完整流程。也可以显式指定下列技能。

## 按需要选择

| 技能 | 用途 |
| --- | --- |
| [workflow-guide](workflow-guide/SKILL.md) | 开始、继续、查进度，定位当前任务并交接下一步 |
| [clarify-design](clarify-design/SKILL.md) | 澄清需求与方案，准备迭代资料和暂停恢复记录 |
| [discuss-design](discuss-design/SKILL.md) | 比较方案，从相关角度提出质疑和推荐 |
| [build-foundation](build-foundation/SKILL.md) | 建立最小可运行工程和基础约定 |
| [plan-tasks](plan-tasks/SKILL.md) | 将工作拆成可验收任务，明确依赖和检查方式 |
| [execute-task](execute-task/SKILL.md) | 实施、组织检查与审查、等待验收，完成适用的规格和 Git 收尾 |
| [test-work](test-work/SKILL.md) | 选择并执行测试和其他必要检查 |
| [debug-issue](debug-issue/SKILL.md) | 定位原因，在已有授权内修复并重验 |
| [review-work](review-work/SKILL.md) | 审查方案、计划或代码，核验反馈和复查修复 |
| [release-work](release-work/SKILL.md) | 准备或执行获准发布，核对结果和失败回退 |
| [handle-incident](handle-incident/SKILL.md) | 调查线上问题，优先恢复，再安排修复和返回原任务 |

## 使用边界

主 Agent 统一管理任务与正式记录，专项返回实际结果。确认方案、实施授权和用户验收分别判断；缺技能、参考或宿主工具时说明问题，不伪称调用。

明确的小改动按需读取，普通功能和 PR 保留适用的独立审查。Git、部署和数据操作需要项目自身的工具及授权。

## 资源与维护

`SKILL.md` 保存入口和参考读取条件，详细方法位于 `references/`，共享来源维护在 `_shared/`。构建生成各包的 `references/common/` 及摘要索引；单项交付使用构建后的完整目录，运行功能仍需完整 Iterlane 安装。

`skills check --json` 检查引用、依赖和共享摘要，缺文件或内容漂移会报错。技能版本取自各包的 `metadata.version`；来源与许可见 `NOTICE.md`。方法说明不代表宿主能力已具备。

安装见[快速开始](../docs/quickstart.md)，检查范围见[验证记录](../tests/README.md)，适配方法见[能力设计](../docs/design/capability-reuse.md)。
