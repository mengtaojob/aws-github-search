# AWS 部署与清理（Windows PowerShell）

这些是待执行步骤。项目开发不会自动调用 AWS 创建资源，也不会替换已部署的 `github-user-search` / `github-search-api`。

## 1. 先了解影响

模板新建独立 Stack，包含 VPC、6 个子网、IGW、1 个 NAT（可选 2 个）、Aurora Serverless v2、Lambda、HTTP API、Secrets Manager、S3、CloudFront 和可选 EC2 跳板机。

**这是付费实验环境，不应按“Serverless = 免费”理解。** NAT 按运行时间和流量计费，公网 IPv4、Aurora 计算/存储、Secrets、EC2/EBS、CloudFront 和日志等也可能产生费用。Aurora 默认最小 0.5 ACU，不会自动缩到零；默认仅一个 writer。价格和账号优惠请在部署前查看所在区域的 AWS Pricing Calculator，并设置自己的预算提醒。

默认单 NAT 降低资源数量，但跨 AZ 出网会产生可用性和潜在跨 AZ 流量取舍。`NatMode=per-az` 创建第二个 NAT，也增加持续费用。

资源清理时数据库保留最终快照，S3 保留桶，SAM 工具管理的构建桶也可能继续存在；这些残留需要另外检查，不能只删除 Stack 就认为费用全部停止。

官方参考：[Lambda Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)、[SAM CLI 安装](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)、[Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)、[费用估算](https://calculator.aws/)。

## 2. 检查本机工具和身份

本地开发无需这些工具，真实部署需要 AWS CLI v2、SAM CLI；使用跳板机端口转发还需要 Session Manager plugin。数据库初始化使用项目内的 Node.js 迁移脚本。

```powershell
aws --version
sam --version
session-manager-plugin --version
```

若未配置 AWS CLI，优先用你账号支持的 IAM Identity Center/SSO 登录或 AWS 官方 CLI 登录流程，不需要把任何 Access Key 发给 AI。不要假设浏览器登录 AWS 控制台意味着 CLI 已登录。

本项目已使用浏览器登录配置 `aws-course`，在后续操作的每个新 PowerShell 窗口中设置：

```powershell
$env:AWS_PROFILE='aws-course'
$env:AWS_REGION='ap-southeast-2'
aws sts get-caller-identity
```

登录过期后执行 `aws login --profile aws-course`。使用 IAM Identity Center 时采用下面的 SSO 登录方式：

```powershell
aws sso login --profile YOUR_PROFILE
$env:AWS_PROFILE='YOUR_PROFILE'
$env:AWS_REGION='ap-southeast-2'
aws sts get-caller-identity
```

核对返回账号是你要用于实验的账号。

## 3. 验证数据库版本和模板

先检查账号计划：

```powershell
npm run aws:preflight
if ($LASTEXITCODE -ne 0) { throw 'AWS account plan preflight did not pass; stop before deployment' }
```

当前模板使用位于自定义 VPC 的标准 Aurora 配置。Free plan 要求使用 Express，而 Express 无法关联 VPC；不能只添加一个 Express 标志来保留原网络设计。首次部署已因这一限制回滚，详见 [失败诊断](aws-deployment-failure.md)。应先决定使用兼容的账号计划，或与老师确认修改架构，再进行后续部署。

模板默认 Aurora PostgreSQL `17.5`，但区域可用性需部署前实时核验，不能把本地模板默认值当作可用性证明：

```powershell
aws rds describe-orderable-db-instance-options --engine aurora-postgresql --engine-version 17.5 --db-instance-class db.serverless --region ap-southeast-2 --query 'OrderableDBInstanceOptions[].EngineVersion' --output text
```

若没有返回可用项，查询该区域支持版本并调整 `DatabaseEngineVersion`。不要随意把 MinCapacity 改成 0，不同引擎版本的自动暂停支持不同。

```powershell
npm run check
sam validate --lint --template-file infrastructure/template.yaml --region ap-southeast-2
```

`build:lambda` 已生成 `dist/lambda/`，SAM 的 `CodeUri` 指向这个目录。无需用 Docker 再打包，也不必增加 Layers。

## 4. 部署独立实验 Stack

选择全新 Stack 名，避免与现有实验冲突。下面启用跳板机以满足课程运维演示，会增加 EC2、EBS 和公网 IPv4 费用。

```powershell
sam deploy --template-file infrastructure/template.yaml --stack-name octoshelf-course-dev --region ap-southeast-2 --profile aws-course --resolve-s3 --capabilities CAPABILITY_IAM --parameter-overrides ProjectName=octoshelf-course DatabaseEngineVersion=17.5 NatMode=single EnableBastion=true --no-execute-changeset
```

这是变更集预览命令：`--no-execute-changeset` 保证本次生成变更集后退出，不创建模板中的 Aurora、NAT、EC2、Lambda 等业务资源。`--resolve-s3` 仍可能创建 SAM 打包用的辅助 Stack/S3 桶并上传代码，产生少量 S3 存储和请求费用。第一次预览时，业务 Stack 可能显示 `REVIEW_IN_PROGRESS`，这只是待执行的占位状态。

检查终端中的资源清单，预期本次是新建资源（Add）；核对参数、IAM 角色和费用影响。确认准备好正式创建资源之后，再使用同一命令删除 `--no-execute-changeset`、增加 `--confirm-changeset` 执行部署，并在终端审核确认。正式部署会创建收费资源，不应在尚未检查预览时执行。

IAM Role 不使用管理员权限；Secrets 读取仅针对本 Stack 的 Secret。Lambda 创建/清理 ENI 的权限按 AWS 服务要求包含通配资源。

模板声明的 Lambda 和 API 名称与旧项目不同，不导入、不更新旧资源。函数名还包含 Stack 名；建议 Stack 名保持简短。

读取输出，保存在当前 PowerShell 会话中：

```powershell
$stackName='octoshelf-course-dev'
$stackResult = aws cloudformation describe-stacks --stack-name $stackName --region ap-southeast-2 | ConvertFrom-Json
$outputs=@{}
$stackResult.Stacks[0].Outputs | ForEach-Object { $outputs[$_.OutputKey]=$_.OutputValue }
$apiUrl=$outputs['ApiUrl']
$dbHost=$outputs['DatabaseHost']
$bastionId=$outputs['BastionId']
```

不要截图或公开 Secret 值。Outputs 只包含 Secret ARN，不包含密码或访问令牌。

## 5. 通过跳板机初始化数据库

数据库没有公网地址。使用 SSM 托管的 EC2 进行端口转发，不开放 SSH 22 端口。

在第一个 PowerShell 窗口中，保持上一步变量并运行：

```powershell
New-Item -ItemType Directory -Force .data | Out-Null
@{host=@($dbHost); portNumber=@('5432'); localPortNumber=@('15432')} | ConvertTo-Json | Set-Content -Encoding utf8 .data/ssm-port.json
aws ssm start-session --target $bastionId --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters file://.data/ssm-port.json --region ap-southeast-2
```

此命令持续运行并将本机 15432 转发到 Aurora 5432。SSM 刚启动可能需要等待 EC2 成为 managed instance。

在第二个 PowerShell 窗口中，进入项目根目录，然后执行：

```powershell
npm run db:migrate:aws
```

脚本默认使用 `aws-course` profile、Sydney 区域和 `octoshelf-course-dev` Stack。它通过 AWS CLI 在内存中读取数据库凭证，经本机 15432 端口的 SSM 隧道连接 Aurora，并使用 RDS CA 和实际数据库域名验证 TLS。脚本不读取本地 `.env`，不会把密码写入命令参数或文件。

自定义 Stack 或端口时使用 `node scripts/migrate-aws.mjs --stack YOUR_STACK --profile aws-course --port 15432`。SQL 可重复执行，但当前迁移器只支持初始建表，不是完整的版本化迁移框架。

后续可以沿用该隧道，用 psql 或数据库客户端管理表。不要将数据库安全组改为对公网开放。

## 6. 获取项目令牌并部署前端

在自己的 AWS Secrets Manager 控制台打开 Outputs 中 `ApiAccessSecretArn` 对应的 Secret，查看并复制值。它是随机生成的共享项目令牌，只应私下提供给作业演示访问者。

网页构建只写 API 地址，**不写令牌**：

```powershell
$env:NEXT_PUBLIC_API_BASE_URL=$apiUrl
npm run build:web
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
Remove-Item Env:NEXT_PUBLIC_API_BASE_URL
$webBucket=$outputs['WebBucketName']
aws s3 sync out/_next/static/ "s3://$webBucket/_next/static/" --cache-control 'public,max-age=31536000,immutable' --region ap-southeast-2
aws s3 sync out/ "s3://$webBucket/" --exclude '_next/static/*' --cache-control 'no-cache' --region ap-southeast-2
aws cloudfront create-invalidation --distribution-id $outputs['DistributionId'] --paths '/*'
```

打开 Outputs 的 `WebUrl`，在「连接设置」中输入访问令牌。依次验证搜索、保存、编辑、删除；`/health` 仅表示 API 进程/配置正常，不能代替数据库 CRUD 验证。

前端源站为 S3 私有桶，通过 CloudFront OAC 读取。API CORS 仅放行这个 CloudFront 域名。自定义域名或跨域本地调试需要同步修改 CORS 配置。Android 原生请求没有浏览器 CORS 限制，但仍必须通过令牌校验。

## 7. GitHub 仓库与 CI/CD

尚未创建远端仓库。先在自己的 GitHub 创建空仓库，然后在根目录检查敏感文件忽略情况，再提交和推送：

```powershell
git init -b main
git add .
git diff --cached --stat
# 人工确认没有 .env、.data、证书私钥或 Token
git commit -m "feat: build OctoShelf AWS full-stack homework"
git remote add origin https://github.com/YOUR_NAME/aws-github-search.git
git push -u origin main
```

CI 自动运行检查、数据库测试、浏览器测试及 Android JS 构建。CD 默认禁用；未准备好 AWS 环境时不会尝试发布。

启用 CD 需要：

1. 在 AWS IAM 检查是否已有 `token.actions.githubusercontent.com` OIDC provider。已有则复用；没有才部署 `infrastructure/oidc-bootstrap.yaml`。
2. 用 `infrastructure/github-deploy-role.yaml` 创建部署角色，传入准确的 `owner/repository`、provider ARN、Lambda ARN、S3 桶 ARN 和 CloudFront distribution ARN。这会修改 IAM 权限，应检查 changeset。
3. GitHub 仓库创建 `production` environment，将 Deployment branches 限定为 `main`，按需要启用 required reviewers。
4. 在 Repository Actions variables 中配置下表。项目访问令牌、数据库密码都不需要写进 GitHub。

| Variable | 内容 |
| --- | --- |
| AWS_DEPLOY_ENABLED | `true`，最后再设置此开关 |
| AWS_DEPLOY_ROLE_ARN | 上述部署角色 ARN |
| AWS_FUNCTION_NAME | Stack 输出 FunctionName |
| AWS_WEB_BUCKET | Stack 输出 WebBucketName |
| AWS_DISTRIBUTION_ID | Stack 输出 DistributionId |
| API_BASE_URL | Stack 输出 ApiUrl |

角色只允许更新指定 Lambda 代码、上传指定桶和刷新指定 CloudFront。**CD 不创建基础设施、不运行数据库迁移、不连接私有数据库。** 修改 template.yaml 或 SQL 后，需要管理员单独审核并部署/迁移。

`main` 的 push 在 CI 成功后触发发布，也可 workflow_dispatch 手动触发。部署的 commit 是 CI 验证过的 commit；OIDC 使用短期 AWS 身份，不保存长期 AWS Access Key。

## 8. 实验结束后清理

先备份需要的收藏数据，并将 GitHub `AWS_DEPLOY_ENABLED` 设为 `false`，防止后续提交继续发布。

删除操作不可逆，下面命令仅供你确认目标 Stack 后手动执行：

```powershell
aws cloudformation describe-stacks --stack-name octoshelf-course-dev --region ap-southeast-2
sam delete --stack-name octoshelf-course-dev --region ap-southeast-2
```

SAM 删除会提示确认。数据库使用 Snapshot 删除策略，会留下最终快照；S3 桶使用 Retain，会保留内容。随后在控制台核对并按需删除：

- 保留的 S3 前端桶及对象。
- Aurora 最终快照及不再需要的手动快照/备份。
- SAM 管理的打包桶对象、未使用的 Secrets（包括计划删除期）、独立 OIDC/deploy-role Stack。
- NAT Gateway、EIP、公网 IPv4、EC2/EBS、CloudFront 和日志是否已移除。

CloudFormation 有时会等待 Lambda VPC 网卡释放；若删除失败，先检查 Stack events，不能直接假设成功。不要删除其他项目仍使用的共享 OIDC provider 或打包桶。

原来的 Lambda/API Gateway 不属于新 Stack，仍需你决定是否保留，不会随本实验 Stack 自动删除。
