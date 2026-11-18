# Codex 接入

使用项目级 AGENTS.md 和原生技能发现机制，让 Agent 定位工作、按需读取方法；不增加宿主 hook，也不要求修改全局模型或代理设置。

## 项目布局

- `.agents/skills/`：技能入口、参考与来源许可。
- `.ai-workflow/`：运行工具、资源和版本信息。
- `AGENTS.md`：项目约定与导航。
- `docs/`：需求、迭代、验证和状态资料。

通过[快速开始](../../docs/quickstart.md)安装后，打开项目根目录并创建新会话。通常直接提出需求即可，也可显式调用 `$workflow-guide`；完整操作示例见[使用指南](../../docs/usage.md)，技能说明见[能力索引](../../skills/README.md)。

已验证 Windows 上的 Codex CLI，以及维护者选定的桌面客户端入口。安装成功与客户端实际调用分别检查；其他平台、桌面端或 IDE 分支不能据此推定可用。实际结果及链路失败见[验证记录](../../tests/README.md)。

适配目标客户端时核对官方[Skills](https://developers.openai.com/codex/skills)和[AGENTS.md](https://developers.openai.com/codex/guides/agents-md)说明；协议细节见[接入设计](../../docs/design/integration.md)。
