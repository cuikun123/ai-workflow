# 变更记录

## 未发布

### 2026-11-11

- D65独立审查收尾：修正CHANGELOG与路线图中的过时状态；clarify-design更新至0.1.5，明确计划调用方委托资料准备后返回同一规划，新增开轮并规划的隔离验证。审查及定向复查完成，实际验收状态继续单独记录。清理本轮重复测试技能副本，保留源码、最终样例和必要证据。
- D65成果B：clarify-design更新至0.1.4，workflow-guide至0.1.2，plan-tasks/execute-task至0.1.3；补普通后续开轮、暂停恢复记录、候选入轮关联、overview维护及相应交接。业务AGENTS模板仅补导航可能过时和确认依据核对，state模板不变；实际验证及待审查状态见tests/README.md和docs/handoff.md。
- D65成果A：workflow-guide更新至0.1.1，clarify-design和review-work更新至0.1.3，补后续目标的待办依据、方案/计划审查及包内地基交接；execute-task保留0.1.2，仅明确GSD补充的历史版本。当前版本集中展示于skills/README.md，历史版本保留。
- A交付时修复过时文档和章节指针，补隔离行为场景；当时B仅确认职责设计。用户随后明确允许继续B，当前实现及实际验证、验收状态见tests/README.md和docs/handoff.md，不由此补记A验收通过。
- 按 D64 新增 workflow-guide、build-foundation、release-work、handle-incident、discuss-design 0.1.0，原六项增强至0.1.2，统一交接、当前主责与验收规则。
- 固定 BMAD、GSD Core 与 Superpowers 选定来源及完整许可，新增隔离生命周期场景和装置检查；实际验证与限制见 tests/README.md。未安装、发布或进行 Git 写操作，用户验收待明确。

### 2026-11-09

- 六项现有 Skills 更新至 0.1.1，按 D62 对齐有效规则、本轮获准变更及目标版本；执行主 Agent 承接验收后对应业务规格的同步与中断恢复，其他能力明确交接边界。
- 同步既有设计、决策与接入状态说明；保留项目目录和两文件包。隔离场景、包检查及限制见 tests/README.md，未安装或发布。

### 2026-10-24

- 建立独立框架仓库和本地 Git 仓库。
- 保存目标、工作流、文档结构、规格格式、能力复用、接入、多 Agent 与 Git 讨论基线。
- 建立业务项目的空文档骨架、候选状态模板及资源目录说明。
- 当前没有可执行安装器、初始化器、独立 CLI 或已集成技能，不代表发布版本。
