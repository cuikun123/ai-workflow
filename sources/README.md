# 来源与许可

| 查什么 | 去哪里 |
| --- | --- |
| 上游候选、采用范围和核对状态 | [catalog.yaml](catalog.yaml) |
| 每项 Skill 的职责与版本 | [能力索引](../skills/README.md) |
| 固定文件、摘要、改造、依赖与完整许可 | 各 Skill 的 `NOTICE.md` |

全部是选定方法的适配，不表示整个上游运行时已集成。部署回退和线上调查前置来自本框架规则，不冒称上游部署能力。

运行依赖采用锁定版本的 yaml、Ajv 及其传递依赖，esbuild 仅用于构建。版本、完整性和完整许可随工具包的 `dependency-manifest.json`、`THIRD_PARTY_NOTICES.md` 保留。OpenSpec的完整许可见[openspec-NOTICE.md](openspec-NOTICE.md)。

来源条目中的仓库文件、检查位置和开发过程指向框架源码，不表示这些维护资料已安装到业务项目。来源摘要用于核对一致性，不是来源签名或用户验收证明。
