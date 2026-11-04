# AWS 部署前检查记录

检查日期：2026-11-04。以下查询使用 `aws-course` profile。用户已执行变更集预览，SAM 已准备辅助 S3 桶并上传代码/模板；业务资源尚未正式创建。

后续更新：用户已执行变更集，但 Aurora 因 Free plan 限制创建失败，业务 Stack 已回滚至 ROLLBACK_COMPLETE。当前不能直接重试原部署；详见 [首次部署失败诊断](aws-deployment-failure.md)。下文变更集预览状态为执行前的历史记录。

## 变更集预览核验

- 变更集名称：`samcli-deploy1793778616`。
- 变更集状态：`CREATE_COMPLETE`，表示变更集生成完成，不代表业务 Stack 创建完成。
- 执行状态：`AVAILABLE`，尚未执行。
- 业务 Stack `octoshelf-course-dev`：`REVIEW_IN_PROGRESS`。
- 资源计划：51 项 Add、0 项 Modify、0 项 Remove。这是 CloudFormation 资源条目数量，不是 51 台服务器。
- 参数与计划一致：PostgreSQL 17.5、单 NAT、启用跳板机、项目名 octoshelf-course。
- 正式执行该变更集才会开始创建 Aurora、NAT、EC2、Lambda 等业务资源，并产生相应费用。创建成功后还需初始化数据库表和上传前端。

## 已核验

- SAM CLI 实际执行 `sam validate --lint` 通过。
- Sydney 区域的 RDS 只读查询返回 Aurora PostgreSQL 17.5 / db.serverless 可订购配置。
- Lambda 列表存在原有 `github-user-search`；本次没有修改它。
- 预览之前 Sydney 区域的非删除 CloudFormation Stack 列表为空；随后用户为 `octoshelf-course-dev` 生成了变更集。
- `dist/lambda/` 已有 ES Module、package.json 和 RDS CA 证书。
- Session Manager 插件已安装，用户验证版本为 1.2.896.0。
- Lambda 构建产物已重新生成，构建成功。
- SAM 自身执行 CloudFormation 只读查询成功完成身份认证；用户随后成功生成变更集。
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

1. 变更集预览已完成，辅助 S3 桶和上传对象可能有少量 S3 费用。
2. 核对预览资源清单、确认持续运行费用，并计划实验完成后的清理时间。
3. 准备好后再执行正式部署，不能把预览成功等同于资源已部署。

数据库初始化已提供 `npm run db:migrate:aws`，通过 SSM 隧道执行；脚本语法和帮助输出已检查，真实云端迁移仍须等待 Stack 和隧道创建后验证。
