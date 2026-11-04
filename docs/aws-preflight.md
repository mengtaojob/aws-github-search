# AWS 部署前检查记录

检查日期：2026-11-04。以下查询使用 `aws-course` profile；没有创建 Stack、变更集、S3 上传桶或其他云资源。

## 已核验

- SAM CLI 实际执行 `sam validate --lint` 通过。
- Sydney 区域的 RDS 只读查询返回 Aurora PostgreSQL 17.5 / db.serverless 可订购配置。
- Lambda 列表存在原有 `github-user-search`；本次没有修改它。
- Sydney 区域的非删除 CloudFormation Stack 列表为空，计划的新 Stack 名为 `octoshelf-course-dev`。
- `dist/lambda/` 已有 ES Module、package.json 和 RDS CA 证书。
- 已成功执行若干服务的只读 API，不代表全部资源创建权限、服务额度和账户限制已验证。角色名称不能单独证明部署授权。

## 计划参数

| 参数 | 本次课程实验计划 |
| --- | --- |
| Region | ap-southeast-2 |
| Stack | octoshelf-course-dev |
| ProjectName | octoshelf-course |
| DatabaseEngineVersion | 17.5 |
| NatMode | single |
| EnableBastion | true，用于课程跳板机演示与 SSM 隧道 |

主要资源：独立 VPC、6 个子网、IGW、1 个 NAT/EIP、Aurora 集群和 1 个 Serverless v2 writer、Lambda/执行角色、HTTP API、Secrets、S3/CloudFront，以及 EC2 跳板机/SSM 角色。当前 Aurora 最小容量为 0.5 ACU，不自动暂停到零。

## 已查询的基础费率

下列为 Sydney 按需美元标价，未扣除抵扣金、免费额度，也未计税；不是完整账单估算。

| 资源 | 查询到的单位价格 | 本模板基础用量 |
| --- | --- | --- |
| Aurora PostgreSQL Serverless v2 Standard | $0.20 / ACU-hour | 至少 0.5 ACU，即至少 $0.10/hour |
| 单个 Zonal NAT Gateway | $0.059/hour | 1 个，另计数据处理费用 |
| EC2 Linux t3.micro | $0.0132/hour | 启用跳板机时 1 台，另计 EBS、IPv4 等 |

仅 Aurora 最低计算容量和 1 个 NAT 的基础时间费用为 $0.159/hour，连续运行 24 小时约 $3.82。Aurora 扩容至 2 ACU 时计算费用会增加。还需加上数据库存储/I/O/备份、NAT 流量、IPv4、EC2/EBS、Secrets、日志及 API/CDN 等费用；该数值不是总价或上限。

价格来源：AWS Price List Query API（us-east-1 价格查询端点，过滤 Sydney 区域），以及 [AWS RDS 官方 Sydney 价目表](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-southeast-2/index.json)。Aurora 价目表发布日期为 2026-10-29；NAT 查询结果生效日期为 2026-11-01。实际计费以 AWS 账单和部署时价格为准。

## 继续之前

1. 安装 Session Manager 插件，验证 `session-manager-plugin --version`。
2. 确认接受持续运行费用，并计划实验完成后的清理时间。
3. 确认独立 Stack 的参数和待创建资源，再生成并检查部署变更集。

数据库初始化已提供 `npm run db:migrate:aws`，通过 SSM 隧道执行；脚本语法和帮助输出已检查，真实云端迁移仍须等待 Stack 和隧道创建后验证。
