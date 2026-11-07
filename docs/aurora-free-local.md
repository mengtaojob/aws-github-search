# 本地网页连接 Aurora Express

云端数据库已由用户创建为 `octoshelf-free-db`，数据库 `github_search` 和表 `github_users` 已通过 CloudShell 初始化。本路径使用 Free plan 下的 Aurora Express，与原 VPC 内数据库模板是两种架构；仍不满足原课程同 VPC 的网络要求。

## 当前配置与启动

根目录 `.env` 已改为 IAM 模式。原有本地配置备份在 `.env.local-postgres.backup`，两份文件都被 Git 忽略。

核心配置如下，DB_HOST 使用你实际创建的集群端点：

```dotenv
STORE_DRIVER=postgres
DB_AUTH=iam
DB_HOST=your-cluster.ap-southeast-2.rds.amazonaws.com
DB_USER=postgres
DB_NAME=github_search
DB_PORT=5432
DATABASE_SSL=true
AWS_PROFILE=aws-course
AWS_REGION=ap-southeast-2
```

`DB_AUTH=iam` 时，本地 DATABASE_URL 不参与连接。IAM 临时令牌由 AWS SDK 在每次新建连接时生成，不需要手动粘贴，不保存到文件。连接使用 TLS 并校验服务器证书；Express 使用公开可信的证书。

在项目根目录执行：

```powershell
aws login --profile aws-course
npm run db:check
```

`db:check` 只读数据库名、用户名和收藏数量，不写数据。检查通过后，在运行开发服务的终端 Ctrl+C，再执行 `npm run dev`。这一步必须重启后端，以加载新配置。

网页里之前的本地收藏不会自动复制到云端。刷新后搜索 torvalds 并重新收藏，编辑备注后，在 CloudShell 连接 github_search，执行：

```sql
SELECT profile->>'login' AS login, note, tags FROM github_users;
```

表中出现新收藏和备注，即证明本地网页通过本地 API 写入了云端 Aurora。

验证后退出 CloudShell 数据库连接（`\q`）。本地连接池会回收闲置连接；闲置连接关闭有助于满足数据库自动暂停条件，不代表存储等费用停止。

## 本次验证

- 本地 AWS SDK 使用 aws-course 登录配置，成功通过 IAM + TLS 连接云端。
- 返回 database=github_search、username=postgres、收藏数量 0。
- 只读验证没有修改任何收藏。
- 新增 IAM 配置测试后，36 项测试通过；TypeScript 和 Lambda 打包通过。
- 后端仍在本机运行，尚未将这一版本发布至 Lambda。

## 回到本地 Docker 数据库

```powershell
Copy-Item .env.local-postgres.backup .env
```

然后重启开发服务。恢复配置不会删除云端或本地数据库中的记录。

## 登录过期

网页报错时可在终端执行 `npm run db:check` 查看具体连接错误。若 AWS 登录过期，重新执行 `aws login --profile aws-course` 并重启开发服务。不要把 IAM 临时令牌当作长期密码。
