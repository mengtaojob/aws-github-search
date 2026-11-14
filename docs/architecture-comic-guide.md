# OctoShelf 漫画风系统架构图

- [高清 PNG](octoshelf-system-architecture-comic.png)
- [可编辑 SVG](octoshelf-system-architecture-comic.svg)
- 可复现绘图源文件：`draw-architecture-comic.py`。

这张图按当前项目代码、基础设施模板和验收记录绘制。四个分区是同一套资源的不同视角，重复出现的 Lambda、RDS 不是多套部署。

## 1. 用户访问

Cloudflare Workers 分发 Next.js 静态资源。页面下载到浏览器后，由浏览器直接请求 API Gateway；Cloudflare 不充当业务 API 代理。浏览器请求附带项目访问令牌，令牌存于当前标签页的 sessionStorage，后端校验来源与令牌。

Android 是另一个正式客户端，调用相同 API，使用 SecureStore 保存项目令牌。根据用户最新确认，Android 已在另一分支完成开发，并通过本地模拟器、真实 API 和数据调用验证；图中不再标为待开发。这个确认不等于已在应用商店发布。

API Gateway 调用 Lambda，Lambda 校验项目令牌并处理搜索、收藏增删改查、备注和标签。Lambda 从 Secrets Manager 读取项目 API 令牌，此辅助请求使用 NAT 公网出口。

Lambda 使用 github_app 用户，通过 IAM 临时数据库认证和 TLS，连接同 VPC 的普通 RDS PostgreSQL。数据库为 github_search，业务表为 github_users。这里不是 Aurora，也不宣称普通 RDS 是 Serverless 数据库。

## 2. Lambda 出网

Lambda 通过 ENI 接入两个 AZ 的私有应用子网。这两个子网共用一个公有子网内的公共 NAT Gateway；NAT 再经挂载到 VPC 的 IGW 访问 GitHub API。私有子网默认路由指向 NAT，公有子网默认路由指向 IGW。

数据库连接走 VPC local 路由，不经过 NAT。公网请求调用 Lambda 经 API Gateway 和 Lambda 服务完成，不是直接连入 Lambda 的私有网卡。将 Lambda 放进公有子网也不会自动获得公有 IP 或公网出口。

## 3. 人工运维

管理员电脑通过 SSH 连接 EC2 跳板机，SSH 22 仅允许当前出口公网 IP /32。跳板机使用 psql 经内网连接 RDS。数据库 5432 只允许 Lambda 安全组和跳板机安全组。

RDS 已关闭公共访问，不分配公网地址。它使用现有默认数据库子网组，不能误称为“新建的隔离数据库子网”。业务请求由 Lambda 直接连接数据库，不经过跳板机。

## 4. 自动发布

推送 main 后 GitHub CI 检查类型、单元测试、PostgreSQL 集成测试、模板、构建、浏览器与移动端检查。通过后，发布任务使用对应提交进行构建。

- 前端：GitHub 托管 Runner 构建 out/，Wrangler 使用 GitHub Secrets 中的 Cloudflare Token 发布到现有 Worker。
- 后端：GitHub 托管 Runner 构建 Lambda ZIP 与 SHA256，上传为 Artifact。专用 EC2 Runner 下载、校验后，使用自己的 EC2 实例角色调用 UpdateFunctionCode 更新指定 Lambda。没有长期 AWS Access Key，也不依赖被限制的 OIDC provider。

专用 Runner 不执行应用构建、不直连数据库。管理员经 Session Manager 管理它，无需开放入站 SSH。后台服务以 actions 用户运行。数据库、VPC 和 NAT 的创建更新由 CloudFormation 管理，不由每次代码发布自动重建。

## 状态与费用

已验证：网页读写、数据库迁移、同 VPC Lambda、GitHub 搜索出网、跳板机运维、前端自动发布、后端手动触发发布、Android 模拟器真实数据调用。最后一次启用后端后的自动触发确认仍以 Actions 实际运行记录为准，不因绘图自动标记完成。

NAT、RDS、EC2、系统盘、公网 IPv4 会消耗额度。停止部署任务或关闭终端不会停止这些资源计费。

内置 AI 生图服务两次均因网络错误未返回图片；最终交付采用代码绘制的漫画风矢量图，并导出 PNG。没有调用需 API Key 的生图 CLI。
