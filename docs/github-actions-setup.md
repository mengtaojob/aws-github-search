# GitHub Actions：Cloudflare Workers + AWS Lambda

当前状态：GitHub CI 和 Cloudflare 自动发布均已验收成功。用户修改 app/page.tsx 文案并推送提交 5919389 后，CI #5 通过、Deploy #6 自动成功，线上文案更新。手动发布亦已验证（Deploy #4，提交 7d46ebc，37 项单元测试通过）。当前分支为 main。AWS OIDC 尚不可用，保持 `AWS_DEPLOY_ENABLED` 不设置或为 `false`。

后端采用用户选择的专用 EC2 自托管 Runner，以实例角色更新 Lambda，不创建 OIDC provider、不修改组织策略。模板及创建步骤见 [github-runner-setup.md](github-runner-setup.md)。变更预览已准备，尚未执行创建或注册。GitHub 建议自托管 Runner 用于私有仓库；实施时需限制任务触发范围及执行机权限。部署角色仅能更新当前 Lambda 的代码和读取更新状态，另包含实例自身的 SSM 管理权限。

仓库：`mengtaojob/aws-github-search`，本地 origin 已绑定。2026-11-09 检查发现当前 AWS 会话的 `iam:ListOpenIDConnectProviders` 和 `iam:GetOpenIDConnectProvider` 被组织 SCP 明确拒绝。以下 OIDC 设置尚未完成，不要照搬为“已部署”。先完成 GitHub CI 和 Cloudflare 配置；AWS 部署认证需另行确认允许的方案，不修改组织限制，不升级套餐。

## 流程

推送 main → CI（测试、PostgreSQL 集成测试、构建、浏览器测试、Android 导出检查）→ CI 成功后 Deploy。

Deploy 使用 CI 检查过的同一个提交，包含两个独立任务：`deploy-cloudflare` 构建静态前端并用 Wrangler 发布到现有 Worker；`deploy-aws` 仅更新现有 Lambda 代码。两个任务由不同开关控制，Cloudflare 不依赖 AWS 授权。数据库、VPC、NAT、Lambda 环境变量及 IAM 数据库配置不通过这个代码发布工作流修改。

手动运行 Deploy 时必须选择 main，也会重新执行类型检查、单元测试和构建。前后端分别发布，未实现跨平台原子发布或自动回滚。

## 1. 创建 GitHub 仓库

推荐私有仓库，名称 aws-github-search。创建空仓库，不勾选初始化 README、gitignore、license。将地址交给助手后配置 remote 并推送。

不要提交 .env、私钥、数据库备份、访问令牌。当前 .gitignore 已排除 .env、*.pem、dist、out 等文件。

## 2. 配置 AWS OIDC

确认 AWS 账户中是否已有 token.actions.githubusercontent.com 的 OIDC provider；存在则复用，不存在才使用 infrastructure/oidc-bootstrap.yaml 创建。

使用 infrastructure/github-deploy-role.yaml 创建部署角色，参数为实际 GitHub owner/repository、现有 Lambda ARN、OIDC provider ARN。角色仅允许更新这一个 Lambda 的代码和读取更新状态，不需要 AWS Access Key。

GitHub 仓库 Settings → Environments → 新建 production。Deployment branches and tags 限定为 main，确保 OIDC 的 production 环境信任只用于正式分支。

## 3. 仓库变量及机密

在 Settings → Secrets and variables → Actions 中配置仓库级 Variables（也可以把 API 和 AWS 参数放入 production 环境，但启用开关必须是仓库变量）：

| 名称 | 值 |
|---|---|
| API_BASE_URL | https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com |
| AWS_FUNCTION_NAME | octoshelf-free-api-api |
| AWS_DEPLOY_ROLE_ARN | 创建部署角色后得到的 ARN |

仓库 Secrets（用户已保存）：

| 名称 | 值 |
|---|---|
| CLOUDFLARE_ACCOUNT_ID | 当前 Worker 所属 Cloudflare 账户的 Account ID |
| CLOUDFLARE_API_TOKEN | 限定当前账户的 Workers 部署 API Token |

Cloudflare Token 使用指定 Worker 的 Individual Workers Editor，加账户 Account Settings Read。对于当前 workers.dev 静态站，不需要购买域名。API Token 只存 GitHub Secret，不粘贴到聊天或源码。

## 4. 启用及验收

完成 Cloudflare 两个 Secrets 和 API_BASE_URL 后，在 Variables 添加仓库级变量 `DEPLOY_ENABLED=true`，启用前端发布。AWS 授权尚未就绪，不设置 AWS_DEPLOY_ENABLED；该任务会跳过。未来 AWS 授权完成后再设置仓库级 `AWS_DEPLOY_ENABLED=true`。

推送 main 后先查看 CI，成功后检查 Deploy Cloudflare and AWS。也可选择该工作流 → Run workflow → main 手动验证。当前预期 Cloudflare 任务成功、AWS 任务跳过；刷新线上站点验证收藏、搜索和编辑。只有 AWS 发布也验收成功，才能标记前后端 CI/CD 全部完成。

停止自动部署可将 DEPLOY_ENABLED 改为 false；这不会停止 AWS 上已运行资源的计费。

## 参考

- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
