# 查询与恢复入口

完整Iterlane新项目安装才提供以下工具；单个Skill文件不带运行时。先核对项目AGENTS和实际入口。

| 当前需要 | 命令 |
| --- | --- |
| 资源及公共参考是否完整 | node .ai-workflow/bin/iterlane.mjs check --json |
| 当前任务、等待与revision | node .ai-workflow/bin/iterlane.mjs status --json |
| 当前规则与地基原文/摘要 | node .ai-workflow/bin/iterlane.mjs context inspect --json |
| 来源是否仍匹配已读摘要 | node .ai-workflow/bin/iterlane.mjs context guard --expected-snapshot <实际摘要> --json |
| 规格、ID、场景、声明增量及摘要 | node .ai-workflow/bin/iterlane.mjs spec check --json |
| 指定任务的上述依据 | node .ai-workflow/bin/iterlane.mjs spec check --iteration docs/iterations/<本轮> --task <ID> --json |
| 能力映射与共享资源 | node .ai-workflow/bin/iterlane.mjs skills check --json |
| 本地故障类别、日志和锁 | node .ai-workflow/bin/iterlane.mjs doctor --json |
| 业务文件可引用的实际摘要 | node .ai-workflow/bin/iterlane.mjs artifacts inspect --path <相对文件> --json |

查询不写文件、不修复或推进任务。status/check的结果仍结合真实记录判断；doctor退出0仅表示诊断完成，local_valid和findings表达健康情况。网络/客户端失败不等于安装损坏。

用户明确要求检查客户端连接时，运行 `node .ai-workflow/bin/iterlane.mjs doctor --client --json`。它调用现有 Codex 客户端，核对技能发现与真实只读状态命令；可用 `--client-cli <入口>` 指定客户端。只在明确请求时探测，不更改登录、模型或全局配置；失败看 client.failure，框架不重试。默认doctor仍只检查本地。

发现待验收则报告等待；发现错误读必要证据，缺资源与状态/业务变化分开。原生recover依准确operation-id/revision及匹配来源处理，不自动重试业务动作。v2收尾读[规格工具](spec-runtime.md)，保留v1/v2业务记录的v3状态写入读[state-runtime](state-runtime.md)，版本变化仅在明确请求时读[版本方法](version-runtime.md)。
