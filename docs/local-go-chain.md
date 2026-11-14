# 本地前端 → Node.js → Go → PostgreSQL

2026-11-14 已完成真实浏览器、真实 GitHub API 和本地 PostgreSQL 的整条链路验收。
Go 位于独立仓库 `mengtaojob/aws-github-search-go`。

## 模式与边界

- 未设置 `GO_API_BASE_URL`：保持原 Node.js 业务及存储实现。
- 设置 `GO_API_BASE_URL=http://127.0.0.1:8080`：Node.js 校验访问令牌、来源、请求体大小和 CORS，再转发业务请求给 Go。
- Go 执行 GitHub 查询、参数校验、收藏增删改查；Node.js 不再访问自己的业务存储。
- Go 故障时返回 502/504，不自动切回旧存储，不自动重试写请求。
- 只转发已声明的业务路由。客户端不能选择上游地址；访问令牌、Cookie、Origin 等不会转发给 Go。
- `GO_API_BASE_URL` 只在服务端设置，不能添加 `NEXT_PUBLIC_` 前缀。
- 本阶段 Go 仅监听回环地址，没有配置云端 IAM、私有 DNS、容器或 WAF。

## 启动三个进程

先在原项目目录执行 `docker compose up -d postgres`，确认数据库 healthy。
以下每组命令放在一个独立 PowerShell 中运行。

### 1. Go（8080）

```powershell
Set-Location D:\PROJECT\yd-project\code\aws-github-search-go
$env:DATABASE_URL = 'postgresql://github_app:local_dev_password@127.0.0.1:5432/github_search?sslmode=disable'
go run ./cmd/api
```

若本机访问 GitHub 需要现有代理，在启动 Go 前按实际端口设置：

```powershell
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'
$env:NO_PROXY = 'localhost,127.0.0.1'
```

### 2. Node.js 网关（3001）

```powershell
Set-Location D:\PROJECT\yd-project\code\aws-github-search
$env:GO_API_BASE_URL = 'http://127.0.0.1:8080'
$env:API_SECRET_ARN = ''
$env:API_ACCESS_TOKEN = ''
$env:HOST = '127.0.0.1'
$env:PORT = '3001'
node --import tsx src/server.ts
```

这里直接启动 Node.js，不加载原 `.env`，避免继承云端 API Secret 或数据库配置。
清空令牌仅用于本机回环地址联调。正式 Lambda 仍必须启用原有访问令牌校验。

### 3. 前端（3000）

```powershell
Set-Location D:\PROJECT\yd-project\code\aws-github-search
$env:NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3001'
npm run dev:web
```

访问 `http://127.0.0.1:3000`。前端继续调用 Node.js，不直接请求 Go。

## 验证来源

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

健康接口应包含 `backend=go`、`service=go-api`、`storage=postgres`。
业务响应头 `X-OctoShelf-Backend: go` 也可用于核对转发模式。

在三项服务均启动、未设置本地访问令牌、原项目本地数据库中不存在 octocat 收藏时，可执行：

```powershell
npm run test:e2e:go
```

这是单独启用的真实集成验收，不属于原有模拟 UI 测试，也不会随普通 CI 自动访问真实 GitHub。
端点固定为本机 3000/3001，数据库固定为本机 5432；不会请求线上 API 或 RDS。
验收先确认 Go 模式，再检查 octocat 尚不存在；只新增、修改、删除本次创建的记录。
失败时也尝试通过本地 API 清理本次记录。

## 实际验收结果

- 网页搜索 octocat，查看完整档案：成功，响应来自 Go。
- 在档案弹窗收藏：201；修改中文备注和标签：200。
- 独立 SQL 查询确认备注与标签已写入；重复标签由 Go 去重。
- 刷新页面、重新打开收藏档案：修改内容保留。
- 切换列表视图，通过删除确认弹窗移除本次收藏：204。
- 验收前后全部原有记录的排序内容摘要一致，原有 4 条收藏保持完整。
- 浏览器截图与测试输出位于被忽略的 `test-results/go-chain/`，未上传原有用户资料。

电脑操作插件因无法可靠识别当前 Chrome 地址而停止，该 Chrome 窗口未被继续操作。
本次网页验收使用独立 Playwright Chromium，不使用或复制 AWS 登录会话。

## 发布说明

这次功能默认关闭 Go 转发，因此推送代码本身不会把线上请求切到本机 Go。
原 main 分支自动发布流程可能照常发布兼容代码；线上仍使用原有 Node.js 业务和 RDS。
后续 Go 上云后，再为 Lambda 配置 Cloud Map 私有地址，验证完成后切换模式。
