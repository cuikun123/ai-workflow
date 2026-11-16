# 本地收藏示例

虚构个人收藏参考应用，使用Node24内置HTTP和文件系统：`GET /health`、网页列表/表单、`GET/POST /bookmarks`（兼容旧`/api/bookmarks`）、JSON持久化和文本标题显示。仅回环监听，不提供账号/云同步或生产部署方案。

示例已有功能测试和代码审查，实际范围见[验证记录](../../tests/README.md)。复制运行用于体验，不能替代新项目自身的需求确认与检查。

## 复制与运行

先在同一PowerShell按快速开始创建`$projectDir`，并保留`$releaseDir`变量。回到交付包解压目录，复制例子到这个明确的新项目；目录中尚无同名业务源码：

```powershell
Set-Location $releaseDir
$exampleDir = Join-Path $releaseDir 'examples/bookmarks'
Copy-Item -LiteralPath (Join-Path $exampleDir 'server.mjs') -Destination $projectDir
Copy-Item -LiteralPath (Join-Path $exampleDir 'package.json') -Destination $projectDir
Copy-Item -LiteralPath (Join-Path $exampleDir 'public') -Destination $projectDir -Recurse
Copy-Item -LiteralPath (Join-Path $exampleDir 'test') -Destination $projectDir -Recurse
Set-Location $projectDir
node server.mjs
```

终端打印`{"port":实际端口}`。在浏览器打开`http://127.0.0.1:<实际端口>/`，添加虚构标题和`https://example.com/`链接，预期列表新增一条；样例不主动请求输入网址。按Ctrl+C关闭服务后，在同一项目目录再运行`node server.mjs`，应保留相同`bookmarks.json`的数据。

健康入口是`http://127.0.0.1:<实际端口>/health`。启动失败以非零退出报告，坏存储或无效请求不覆盖旧数据；页面处理未知保存结果时先核对，列表仍无法读取会锁定提交，避免重复新增。

需要查看既有回归时，在项目目录显式执行：

```powershell
node --test --test-reporter=tap test/server.test.mjs test/linked-contract.test.mjs test/page-race.test.mjs
```

页面竞态测试使用 DOM 和 fetch 替身；真实浏览器检查另有记录。复制代码不会自动运行测试。

示例不复制旧项目的任务状态、批准或真实数据。新需求仍需澄清、规划、检查和用户验收；业务模板保持空白。整体 MIT 与 TY 署名见交付包 LICENSE。
