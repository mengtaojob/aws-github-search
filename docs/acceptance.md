# 课程验收清单

下面区分代码交付与需要实际部署/设备完成的证据。没有实际执行的操作不得标记为通过。

| 原始要求 | 对应实现 | 需要收集的演示证据 |
| --- | --- | --- |
| Next.js 搜索 GitHub 用户 | `app/page.tsx`、`src/github.ts` | 搜索 torvalds，显示真实结果 |
| 加入数据库、删除、修改 | Repository + PostgreSQL、SQL migration | PostgreSQL/Aurora 中完整 CRUD，重启后仍可查询 |
| 接口部署 Lambda | `src/handler.ts`、SAM 模板 | 新 Lambda 配置与 HTTP API 调用截图 |
| VPC 出网 | IGW、公有 NAT、应用私有子网 | 路由表、Lambda GitHub 请求成功 |
| Aurora Serverless 与 Lambda 同 VPC | `DatabaseCluster`、`DatabaseInstance`、`VpcConfig` | 同 VPC、db.serverless、数据库无公网访问 |
| 数据库跳板机管理 | 可选 SSM EC2 跳板机 | 开启 EnableBastion，SSM 隧道查询数据库 |
| GitHub Actions CI/CD | 两个 workflows + OIDC role 模板 | CI 通过、启用后的部署记录与页面更新 |
| Android App 展示已保存用户 | `mobile/` | 真机或模拟器加载云端收藏，APK 安装演示 |

## 建议提交材料

1. GitHub 仓库地址、README 和架构图。
2. 可访问的前端 URL；访问令牌单独私下提供，不能放公开 README。
3. API 示例、测试命令和测试结果。
4. AWS 资源与网络截图，遮盖账号信息和 Secrets 值。
5. Android 安装包或设备演示录像。
6. 演示结束后的资源清理记录。

截图目录可使用 `docs/screenshots/`。本地界面截图仅证明 UI 状态，不代表 AWS 或 Android 部署已完成。

## 与材料的关系

- 老师「周日作业」截图是功能验收范围。
- CloudFormation PDF 是课程知识和部署方法参考；截图没有单列 CloudFormation 强制项。
- 流程漫画是架构参考，本项目前端托管采用 AWS S3/CloudFront，没有额外引入 Cloudflare。
- 截图上方 better-stack dynamic workflow 是周六作业，未混入这个周日项目。
