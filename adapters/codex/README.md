# Codex 接入资源

首版聚焦 Codex。第3步采用原生AGENTS/Skills发现与路由，补项目导航及按需加载指导，不增加宿主hook。实际支持范围为本轮Windows/Codex CLI基线，结果见验证记录；未修改本机全局Codex或代理配置。

第0步已按D111在Windows原生Codex CLI 0.169.0上核验：原生skills/list发现11项项目技能，无解析错误；自然语言和显式入口各有一次完整只读结果，项目32文件摘要未变。但两次成功调用分别经历4次、9次流重连，另有一次90秒截止未完成。实验关闭hooks/plugins及多Agent，使用现有custom代理、请求模型gpt-6-astra/medium；不代表干净新机、桌面端或IDE已适配，也不证明安装器已实现。官方文档仍403，实际证据与限制见[接入设计](../../docs/design/integration.md#第0步环境与技术选择)及[验证记录](../../tests/README.md#第0步客户端与依赖核验)。

## 已确认布局

- `.agents/skills/<skill>/`：完整技能说明与来源许可。
- `.ai-workflow/`：公共资源、模板、脚本和版本信息。
- `AGENTS.md`：项目协作与导航。
- `docs/`：业务文档、迭代与状态。

两处框架资源共同管理版本；具体安装与路径解析见[接入设计](../../docs/design/integration.md#项目安装布局)。

## 当前使用与限制

- 第2步CLI已实现固定资源安装与项目内检查；第3步增加原生发现、路由和按需读取评测，实际结果与失败均保留，不能从安装成功推定客户端已通过。
- 可通过完整路径指示 Agent 读取[对应 Skill](../../skills/README.md)，用于指定项目和请求。
- 项目级放置保留整个技能目录，已有目标先核对，不直接覆盖。
- 客户端发现、调用及跨平台能力以[实际验证](../../tests/README.md)为准；文件放置不等于安装兼容已通过。
- 本仓库根 `AGENTS.md` 用于开发框架自身。

后续实现前核对[Skills 文档](https://developers.openai.com/codex/skills)、[AGENTS.md 指南](https://developers.openai.com/codex/guides/agents-md)和[插件构建文档](https://developers.openai.com/plugins/build/plugins)，并验证目标客户端。

本轮请求模型由用户固定为gpt-6.1-sol/medium，沿用custom代理。隔离客户端home不复制凭据文件；只在隔离配置停用用户/系统技能，项目技能保持启用并与合成项目技能共存。CLI原生发现不等于桌面端、IDE、其他平台或上游实际模型身份已验证。官方页面仍403的事实保留，实际机制以原生协议及运行事件取证。复现材料与限制见[第3步及联合校验](../../tests/README.md#第3步客户端接入与第23步联合校验)。
