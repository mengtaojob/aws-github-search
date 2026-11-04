# OctoShelf · AWS GitHub 开发者收藏夹

一个从 GitHub 搜索到数据库持久化的全栈课程项目。搜索真实开发者，收藏完整档案，编辑个人备注和标签，在 Android 端查看同一份收藏。

前端为 Next.js + React + TypeScript，后端为 Hono + TypeScript。**本地 HTTP 服务与 AWS Lambda 共享业务代码**，无需把业务逻辑在两个环境分别维护。

## 先在 Windows 跑起来

需要 Node.js 22.13+（推荐 Node.js 24 LTS）。不需要 AWS CLI、Docker、AWS 凭证或 GitHub Token。

```powershell
Set-Location D:\PROJECT\yd-project\code\aws-github-search
npm ci
npm run dev
```

打开 **http://127.0.0.1:3000**。API 在 **http://127.0.0.1:3001**。

1. 点击 `torvalds` 示例词，或输入用户名搜索。
2. 点击「加入收藏」。服务端从 GitHub 拉取完整资料后保存。
3. 在「我的收藏」中编辑备注、标签，按名字/备注/标签筛选，或移除收藏。
4. 重启服务后收藏仍在，文件位于 `.data/users.json`（已被 Git 忽略）。

默认存储是本地 JSON 文件，适合单进程学习和演示。它**不是数据库验收的替代品**。完成数据库要求请切换 PostgreSQL，云端使用同协议的 Aurora PostgreSQL。

本地真实 GitHub 搜索界面：

![桌面端真实搜索截图](docs/screenshots/desktop-search.png)

可选配置：

```powershell
Copy-Item .env.example .env
# 在编辑器中修改 .env，然后重启 npm run dev。
```

`GITHUB_TOKEN` 只在后端读取，用于提升 GitHub 请求额度。不要添加 `NEXT_PUBLIC_` 前缀，不要将 Token 提交 Git。

## 已实现功能

- GitHub 用户搜索、分页、详情、上游错误和限流提示。
- 收藏增删改查、重复保护、备注和标签、搜索过滤。
- 桌面/手机响应式界面、网格/列表视图、加载/空/错误状态、删除确认。
- 文件存储与 PostgreSQL 两种实现；PostgreSQL 查询使用参数绑定。
- Node.js 24 / arm64 Lambda 构建，HTTP API v2 适配。
- SAM/CloudFormation：VPC、分层子网、NAT、IGW、Aurora、Lambda、HTTP API、Secrets Manager、S3、CloudFront、可选跳板机。
- GitHub Actions：测试、构建、数据库集成测试、浏览器测试、可选代码发布。
- Expo/React Native Android 展示端：连接配置、收藏列表、备注/标签筛选、下拉刷新、打开 GitHub。

云资源、GitHub 仓库和 Android APK 尚需在各自账号/设备中部署或构建；生成代码不代表这些云端步骤已执行。

## 项目目录

```text
app/                         Next.js 页面与样式，静态导出
public/                      SVG 站点图标
src/
  app.ts                     共享 HTTP 路由、校验、鉴权和错误处理
  github.ts                  GitHub API 调用与响应校验
  store.ts                   本地文件存储、存储选择
  store-postgres.ts          PostgreSQL/Aurora 存储
  secrets.ts                 后端 Secrets Manager 读取与短时缓存
  server.ts                  本地 API 入口
  handler.ts                 Lambda 入口
  types.ts                   共享类型
database/001_initial.sql      幂等建表 SQL
infrastructure/              云资源与 GitHub OIDC 模板
scripts/                     构建、迁移、冒烟验证
tests/                       单元/接口、PostgreSQL、浏览器测试
mobile/                      Expo Android 展示端
.github/workflows/           CI 与可选 CD
docs/                        部署、实现说明、验收清单
compose.yaml                 可选本地 PostgreSQL
```

## 架构

```mermaid
flowchart LR
  Browser[浏览器] --> CDN[CloudFront]
  CDN --> S3[S3 · Next.js 静态导出]
  Browser -->|HTTPS + 项目令牌| API[API Gateway HTTP API]
  Mobile[Android App] -->|相同 API| API
  API --> Lambda[Lambda · Hono / Node.js]
  subgraph VPC[同一个 VPC]
    Lambda -->|内网 5432| DB[Aurora PostgreSQL · 隔离子网]
    Lambda --> NAT[NAT · 公有子网]
    Bastion[EC2 跳板机 · SSM] -->|内网 5432| DB
  end
  NAT --> IGW[IGW]
  IGW --> GitHub[GitHub API / AWS 公共服务端点]
  Admin[管理员电脑] -->|SSM 端口转发| Bastion
  Actions[GitHub Actions] -->|OIDC 临时身份| Deploy[更新 Lambda / S3 / CloudFront]
```

这里没有采用参考漫画里的 Cloudflare Worker；前端静态资源也托管在 AWS。业务访问数据库直接走 VPC 内网，跳板机只用于管理员运维。

## 使用 PostgreSQL

先启动 Docker Desktop，再执行：

```powershell
docker compose up -d
Copy-Item .env.example .env  # 已有 .env 时请直接编辑，不覆盖个人配置
```

在 `.env` 中设置：

```dotenv
STORE_DRIVER=postgres
DATABASE_URL=postgresql://github_app:local_dev_password@localhost:5432/github_search
DATABASE_SSL=false
```

```powershell
npm run db:migrate
npm run dev
```

Compose 首次创建数据卷时会初始化表；`db:migrate` 可重复执行。切换存储不会自动迁移 `.data/users.json` 里的收藏。`DATABASE_SSL=false` 只用于本地 PostgreSQL，云端校验 RDS CA 证书。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/health` | 服务进程/配置状态，不验证数据库连通性 |
| GET | `/search/users?q=torvalds&page=1` | 搜索，每页 12 条 |
| GET | `/github/users/torvalds` | GitHub 完整用户资料 |
| GET | `/users` | 已收藏用户，按收藏时间倒序 |
| POST | `/users` | 保存，JSON：`{"login":"torvalds"}` |
| PATCH | `/users/1024025` | 修改，JSON：`{"note":"Linux","tags":["系统编程"]}` |
| DELETE | `/users/1024025` | 移除，成功返回 204 |

```powershell
Invoke-RestMethod 'http://127.0.0.1:3001/search/users?q=torvalds'
Invoke-RestMethod 'http://127.0.0.1:3001/users' -Method Post -ContentType 'application/json' -Body '{"login":"torvalds"}'
```

返回常见状态：400 参数错误、401 项目令牌错误、404 不存在、409 重复收藏、413 请求体过大、429 GitHub 限流、502 上游异常、504 上游超时。403 也可能是 GitHub 限流或访问限制。

GitHub 搜索数量实时变化，不应断言固定总人数。搜索最多访问前 1,000 个匹配结果。

云端 API 使用 Secrets Manager 生成的**项目共享访问令牌**。它用于私人课程演示，不是多用户登录系统；持有令牌的访问者共享同一份收藏并可修改。网页令牌保存在当前标签页 sessionStorage，Android 端只在内存保存。

## 测试与构建

```powershell
npm run typecheck
npm test
npm run infra:check
npm run build
npx playwright install chromium
npm run test:e2e
```

- `npm test`：模拟 GitHub 响应，验证真实路由/校验/鉴权和临时文件存储，不访问 AWS。
- `test:e2e`：桌面和手机尺寸下验证 UI 工作流；浏览器网络边界使用固定测试数据，不将测试用户写入你的收藏。
- `npm run smoke`：请求真实 API，检查 `torvalds` 和缺失参数，不写入收藏。可用 `API_BASE_URL` 切换目标，用 `API_ACCESS_TOKEN` 认证。
- `npm run build:web`：生成 `out/`，可托管到 S3。
- `npm run build:lambda`：生成 `dist/lambda/index.mjs`，handler 为 `index.handler`，同时下载 AWS RDS CA 证书；这一步需要联网。

数据库集成测试使用专用测试库，不能指向个人或云端正式库：

```powershell
docker compose exec postgres createdb -U github_app github_search_test
$env:DATABASE_URL='postgresql://github_app:local_dev_password@localhost:5432/github_search_test'
$env:DATABASE_SSL='false'
$env:ALLOW_TEST_DATABASE='true'
npm run test:postgres
Remove-Item Env:DATABASE_URL, Env:DATABASE_SSL, Env:ALLOW_TEST_DATABASE
```

GitHub CI 自带独立 PostgreSQL 容器，运行同一集成测试。

## 后续操作

- [AWS 部署、费用影响与资源清理](docs/aws-deployment.md)
- [Android 运行与 APK 构建](mobile/README.md)
- [设计取舍与核心概念](docs/implementation.md)
- [课程验收清单](docs/acceptance.md)
- [实际验证结果与尚未验证的环境](docs/verification.md)

现有 `github-user-search` 和 `github-search-api` 保持独立。新模板默认使用 `octoshelf-course` 项目前缀和单独 Stack，不需要重新创建或替换旧资源。
