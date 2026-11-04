# 实现说明与学习路线

## 先理解代码如何运行

可以把 Hono 的 `createApp()` 看作 NestJS 的路由模块集合：它接收 Request、校验参数、调用服务层，然后返回 Response。`src/server.ts` 是本地 HTTP 适配器，`src/handler.ts` 是 AWS Lambda 适配器。二者使用同一个业务应用。

`src/github.ts` 类似 Spring Service 或 NestJS Injectable，负责外部 GitHub 服务。`UserStore` 类似 Repository 接口，文件与 PostgreSQL 是两种实现。通过 `STORE_DRIVER` 选择，不需要改路由。

## 本地版本与已有线上版本

已有接口契约保留 `GET /search/users?q=torvalds`，返回 `total_count`、`incomplete_results` 和 `items`。本项目做了这些明确调整：

- 每页从交接示例的 10 条调整为 12 条，适配三列/四列卡片；增加 `page`。
- 返回精简用户字段，未透传 GitHub 搜索结果的所有元数据。
- 错误统一为 JSON，上游 5xx 映射为 502，上游超时为 504。
- 增加详情、收藏、鉴权和持久化接口。

因此它保持相同的业务语义，**不是旧函数的逐字节复制**。旧 Lambda 最终代码尚未从 AWS 导出比对，不应直接覆盖部署。需要严格兼容旧客户端时，先导出旧代码和样例响应，再补契约测试。

测试通过后，`npm run build:lambda` 将 TypeScript 打包为 ES Module。Node.js 的 `fetch` 原生可用，因此不需要 Axios；构建采用 esbuild，类型检查由 `tsc` 独立完成。Vitest 负责服务测试，Playwright 负责浏览器交互。

## AWS 概念与本项目对应关系

| AWS 概念 | 通俗解释 | 项目对应 |
| --- | --- | --- |
| CloudFormation | 用声明式文件描述资源及依赖关系 | `infrastructure/template.yaml` |
| Stack | 一组一起创建、更新、删除的资源 | `octoshelf-course-dev` |
| SAM | CloudFormation 的 Serverless 扩展与开发工具 | `AWS::Serverless::Function` |
| IAM Role | 给执行者发的权限清单 | Lambda 读取项目 Secret、写日志、创建 VPC 网卡 |
| Lambda | AWS 托管的按请求执行程序 | `src/handler.ts` |
| API Gateway | 云端 HTTP 入口与请求转发层 | HTTP API v2，默认路由转发到 Hono |
| VPC | 资源所在的私有网络 | Lambda、Aurora、EC2 的共同网络 |
| 安全组 | 资源网卡的有状态访问规则 | 数据库仅允许 Lambda SG 和跳板机 SG 的 5432 |
| NAT Gateway | 让私有子网中的程序主动访问外网 | Lambda 调用 GitHub 和 Secrets Manager |
| IGW | VPC 与互联网之间的网关 | 公有子网默认路由的出口 |
| Aurora Serverless v2 | 可按负载调整计算容量的托管 PostgreSQL | `db.serverless` 数据库实例 |

## 网络设计

两个 AZ，每个 AZ 各有公有、应用私有、数据库隔离子网，共 6 个子网。课程图里的子网数量不是本项目固定模板约束。

- 公有子网：`0.0.0.0/0 → IGW`，放 NAT 与可选 EC2。
- 应用私有子网：`0.0.0.0/0 → NAT`，Lambda 通过 ENI 访问内网。
- 数据库隔离子网：没有互联网默认路由。
- 相同 VPC 内访问数据库走 VPC 的 local 路由，不经过 NAT，也不经过跳板机。

将 Lambda 选进公有子网不会自动给它公网 IP，因此仍需正确的私有子网出网方案。

默认单 NAT 是课程成本/复杂度取舍，AZ B 出网依赖 AZ A，并可能有跨 AZ 数据费用。`NatMode=per-az` 改为每个 AZ 一个 NAT。Aurora 默认只有一个 writer，数据库子网跨 AZ 不等于已部署两个计算实例，也不承诺计算层高可用。

跳板机使用 SSM 端口转发，无入站 22 端口和 SSH 私钥。它仍是独立 EC2 运维跳板机；若老师要求演示 SSH，再按固定管理员 IP 增加 22 端口，不能开放给全网。

## 凭证与边界

数据库密码由 RDS 管理并存入 Secrets Manager，Lambda 从后端读取。生产连接校验 RDS CA。课程版本直接使用 RDS 管理账号读写演示表；扩展为正式产品时，应把建表/运维角色与仅允许业务表 CRUD 的数据库账号分离。

本地文件存储采用单实例串行写入和临时文件替换，避免同一进程并发写入丢失。它不支持多个 Node 进程共享写文件，所以 Lambda 强制使用 PostgreSQL。

当前收藏属于一个共享工作空间。项目访问令牌是一道演示入口，不提供个人隔离、账号找回、租户控制或审计系统。它不会被写入 `NEXT_PUBLIC_*` 前端配置。

## 为什么没有 Layers、NestJS、Cloudflare

本项目业务较小，Hono + esbuild 可以直接打包，暂不需要拆 Layers。Next.js 页面可静态导出，S3/CloudFront 足以托管；Lambda 负责全部业务接口。Cloudflare、Layers 和其他框架是参考材料中的可选方案，不是为了凑架构而必须增加的资源。
