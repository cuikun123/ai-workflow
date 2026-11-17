# 本地收藏示例

这是一个虚构的个人收藏应用，用 Node.js 内置 HTTP 和文件系统实现列表、添加、健康检查及 JSON 持久化。只监听本机回环地址，没有账号、云同步或生产部署配置；示例不预置业务批准或用户验收。

## 从试用包创建示例项目

在试用 ZIP 解压目录打开 PowerShell，指定一个新的空目录：

```powershell
mkdir bookmark-demo
node runtime/bin/iterlane.mjs init --example bookmarks --project bookmark-demo --preview --json
node runtime/bin/iterlane.mjs init --example bookmarks --project bookmark-demo --json
cd bookmark-demo
```

先核对预览的目标和文件，再执行安装。默认不加 `--example` 的初始化只创建空业务骨架。

## 在示例项目运行

```powershell
node scripts/check.mjs
node server.mjs
```

检查脚本真实运行应用测试，在 `evidence/checks/` 的独立目录保存原始测试输出和结果；成功会打印 `passed:true` 及实际测试数。源码示例目录也可直接运行这两条命令。

服务打印实际端口，在浏览器打开对应的 `http://127.0.0.1:<端口>/`。添加一个虚构标题和 `https://example.com/` 链接，刷新后应仍在列表；按 Ctrl+C 结束并重新启动，收藏数据仍保存在 `bookmarks.json`。样例不会主动请求输入的网址。

坏存储或无效请求不会覆盖旧数据；健康入口为 `/health`。页面竞态的自动测试使用 DOM/fetch 替身，不能代替真实浏览器验证。新增真实需求仍需自身的方案、检查和验收。

示例运行产生的数据和证据不会进入框架分发包。整体采用 MIT，TY 署名与完整许可随试用包保留。
