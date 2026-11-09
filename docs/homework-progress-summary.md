# AWS 课程作业实施总结

截至 2026-11-09。此文记录已执行的过程，不是让你把所有历史命令重新运行。CI/CD、Android 真机验收和旧资源清理尚未完成。

## 1. 目标与当前结果

项目 OctoShelf 用来搜索 GitHub 用户、查看资料、收藏用户、编辑备注和标签，以及删除收藏。

当前网站：https://octoshelf-github-search.mengtaojob-7a7.workers.dev/

前端是 Next.js 静态导出，实际部署在 Cloudflare Workers 静态资源服务。最初指导按 Pages 上传，但最终控制台创建的是 workers.dev 网站。浏览器直接请求 AWS API；没有实施最初漫画中独立的 Cloudflare Worker 鉴权代理或 SigV4 转发。

后端使用 TypeScript、Hono、AWS Lambda，API Gateway 提供 HTTPS 入口，RDS PostgreSQL 保存数据。项目采用普通 RDS，是根据老师“可以不用 Aurora”的回复选择的替代方案；当前数据库不是 Serverless Aurora。

## 2. 本地开发和数据库验证

助手实现前端、后端、数据访问、表结构和构建脚本；用户安装依赖及运行服务，验证搜索、收藏、备注和标签。

主要命令（在本机项目目录执行）：

```powershell
docker compose up -d
docker compose ps
npm run dev
```

前端本地地址是 127.0.0.1:3000，本地 API 是 127.0.0.1:3001。Docker 中运行 PostgreSQL 17，持久化卷保存数据。首次启动通过 database/001_initial.sql 创建 github_users 表。

用户通过 psql 查到收藏记录，并验证重启后数据仍保留。后来改用云端 API 时，仅运行 npm run dev:web；本地前端调用的是云端后端。

## 3. 安装工具和登录 AWS

用户安装 AWS CLI、SAM CLI 和 Session Manager Plugin，并配置悉尼区域的 aws-course profile：

```powershell
aws configure set region ap-southeast-2 --profile aws-course
aws configure set output json --profile aws-course
aws login --profile aws-course
aws sts get-caller-identity --profile aws-course --no-cli-pager
```

CLI 使用临时登录凭证；过期时重新 aws login。Session Manager 插件虽然安装了，当前跳板机实际使用 SSH，并没有配置 SSM 管理权限。

## 4. 最初 Aurora 部署失败，临时采用 Express

最初尝试用 infrastructure/template.yaml 创建完整环境。SAM 先上传代码和模板、创建变更集；用户执行变更集后，免费账户的 Aurora 完整配置限制导致创建失败，octoshelf-course-dev 回滚。

用户随后在控制台创建 Aurora Express：octoshelf-free-db。Express 不关联项目 VPC，因此它当时只能作为先跑通业务的过渡方案。

用户在 CloudShell 连接旧库，创建 github_search 数据库及 github_users 表，验证本地程序成功写入两条收藏。

## 5. 部署 API Gateway 与 Lambda

助手准备 infrastructure/free-api.yaml 和 Lambda 构建脚本；用户执行预览和变更集。

这个 API 堆栈创建或管理：API Gateway、Lambda、执行角色、日志组、项目访问令牌 Secret，以及 API 到 Lambda 的集成和调用权限。

```powershell
npm run build:lambda
sam validate --lint --template-file infrastructure/free-api.yaml --region ap-southeast-2
```

SAM deploy 的 --no-execute-changeset 只生成变更预览；execute-change-set 才应用变更。CREATE_COMPLETE 表示首次创建成功；UPDATE_COMPLETE 表示后续更新成功。

API 地址：https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com

项目访问令牌保存在 Secrets Manager；浏览器连接设置里输入令牌，随 Authorization 请求头发送。令牌没有写入静态前端。它与数据库密码、AWS CLI 登录凭证不是同一个东西。

## 6. 前端发布到 Cloudflare

助手指定公开的 API 地址并构建静态前端：

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = 'https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com'
npm run build:web
```

构建产物在 out/；助手将其内容打包成 dist/cloudflare/octoshelf-pages.zip，用户在 Cloudflare 控制台上传发布，得到 workers.dev 地址。压缩包的文件名不代表实际部署成了 Pages。

助手通过 CloudFormation 更新 AllowedOrigins，保留本地来源并加入实际 Cloudflare 域名。验证 OPTIONS 预检 204、来源和 Authorization 请求头被允许。

跨域配置告诉浏览器哪些网站可以读取 API 响应；项目令牌负责 API 鉴权，二者作用不同。

## 7. 老师允许使用普通 RDS，创建新数据库

用户在控制台选择普通 PostgreSQL、免费套餐模板、单可用区，创建 octoshelf-rds-db，实际规格 db.t4g.micro。

- 数据库：github_search。
- VPC：vpc-08c92e15230b346a1，使用已有默认 VPC，并非这次重新创建。
- 公共访问：关闭。
- 数据库安全组：octoshelf-rds-sg，sg-077db7d975610cffc。
- 端点：octoshelf-rds-db.cfiqkuom6t1v.ap-southeast-2.rds.amazonaws.com。

新数据库仍使用原默认数据库子网组；没有另外创建漫画中的独立隔离数据库子网。RDS 未分配公共访问地址，访问由安全组限制。

## 8. 创建跳板机并通过内网连接数据库

用户创建 EC2：i-015cd11908b9e2663，名称 octoshelf-bastion，Amazon Linux 2023 x86、t3.micro，位于同 VPC 的公有子网。当前公网地址 52.62.66.12，安全组实际名称 launch-wizard-1，ID sg-07ebb474101898e47。

助手检查安全组，添加“数据库 5432 来源为跳板机安全组”，移除数据库创建时面向单个公网 IP 的规则。用户通过 SSH 登录：

```powershell
ssh -i "D:\PROJECT\yd-project\docs\AWS\octoshelf-bastion-key.pem" ec2-user@52.62.66.12
```

登录后，当前终端里的命令在 EC2 上执行：

```bash
sudo dnf install -y postgresql17
psql "host=octoshelf-rds-db.cfiqkuom6t1v.ap-southeast-2.rds.amazonaws.com port=5432 dbname=github_search user=postgres sslmode=require" -W
```

提示符含义：本机 C:\Users\mt> → 跳板机 [ec2-user@... ~]$ → 数据库 github_search=>。psql 中 \q 返回跳板机，跳板机中 exit 返回本机。

已排查两类 SSH 问题：

- 超时：公网出口 IP 变化，或浏览器代理出口与 SSH 出口不同。助手按本机直连 IP 更新 22 端口 /32 规则；可以用 curl.exe --noproxy "*" https://checkip.amazonaws.com 查询。
- UNPROTECTED PRIVATE KEY FILE：助手收紧单个 pem 文件的 Windows ACL，只允许当前用户读取。

“我的 IP”在跳板机安全组的“编辑入站规则 → 来源”下拉框，不是安全组列表的操作菜单。浏览器走代理时，应使用本机直连查询得到的 IP 手动填写 /32。

## 9. 建表和迁移两条收藏

用户在新库创建 public.github_users，字段包括 github_id、profile JSONB、note、tags、created_at、updated_at。

助手通过受令牌保护的旧 API 读取两条收藏，生成 JSON 备份和 SQL 导入文件；没有导出或写入令牌。文件保存在被 Git 忽略的 dist/migration/。

助手用 scp 将 SQL 传到跳板机，用户在新库中执行：

```sql
\i /home/ec2-user/import-users.sql
SELECT COUNT(*) FROM public.github_users;
```

INSERT 0 2 和最终 count=2 证明两条记录导入成功。ON CONFLICT DO NOTHING 避免重复导入覆盖同 ID 数据；备注、标签和时间字段保留。

## 10. 建立 Lambda 私有网络及数据库 IAM 认证

助手写入并验证 infrastructure/rds-network.yaml、创建变更预览；用户执行后，octoshelf-rds-network 达到 CREATE_COMPLETE。

新增资源共 10 项：两个私有子网、NAT 的弹性公网 IP、一个 NAT Gateway、一个路由表、一条默认路由、两个子网路由关联、Lambda 安全组、数据库允许 Lambda 访问的规则。复用原有 VPC、IGW 和公共子网。

私有子网分别是 172.31.48.0/24 和 172.31.49.0/24，共用一个 NAT。第二个可用区使用第一个可用区的 NAT，这是当前作业的成本取舍，不是每可用区独立 NAT 的高可用部署。

助手开启 RDS IAM 认证；用户为 github_app 授予 rds_iam、CONNECT、schema USAGE 和表 SELECT/INSERT/UPDATE/DELETE 权限。账号已存在时 CREATE USER 报重复，但后续 GRANT 成功，无需重建。

postgres 保留密码管理用途。Lambda 使用 github_app 和自身 AWS 执行角色签发的临时数据库认证令牌；项目访问令牌不参与数据库认证。

## 11. 更新 Lambda，完成线上读写验收

助手更新 free-api.yaml 和数据库连接代码：

- DB_HOST 指向普通 RDS，DB_USER=github_app。
- IAM rds-db:connect 权限改为新 db- 资源 ID。
- Lambda 连接两个私有子网和专用安全组。
- 执行角色获得网络接口管理权限。
- 打包 RDS CA，设置 DB_CA_FILE 并保持 TLS 证书校验开启。
- 保留 API、访问令牌和 Cloudflare CORS 来源。

助手执行 37 项测试、类型检查、Lambda 构建、SAM lint 校验，再创建切换预览。用户执行变更集后，API 堆栈达到 UPDATE_COMPLETE。

助手确认 Lambda Active、更新 Successful，并实测健康检查 200、收藏读取 200、GitHub 搜索 200、Cloudflare 预检 204。

最后用户在网页追加备注“已切换到 RDS PostgreSQL”，随后通过跳板机在新库执行：

```sql
SELECT profile->>'login' AS login, note, tags
FROM public.github_users
WHERE github_id = 12232166;
```

查询到新备注，证明请求实际写入新 RDS。psql 输出中的 + 是换行标记。

## 12. 当前三条访问路径

```text
业务：浏览器 → Cloudflare 静态前端 → API Gateway → Lambda → RDS PostgreSQL
出网：Lambda 私有子网 → NAT 公共子网 → IGW → GitHub API / AWS 公共服务接口
运维：本机 → SSH → EC2 跳板机 → RDS PostgreSQL
```

Cloudflare 承载前端；CloudFormation 管理 AWS 资源。跳板机用于人工管理数据库，正常业务请求不经过它。数据库访问在 VPC 内走 local 路由，不经过 NAT。

## 13. 尚未完成及资源清理

- GitHub Actions：已有 CI 和旧部署工作流文件；旧部署仍面向 S3/CloudFront，尚未改为并验收当前 Cloudflare + Lambda 发布方案。文件存在不代表自动部署已完成。
- Android：已准备 Expo 代码，尚未完成设备运行和最终安装包验收。
- 清理旧 Aurora、失败堆栈残留及不再使用的资源；目前仅确认迁移完成，尚未执行清理。
- 普通 RDS 是老师允许的替代方案，不能标注为已部署 Serverless Aurora。

当前 NAT、RDS、EC2 和公网 IPv4 会产生使用费用，不能因账户有赠送额度就理解为这些资源免费。不要为了省额度直接删除仍被 Lambda 使用的 NAT；应先决定保留演示多久，再按依赖关系清理。停本机程序不会停止云资源计费。

不要重新执行旧 Aurora Express 的 scripts/preview-free.ps1 或原完整 Aurora infrastructure/template.yaml 来更新当前环境。后续以 docs/rds-vpc-migration.md 中的新参数为准。
