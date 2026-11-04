# 首次 AWS 部署失败诊断

日期：2026-11-04。通过 AWS 只读 API 核验，未升级账号、未删除 Stack、未重试创建资源。

## 根因

最先出现实际错误的资源是 `DatabaseCluster`（AWS::RDS::DBCluster）。RDS 返回：

> To use Aurora clusters with free plan accounts you need to set WithExpressConfiguration.

`freetier get-account-plan-state` 返回 `accountPlanType=FREE`、`accountPlanStatus=ACTIVE`。

Aurora 版本/实例类型可订购和 SAM 模板语法正确，不代表账户计划允许使用该资源配置。之前的部署前检查遗漏了这个限制。

## 不能直接加 Express 标志的原因

当前区域 CloudFormation 的 DBCluster schema 确实支持 `WithExpressConfiguration` 布尔属性，但 [Aurora 官方 Express 文档](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_GettingStartedAurora.AuroraPostgreSQL.ExpressConfig.html) 明确规定：

- Express cluster 不能关联 VPC，不支持配置 VPC 子网组和安全组。
- 通过 Aurora internet access gateway 访问，采用 IAM 数据库认证。
- 自动创建 writer；不能沿用当前模板独立创建实例、指定版本和管理主密码的全部配置。

老师作业要求 Aurora 与 Lambda 位于同一个 VPC。将当前模板直接改成 Express 会改变网络和认证架构，也不符合这一项要求。因此本次未对模板添加该标志。

## 回滚结果

- 业务 Stack `octoshelf-course-dev` 当前为 `ROLLBACK_COMPLETE`。
- `NatAddressA`、`BastionProfile`、`WebDistribution`、`PublicRoutes` 的 CREATE_FAILED 原因是 Resource creation cancelled，属于 Aurora 失败后的连带取消。
- CloudFormation 资源记录显示已创建的大部分资源为 DELETE_COMPLETE。
- `WebBucket` 因 Retain 策略为 DELETE_SKIPPED；S3 对象清单查询超时，本次未确认该桶是否为空。
- SAM 的打包辅助 Stack/S3 桶独立于业务 Stack，仍需后续核对清理。
- 回滚完成不代表所有辅助或保留资源已删除，也不能据此断言没有消耗任何抵扣额度。

## 下一步决策

1. 保持原课程架构：使用允许完整 VPC Aurora 配置的账号计划，例如用户自行确认升级为 Paid plan，或使用老师提供的相应教学账号。升级前应查看剩余额度、有效期、适用范围和计费条款。
2. 保持 Free plan：先与老师确认是否接受调整后的架构。Aurora Express 可以作为另一种学习方案，但不满足 Aurora 与 Lambda 同 VPC 的原要求。

[AWS 官方计划说明](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) 和 [Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/) 说明：Paid plan 下剩余额度按适用规则抵扣，超出额度或不适用抵扣的使用会收费；升级后不能降回 Free plan。

新命令 `npm run aws:preflight` 会在部署前检查账户计划；对当前 FREE 账号返回退出码 2，阻止继续沿用标准 VPC Aurora 方案。检查不会升级账户或创建云资源。

选择路线并解决账户计划/架构兼容问题后，再处理失败 Stack 并生成新的变更集。不要复用已执行失败的旧变更集。
