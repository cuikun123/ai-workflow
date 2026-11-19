# 本地收藏示例

一个虚构的个人收藏应用：能添加收藏、查看列表，数据保存在本地 JSON 文件里。只用 Node.js 自带的功能，不需要安装依赖。

它只监听本机地址，没有账号、云同步和部署配置。

## 1. 创建示例项目

和[快速开始](../../docs/quickstart.md)一样，示例项目要和安装工具放在不同的文件夹。下面假设安装工具解压在 `D:\Code\Iterlane`，示例放在 `D:\Code\bookmark-demo`。在 PowerShell 运行：

```powershell
mkdir "D:\Code\bookmark-demo"
node "D:\Code\Iterlane\runtime\bin\iterlane.mjs" init --example bookmarks --project "D:\Code\bookmark-demo" --preview --json
node "D:\Code\Iterlane\runtime\bin\iterlane.mjs" init --example bookmarks --project "D:\Code\bookmark-demo" --json
cd "D:\Code\bookmark-demo"
```

第二条是预览，确认目标目录正确后再运行第三条。不加 `--example` 时，安装的是空项目。

## 2. 运行检查

```powershell
node scripts/check.mjs
```

它会运行应用自带的测试。成功时输出里有 `"passed":true` 和实际测试数，原始输出保存在 `evidence/checks/` 下。

## 3. 启动应用

```powershell
$env:PORT = 3000
node server.mjs
```

终端打印 `{"port":3000}` 后，在浏览器打开 `http://127.0.0.1:3000/`，然后：

1. 添加一条收藏，例如标题随便写，地址填 `https://example.com/`。
2. 刷新页面，收藏还在。
3. 在终端按 Ctrl+C 停止，再运行 `node server.mjs`，刷新页面，收藏仍然在。数据保存在 `bookmarks.json`。

不设 `PORT` 时，每次启动都会随机选一个端口。这时以终端打印的端口为准，重启后要用新端口打开。

应用不会访问你输入的网址。健康检查地址是 `/health`。

## 需要知道的

- 存储文件损坏或请求无效时，不会覆盖已有数据。
- 页面并发相关的测试用的是模拟的浏览器环境，不能代替在真实浏览器里试。
- 示例运行时产生的数据和检查记录不会进入框架安装包。

## 接下来

带示例安装的项目里，还没有任何任务、批准或验收。想在示例上继续开发，先让 AI 核对项目状态，再一起确定新任务的范围和方案。完整流程见[使用指南](../../docs/usage.md#跟着一个例子走完开发)。

示例采用 MIT 许可，TY 署名。
