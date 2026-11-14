# 结构定义目录

约定供程序读取的数据字段、类型与允许值。D112第1步已新增[state v1](state-v1.schema.json)，使用JSON Schema 2020-12；`src/state.mjs`负责严格YAML及补充结构检查。

优先明确 state.yaml；有实际配置或结果格式后再建立相应结构定义，不为了填满目录预先制造格式。

D110已确认建立受校验的状态写入，D111已认可[state v1字段与转换](../docs/design/documents.md#第0步状态结构与转换)。当前只实现只读结构校验：`node bin/iterlane.mjs validate --state <file> --json`，拒绝未知字段、非法组合、重复键、别名/标签、多文档及不安全相对路径。状态转换、revision写入、外部引用与摘要核验仍未实现；schema通过不证明确认或验收真实。

结构定义约束表达，不限制框架能做哪些事情。新能力需要新字段时，应同步设计读取逻辑、兼容和迁移。

格式正确不能证明结果真实。业务文档主要使用 Markdown，不能把所有自然语言内容都塞进结构校验。

state v1结构示例位于[业务项目模板](../templates/project/docs/workflow/state.yaml)，不是本框架仓库的运行状态。初始化器生成实际UTC与basis，仅建立未开始书签；安装清单和初始化日志由工具严格校验，通用状态转换仍未实现。
