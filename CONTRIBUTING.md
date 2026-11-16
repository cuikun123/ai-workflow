# 贡献与维护

维护框架前，先读[协作规则](AGENTS.md)和[交接](docs/handoff.md)，核对工作范围与实际修改。规则依据见[正式决定](docs/decisions.md)。

## 开发与检查

使用 Windows 本地目录、Node.js 24.18.0 和 npm 11.16.0，在仓库根执行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run ci
```

CI 运行确定性检查、构建和打包，结果保存在 `.artifacts/`。新增必要测试时同步更新 `scripts/ci.mjs`；缺项、失败、取消或跳过均不能作为通过。真实模型验证有成本，需另外指定范围，CI 不自动调用模型。

行为修改应复现问题、验证修复及其影响；资料修改核对内容、链接和命令。独立审查与用户验收分别完成，示例不写入业务模板，也不预造批准或检查结果。

来源和依赖变更核对固定版本、许可、依赖及写入行为，保留 MIT、第三方许可和署名。主要变化写入 CHANGELOG，详细结果归[验证记录](tests/README.md)。

提交、推送、创建远端、合入或发布需要对应授权；具体步骤见[Git 工作流](docs/design/git-workflow.md)。消费者安装见[快速开始](docs/quickstart.md)，无需运行源码开发命令。
