# 从 Aurora Express 切换到 VPC 内的 RDS PostgreSQL

## 已完成的准备

- RDS 实例：`octoshelf-rds-db`，数据库 `github_search`。
- VPC：`vpc-08c92e15230b346a1`，数据库关闭公共访问。
- EC2 跳板机已连接数据库，旧收藏已导入（包含备注、标签、创建和更新时间）。
- 网络堆栈：`octoshelf-rds-network`，模板 `infrastructure/rds-network.yaml`。
- 两个 Lambda 私有子网使用一个公共 NAT，经现有 IGW 出网。数据库安全组允许跳板机及 Lambda 安全组访问 5432。
- 已开启 RDS IAM 认证；数据库用户 `github_app` 获得 `rds_iam`、数据库连接、schema 使用及业务表增删改查权限。管理员 `postgres` 继续使用密码连接。

## API 部署参数

继续更新 `octoshelf-free-api` 堆栈和 `infrastructure/free-api.yaml`，保留原有 API 及访问令牌资源。

| 参数 | 新值 |
|---|---|
| DatabaseHost | octoshelf-rds-db.cfiqkuom6t1v.ap-southeast-2.rds.amazonaws.com |
| DatabaseResourceId | db-NKM3PGRYBNUYJPEQ62QXWR7RIE |
| DatabaseUser | github_app |
| DatabaseName | github_search |
| DatabaseConnectionMode | vpc |
| AppSubnetIds | subnet-021f1b1cf329aad8d,subnet-0a72ac56c7f84ffe3 |
| LambdaSecurityGroupId | sg-05aeecd295c0002a1 |

保留堆栈当前 `AllowedOrigins`，包括 Cloudflare Workers 域名。模板会启用 Lambda VPC 网络接口权限，并设置 `DB_CA_FILE=/var/task/rds-ca.pem`。构建脚本下载 RDS CA；后端验证数据库 TLS 证书，不关闭校验。

不要用旧 `scripts/preview-free.ps1` 重新部署：它面向 Aurora Express，会传入旧数据库参数。不要部署原来的 `infrastructure/template.yaml`。

## 执行与验证

先 `npm test`、`npm run typecheck`、`npm run build:lambda` 和 `sam validate --lint`，再使用上述参数执行 `sam deploy --no-execute-changeset`。确认变更只更新 API 函数、角色及集成后，执行生成的变更集。

等待 API 堆栈 `UPDATE_COMPLETE` 后，验证 Lambda 的 VPC 配置与数据库环境变量，再验证 `/users`、GitHub 搜索、Cloudflare 跨域，以及新增、编辑、删除。可在跳板机查询新 RDS，确认线上写入确实落在新库。

切换前避免继续编辑旧库，避免两库数据分叉。切换验证完成前保留旧 Aurora。NAT 按小时及数据量计费；停用 Lambda 不会停止 NAT 费用。清理网络堆栈前，必须先解除 Lambda 对该网络的依赖。
