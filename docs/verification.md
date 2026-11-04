# 本地验证记录

验证日期：2026-11-03。执行环境：Windows PowerShell、Node.js 22.13。

2026-11-04 补充：本地 Docker PostgreSQL 已健康启动，项目 `.env` 已配置为 PostgreSQL。已成功执行 `npm run db:migrate`，并在随机命名的独立临时数据库中通过真实 PostgreSQL CRUD 集成测试（1 项）；测试库已清理，业务收藏未被修改。正在运行的 API 需重启后加载新配置。

| 项目 | 实际结果 |
| --- | --- |
| 根项目 TypeScript | 通过 |
| Vitest 路由、GitHub、存储、Lambda 适配器 | 32 项通过 |
| Playwright 桌面和手机尺寸 | 4 项通过，覆盖搜索、收藏、备注标签编辑、筛选、删除、错误提示 |
| 真实 GitHub API 冒烟 | 通过，torvalds 可搜索到，缺少 q 返回 400 |
| Next.js 生产构建 | 通过，静态导出 out/ |
| Lambda esbuild 构建 | 通过，ES Module 与 RDS CA 证书已生成 |
| CloudFormation | 三份模板通过 cfn-lint；不代表资源已在 AWS 创建 |
| YAML 语法 | 基础设施、GitHub workflows、Compose 均通过解析 |
| Android TypeScript | 通过 |
| Android Metro JS 导出 | 通过，不是 APK 或设备运行验证 |
| npm audit | 根项目与 mobile 均为 0 个已知漏洞 |
| 页面视觉检查 | 真实搜索桌面/手机截图已检查，无页面运行时错误 |

## 未完成的外部环境验证

- 本地 PostgreSQL 集成测试已于 2026-11-04 补验通过；GitHub CI 的独立 PostgreSQL service 已配置，GitHub CI 尚未在远端运行。
- 没有使用 AWS 凭证，没有创建、修改、删除 AWS 资源；Aurora 网络、云端数据库 CRUD、SSM 隧道和云端 API 仍待部署验证。
- 没有创建远端 GitHub 仓库，也没有运行远端 CI/CD。
- 没有生成可安装 APK，没有真机或 Android 模拟器验收。

## 截图

- `screenshots/desktop-search.png`：真实 GitHub 搜索，桌面布局。
- `screenshots/mobile-search.png`：相同功能的手机浏览器布局，不是 Android App 截图。

截图中的总数是当次 GitHub 返回值，不是固定验收断言。截图过程只读搜索接口，不会添加演示用户到个人收藏。
