# 确定性工具操作

构建、校验与第2步初始化工具的入口为`bin/iterlane.mjs`。

- `npm run build`：打包运行依赖和完整Skills、模板、schema、来源及第三方许可，生成`dist/resource-manifest.json`。
- `npm run ci`：运行所有测试，核对20个必测文件的非空成功汇总，拒绝失败、取消、跳过和todo；构建后保存真实npm包、SHA-256及测试事件到`.artifacts/`。汇总实现为`check-results.mjs`。
- `npm run check -- --json`：只读核对当前`dist/`；也可`node bin/iterlane.mjs check --package <dir> --json`，目标必须与本运行时的包身份和schema一致。
- `node bin/iterlane.mjs validate --state <file> --json`：只检查严格YAML和state v1结构。
- `node bin/iterlane.mjs init --project <dir> [--preview | --repair | --resume | --undo] --json`：固定包初始化、只读预览、同版本显式补缺及未完成初始化恢复；项目根须存在，模式互斥。
- `node bin/iterlane.mjs check --project <dir> --json`：只读安装清单、区块、进度引用最低存在性和状态结构检查；安装版默认检查自己的项目。

构建可指定`node scripts/build.mjs --out <dir>`，只替换已通过检查的同类资源包，拒绝覆盖非包目录和源码祖先。分发包及项目内运行工具无需npm、全局依赖和源码。初始化日志/临时文件和nonce/PID锁支持有限恢复；通用状态写入/恢复、升级和断电绝对保证不在当前能力中。

dev.3初始化管理`AGENTS.md`、`.gitignore`和`.gitattributes`三个区块。attributes仅关闭指定框架/状态/初始化依据路径的Git文本转换，区块缺失需显式repair，改动或坏标记拒绝；前像摘要区分不存在与已存在空文件，恢复前核对。不改全局Git配置，不自动迁移旧开发版本。

实现方向：

- 与 AI 方法分离，使用明确项目根目录和显式参数。
- 保护已有内容，重复执行不丢进度，冲突与错误明确返回。
- 资源路径不绑定开发者电脑。
- 输出便于 AI 和未来 CLI 调用与验证。
- 初始化、升级、Git 提交和推送各自遵循已确定的授权范围。

框架采用Node 24/JavaScript ESM，精确依赖及完整性见根锁文件，第三方许可随构建保留。退出码：0成功，2参数无效，3环境不支持，4资源包或依赖损坏，5状态无效，6读写/构建失败，7冲突，8安装未完成或无法安全恢复。首个业务验证方向Java、React、MySQL与框架实现语言无关。
