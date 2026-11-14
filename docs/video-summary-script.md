# OctoShelf 作业总结视频讲解稿

适用范围：本次已完成的 OctoShelf 项目。按最终采用的 Cloudflare Workers 静态前端、AWS Lambda、普通 RDS PostgreSQL、GitHub Actions 和 Android App 进行讲解。Android 完成状态结合本次用户确认及架构说明中的模拟器真实 API 验收记录；旧文档中的“尚未完成”是历史阶段状态。

建议录制 18～25 分钟，实际取决于操作等待时间。“画面建议”不用朗读，正文可直接作为口播。流水线的最终成功状态展示实际 Actions 页面；不要将早期一次手动发布记录描述为某次自动触发记录。

**1．开场：这次作业做了什么**

画面建议：打开线上网页，再切换一次 Android App。

老师好，这次我完成的项目叫 OctoShelf，是一个 GitHub 开发者搜索与收藏系统。

用户可以在网页搜索真实 GitHub 用户，查看资料，将感兴趣的开发者加入收藏，再为收藏添加备注和标签，也可以筛选和删除收藏。收藏数据保存在云端数据库中，Android App 可以通过同一套后端接口读取这些收藏。

这次作业完成了从本地开发、数据库持久化，到云端部署、VPC 网络配置、自动化测试、持续发布和移动端展示的整个流程。下面我先展示最终效果，再介绍实现过程和遇到的问题。

**2．网页功能演示：展示完整操作闭环**

画面建议：线上网页中搜索、收藏、编辑、筛选、刷新；用临时演示记录展示删除。

首先打开已经部署的网站。网页的静态资源由 Cloudflare Workers 提供，业务接口则部署在 AWS。

连接时输入项目访问令牌，随后搜索 GitHub 用户，例如 torvalds。这里的搜索结果来自 GitHub 官方 API，不是写死在页面中的演示数据。页面支持分页，也提供加载、空结果和错误提示。

点击加入收藏后，后端会重新获取该用户的完整 GitHub 档案，然后保存到数据库。这样保存的数据除了用户名、头像和主页地址，还包括简介、公司、地区、公开仓库数和关注者等信息。

接下来我为收藏填写备注和标签，例如“关注开源项目”和“系统编程”，保存以后可以根据姓名、备注或者标签筛选收藏。

刷新页面后，这些内容仍然存在，说明数据不是只保存在当前页面里。最后我使用一条临时演示收藏展示删除，确认后记录会从收藏列表和数据库中移除。

**3．总体架构：各部分如何协作**

画面建议：展示项目架构图，依次指向前端、API Gateway、Lambda、RDS 和 Android。

项目分为客户端、后端接口和数据库三部分。

网页使用 Next.js、React 和 TypeScript 开发，构建为静态文件，发布到 Cloudflare Workers 的静态资源服务。Android 端使用 Expo 和 React Native 开发。

网页下载到浏览器后，由浏览器直接请求 AWS API Gateway。Android 也请求同一个 API Gateway。API Gateway 是统一的 HTTPS 入口，收到请求后调用 Lambda，由 Lambda 中的 TypeScript 和 Hono 代码完成业务处理。

搜索时，Lambda 访问 GitHub API；读取、添加、编辑和删除收藏时，Lambda 访问同一 VPC 内的 RDS PostgreSQL。

因此，网站不是通过 Cloudflare 转发所有业务请求，Cloudflare 在当前方案中主要负责静态前端。网页和 Android 也没有各自单独维护数据库，它们共享同一个后端和同一份收藏数据。

**4．本地开发：先把业务跑通**

画面建议：展示目录结构，重点查看 app、src、database、infrastructure、mobile 和 .github/workflows。

开发过程中，我先在本地完成完整业务流程，再逐步部署到云端。

前端页面和样式主要放在 app 目录。后端路由在 src/app.ts，GitHub API 调用在 src/github.ts，数据库操作在 src/store-postgres.ts。database 目录保存建表 SQL，infrastructure 保存基础设施模板，mobile 保存 Android 代码，GitHub Actions 工作流在 .github/workflows 中。

本地前端运行在 3000 端口，后端 API 运行在 3001 端口。项目早期提供 JSON 文件存储，方便快速运行；正式验证数据库功能时，切换到 Docker 中的 PostgreSQL 17。

这里的一个设计重点是，本地 HTTP 服务和云端 Lambda 共用业务代码。本地入口是 server.ts，Lambda 入口是 handler.ts，它们只是适配不同的运行环境，路由和业务处理不需要分别维护两套。

存储也通过统一接口访问，因此从文件切换到 PostgreSQL 时，主要调整存储实现和配置，不需要重写网页功能。

**5．后端接口和数据设计**

画面建议：打开接口路由、建表 SQL，再展示一条真实收藏记录。

接口围绕两类数据设计：一类是 GitHub 上的实时用户资料，另一类是本项目保存的收藏。

搜索接口是 GET /search/users，用户详情接口是 GET /github/users/:login。收藏接口使用 /users：GET 查询收藏，POST 添加收藏，PATCH 修改备注和标签，DELETE 删除收藏。

添加收藏时，前端只提交 GitHub 用户名，后端再向 GitHub 获取完整资料。这样可以减少对前端传入资料的信任，也确保保存的数据结构一致。

数据库使用 github_users 表。github_id 是主键，用来标识 GitHub 用户并防止重复收藏；profile 使用 JSONB 保存用户档案；note 保存备注；tags 使用文本数组保存标签；created_at 和 updated_at 记录创建与更新时间。

这种设计把外部用户档案与本项目的备注、标签分开。Android 展示的人员资料是收藏时保存的快照，刷新主要同步收藏及备注、标签的变化，不代表每次都重新抓取 GitHub 资料。

后端还做了参数校验、备注和标签长度限制、重复收藏保护、请求体限制以及统一错误响应。数据库查询采用参数绑定。对于 GitHub 的请求失败、限流和超时，也会返回相应的提示。

**6．云端方案调整：从 Aurora 尝试到普通 RDS**

画面建议：简单展示最初部署失败记录，再展示最终 RDS 实例。

云端部署并不是一次完成的，数据库方案经历了调整。

最初准备使用完整的 Aurora 方案，并通过 SAM 和 CloudFormation 创建资源。但实际部署时，当前 AWS 免费账户计划对 Aurora 配置有限制，数据库资源创建失败，导致业务堆栈回滚。

之后，我使用 Aurora Express 作为过渡，先验证数据库读写和 API。但这个方案不符合本次希望实现的 Lambda 与数据库同 VPC 访问方式，因此不能作为最终网络方案。

在得到老师允许使用普通 RDS 的答复后，我创建了普通 RDS PostgreSQL，并完成数据迁移。最终项目使用的是普通 RDS PostgreSQL，不能把它称为已经部署了 Aurora Serverless。

这次调整让我认识到，模板语法正确、资源规格可选，并不代表当前账户一定允许创建。部署前还要检查账户计划、权限和具体服务限制。

**7．数据库迁移与同 VPC 访问**

画面建议：展示 RDS 公共访问关闭、Lambda VPC 配置，以及不包含密码的迁移查询结果。

最终数据库关闭公共访问，Lambda 和 RDS 位于同一个 VPC，通过内网连接。

迁移时，我先创建 github_search 数据库和 github_users 表，再把旧数据库中的两条收藏备份并导入新数据库，同时保留备注、标签和时间字段。导入使用冲突处理，避免重复执行时覆盖相同用户的已有记录。

随后更新 Lambda 的数据库地址、数据库资源 ID、连接用户、私有子网和安全组。更新完成后，除了测试 API，我还在网页修改一条备注，再通过跳板机连接新 RDS，查询到刚刚写入的内容。

这一步比只看到网页显示正常更有说服力，因为它验证了网页请求经过云端 API，最终确实写入了新数据库，而不是仍然读取旧数据库或页面缓存。

**8．网络配置：内网访问、外网访问和人工运维**

画面建议：在架构图上分别指出三条路径，再展示路由表和安全组。

网络部分需要区分三条路径。

第一条是数据库路径：Lambda 通过 VPC 的本地路由直接连接 RDS 的 5432 端口。数据库安全组只允许 Lambda 安全组和跳板机安全组访问，业务请求不经过跳板机，也不经过 NAT。

第二条是出网路径：Lambda 在私有子网中，但搜索时需要访问公网 GitHub API，所以私有子网的默认路由指向公共 NAT Gateway，再经过 Internet Gateway 访问互联网。

当前配置了两个可用区中的 Lambda 私有子网，共用一个 NAT，属于成本和复杂度之间的课程项目取舍，不能描述为每个可用区都有独立 NAT 的完整高可用部署。把 Lambda 放进公有子网，也不会自动为它分配公网 IP。

第三条是人工运维路径：本机通过 SSH 连接 EC2 跳板机，再由跳板机上的 psql 连接 RDS。跳板机的 SSH 入站来源限制为管理员当前公网 IP。公网出口 IP 变化时，需要更新规则。

这里复用了已有 VPC、互联网网关和数据库子网组，没有把早期模板中的全部网络资源重新创建一遍。数据库关闭公共访问，也不等于本次新建了独立的隔离数据库子网。

**9．认证设计：区分不同令牌和权限**

画面建议：展示配置名称和权限关系，不打开真实令牌、私钥或密码。

项目中有几类不同的凭证，它们负责不同的事情。

项目访问令牌用于网页和 Android 调用业务接口。后端从 Secrets Manager 读取它，客户端通过 Authorization 请求头提交。网页在当前标签页的 sessionStorage 保存令牌，Android 使用 SecureStore 保存连接信息。

这个令牌是课程演示使用的共享访问凭证。持有同一令牌的人访问同一份收藏，项目没有实现每个人独立账号和独立数据空间。

Lambda 连接数据库则使用另一套认证：通过自身执行角色和 RDS IAM 认证生成临时数据库令牌，以 github_app 用户连接，并使用 TLS 和 RDS CA 校验证书。数据库用户只授予所需的连接和业务表操作权限。

如果配置 GitHub Token，它只在后端用于访问 GitHub。Cloudflare API Token 则只用于自动发布。这些凭证不能互相替代，也没有写入公开前端代码。

另外，CORS 决定浏览器是否允许网页读取跨域 API 响应，项目令牌负责接口鉴权，两者需要分别配置。

**10．正式发布：网页与 API 上线**

画面建议：展示 out 目录、Cloudflare 部署页面、API Gateway 和 Lambda。

后端通过构建脚本将 TypeScript 打包成 Lambda 使用的 ES Module，同时打包 RDS CA 证书。云端使用 API Gateway HTTP API 调用 Lambda。

AWS 资源主要通过 SAM 和 CloudFormation 模板描述。部署时先创建变更集，检查要创建或更新的资源，再执行变更集，等待堆栈完成。生成变更集只是预览，并不代表资源已经更新成功。

前端则配置公开 API 地址，执行 Next.js 静态构建，生成 out 目录。最初通过 Cloudflare 控制台上传发布，后来接入 GitHub Actions 自动发布。

网站上线以后，还要把实际 Cloudflare 域名加入允许来源，验证带 Authorization 请求头的跨域预检能够通过，再测试搜索和收藏读写。

因此，最终前端是 Cloudflare Workers 静态资源服务，后端是 AWS API Gateway 和 Lambda。早期 S3、CloudFront 和完整 Aurora 模板属于方案探索记录，不是当前线上架构。

**11．测试与 CI/CD：从本地验证到自动发布**

画面建议：打开 GitHub Actions，展示 CI 和发布任务的真实运行记录。

测试分为几个层次。

TypeScript 检查类型；Vitest 检查接口、参数校验、认证、存储和错误处理；PostgreSQL 集成测试在独立测试库验证真实数据库操作；Playwright 在桌面和手机尺寸下验证搜索、收藏、编辑、筛选和删除等浏览器流程。还检查前端和 Lambda 的生产构建，以及 Android 类型检查和 JavaScript 导出。

模拟响应测试负责稳定验证逻辑，真实 API 和数据库验收则证明线上链路能够工作。健康检查只能说明进程和配置状态，不能单独证明数据库读写成功，所以还要结合收藏接口和实际 SQL 查询。

在持续集成方面，推送到 main 后，GitHub Actions 自动运行检查，数据库测试使用独立 PostgreSQL 容器。CI 成功后，发布工作流使用同一个提交进行构建和发布。

前端在 GitHub 托管 Runner 上构建，通过 Wrangler 和 GitHub Secrets 中的 Cloudflare 凭证发布。

后端最初考虑 OIDC，但当前组织策略限制了相关操作，因此最终采用专用 EC2 自托管 Runner。Lambda 包仍在 GitHub 托管 Runner 上构建，生成 ZIP 和 SHA256 校验文件，作为 Artifact 上传。专用 EC2 下载并校验构建包，再使用实例角色更新指定 Lambda 的代码，并等待更新完成、执行健康检查。

这台 EC2 只负责部署，不负责业务请求，也不承担数据库跳板机的职责。它通过 Session Manager 管理，运行后台 Runner 服务。GitHub 中不需要保存长期 AWS Access Key。

基础设施变更与代码发布分开管理，每次发布不会自动重建数据库、VPC 和 NAT。前后端任务独立发布，目前也没有实现跨平台原子发布和自动回滚。

**12．Android：复用云端数据并完成同步演示**

画面建议：在模拟器打开独立 APK，展示连接、列表、搜索、详情和刷新。

Android 端使用 Expo、React Native 和 TypeScript，主要负责展示已收藏用户。网页承担搜索 GitHub、添加收藏、编辑和删除，Android 提供列表、筛选、详情和跳转 GitHub。

它直接调用现有 AWS HTTPS API，不需要另建移动端后端。首次输入项目令牌后，使用 SecureStore 保存连接信息，重新打开应用时可以恢复连接。

应用支持按姓名、备注和标签搜索，支持手动刷新和下拉刷新，也处理令牌错误、网络异常、请求超时和空列表。刷新失败时保留已有内容。

构建过程中遇到过 Expo 与 Android SDK 的兼容问题，最终调整为可构建的稳定 SDK 组合，并通过 GitHub Actions 的独立工作流生成 APK、校验值和包信息。安装包内包含 JavaScript 资源，不需要运行本地 Metro 开发服务器。

接下来我在网页修改一条收藏备注，然后回到 Android 下拉刷新，可以看到新备注。这说明两个客户端访问的是同一套云端数据。这里展示的是可安装的课程演示 App，并没有发布到应用商店。

**13．问题排查与本次收获**

画面建议：回到架构图，简要回顾解决的问题。

这次作业中，几个问题对我帮助比较大。

第一个是 Aurora 部署失败。我学会了从堆栈事件找最早失败的资源，区分真正原因与后续资源被取消创建的连带错误。

第二个是 SSH 连接问题。超时可能来自安全组来源 IP 与本机实际出口不一致，私钥权限过宽则需要收紧 Windows 文件权限，不能把所有连接失败都当成同一种问题。

第三个是私有子网中的 Lambda 访问 GitHub，需要同时理解路由表、NAT 和 IGW；数据库内网连接则是另一条路径。

第四个是前后端分开部署后的 CORS 和令牌配置，以及组织策略限制 OIDC 后，如何利用专用 Runner 和实例角色完成部署。

通过这些过程，我不只是完成了网页功能，也理解了请求从客户端进入云端、完成权限校验、访问数据库、再返回结果的完整过程，以及怎样用测试、日志和实际数据确认系统正常。

最后，这次项目完成了 GitHub 搜索、数据库收藏管理、云端部署、VPC 网络、跳板机管理、持续集成与发布，以及 Android 同步展示，形成了一个可以实际访问和演示的全栈应用。以上就是我的作业总结，谢谢老师。

---

**录制时可直接使用的资料**

- 在线网页：https://octoshelf-github-search.mengtaojob-7a7.workers.dev/
- GitHub 仓库：https://github.com/mengtaojob/aws-github-search
- API 基址：https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com
- 架构图：docs/octoshelf-system-architecture-imagegen-v3.png；也可选 docs/octoshelf-system-architecture-comic.png。
- Android 安装包：dist/android-apk/OctoShelf-android-demo.apk。

**可供录屏展示的数据库查询**

在已连接正确 RDS 的 psql 中执行，只读查询，不修改记录：

```sql
SELECT profile->>'login' AS login, note, tags, updated_at
FROM public.github_users
ORDER BY updated_at DESC;
```

网页修改备注后重新查询，再到 Android 刷新，形成“网页写入 → 数据库查询 → App 同步”的证据链。

**录制前准备**

1. 打开网页、架构图、GitHub Actions、AWS 资源页面和 Android 模拟器。
2. 预先连接好数据库；令牌输入、SSH 私钥路径及密码输入过程尽量不录入视频。
3. 准备一条临时收藏用于删除演示，避免删除要保留的数据。
4. 展示 Actions 的成功记录和对应提交；Android 展示独立 APK 的原生运行画面。
5. 若网页或 App 暂时加载较慢，保留实际结果，剪去等待时间即可；不必为了录视频重新部署基础设施或迁移数据库。
6. 演示后如需清理云资源，按依赖关系另行处理；关闭本机终端不会停止 RDS、NAT 和 EC2 的资源费用。资源清理不列为本次已经完成的结果。

**容易讲错的地方**

- 最终是普通 RDS PostgreSQL，不是 Aurora Serverless。
- 当前前端是 Cloudflare Workers 静态资源服务，不是 S3/CloudFront，也不因历史 ZIP 名称而称为 Pages。
- 浏览器直接访问 API Gateway；Cloudflare 没有承担独立业务鉴权代理。
- 业务请求不经过跳板机；数据库访问不经过 NAT。
- SSH 数据库跳板机和 SSM 管理的部署 Runner 是两台不同用途的 EC2。
- 当前后端发布使用 EC2 实例角色，不宣称已配置 OIDC 或在 GitHub 保存长期 AWS 密钥。
- 共享项目令牌不等于多用户登录系统，Android 端当前是收藏展示端。
- 不把历史测试数量当成本次最新重跑结果；不把模板存在当作云资源已部署的证据。
