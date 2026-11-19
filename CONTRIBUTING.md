# 贡献与维护

开始前先读[仓库协作规则](AGENTS.md)和[当前交接](docs/handoff.md)，弄清现在在做什么、哪些文件已有改动。已经定下的规则见[正式决定](docs/decisions.md)。

## 准备环境

- Windows 本地目录
- Node.js 24.18.0
- npm 11.16.0

在仓库根目录安装依赖：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
```

## 运行检查

```powershell
npm run ci
```

它会运行全部确定性测试，再构建并打包，结果保存在 `.artifacts/`。

- 有测试失败、取消、跳过或缺少必需测试，都算不通过。
- 新增必需的测试文件时，同步加到 `scripts/ci.mjs` 的清单里。
- CI 不调用真实模型。真实模型验证会产生费用，需要单独确定范围。

## 从源码构建工具包

```powershell
npm run build
node dist/bin/iterlane.mjs check --json
```

`dist/` 不进 Git，改了源码要重新构建。使用者不需要这些命令，他们按[快速开始](docs/quickstart.md)用 ZIP 安装。

## 修改时要做到

- **改行为**：先复现问题，再验证修复和它的影响范围。
- **改文档**：核对内容、链接和命令。给人看的文档按协作规则里的写作要求来写。
- **改来源或依赖**：核对固定版本、许可、依赖和写文件行为，保留 MIT、第三方许可和署名。
- **独立审查和用户验收**分开进行，分开记录。示例代码不写进业务模板，也不预先写好批准或检查结果。

实际变化在 [CHANGELOG](CHANGELOG.md) 写一行，测试方法和需要长期保留的证据写在[验证记录](tests/README.md)。

## Git 操作

提交、推送、创建远端、合入和发布都需要明确授权。具体步骤见 [Git 工作流](docs/design/git-workflow.md)。
