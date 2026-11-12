# Codex 接入资源

首版面向 Codex；预留入口映射、能力安装布局和工具特定说明。目前没有已实现适配器，也没有修改本机 Codex 配置。

目标是让核心流程和业务文档保持独立，避免无实际需要的抽象层。

已确认的业务项目布局及安装方式：采用方案一，将完整技能说明直接安装到 .agents/skills/<skill>/SKILL.md，.ai-workflow/ 保存公共框架资源、模板、脚本及版本信息，两处共同管理版本；根 AGENTS.md 提供项目协作说明与导航，业务资料沿用既定 docs/ 结构。详见 [接入设计](../../docs/design/integration.md#调查后确认的业务项目布局)。具体安装、资源定位、相对路径解析与跨平台验证仍待设计和执行。

后续实现前核对官方文档，并验证实际目标客户端：

- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/plugins/build/plugins

这些是调查入口，不是本仓库已完成安装兼容测试的证明。CLI、IDE 和其他客户端的具体能力需以实现时实际验证为准。

本仓库已有十一项[Skill源码及版本索引](../../skills/README.md)，其中 workflow-guide 提供方法级统一入口与恢复交接，可通过完整路径指示 Agent 读取用于指定业务项目。完整安装适配器和自动路由尚未实现。项目级放置需保留整个技能目录，真实客户端发现与调用的实际结果及限制见[框架验证](../../tests/README.md)。当前仓库根 AGENTS.md 仍用于开发本框架。
