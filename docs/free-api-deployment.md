# 免费计划学习接口的部署

当前已验证：本地网页通过本地 API 将两条收藏写入 Aurora Express 的 github_search.public.github_users。下一阶段将本地 API 迁移至 Lambda，暂时继续使用本地网页。

## 2026-11-07 云端部署验证

Stack `octoshelf-free-api` 已为 CREATE_COMPLETE。API 地址：`https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com`。

已实际验证：/health 返回 200、未认证 /users 返回 401、使用项目令牌的 /users 返回 200 并读到 torvalds 与 TorvaldsDB、缺少搜索关键词返回 400、真实 GitHub 搜索返回 200 且包含 torvalds。浏览器 Origin 为 http://127.0.0.1:3000 时 CORS 放行。验证只读，未修改收藏；项目令牌仅在验证进程内存中使用，未写入文档、前端或配置文件。

本地 `.env` 的 NEXT_PUBLIC_API_BASE_URL 已改为该 API 地址。原配置备份为 `.env.before-cloud-api.backup`，已被 Git 忽略。重启 Next.js 后，在页面连接设置中填写 Secrets Manager 生成的项目访问令牌，再验证网页。数据库 IAM 令牌与这个项目访问令牌用途不同，不能混用。

## 新旧模板必须区分

- `infrastructure/template.yaml`：原课程 VPC 架构，在当前 Free plan 下无法创建，不能继续重试。
- `infrastructure/free-api.yaml`：仅部署 API，使用已有 Express 集群；不创建或修改数据库、VPC、NAT、EC2 或前端托管资源。它仍不满足原课程同 VPC 要求。
- 新 Stack 名为 `octoshelf-free-api`，原有 github-user-search Lambda 和旧失败 Stack 不受本脚本操作。

## 生成预览

在项目根目录的 PowerShell 中执行：

```powershell
.\scripts\preview-free.ps1
```

脚本先只读检查账号仍为 ACTIVE / FREE，读取已存在的 octoshelf-free-db 端点和集群资源 ID，再构建代码和验证模板。随后使用 `--no-execute-changeset` 生成预览，不执行业务资源创建。

该步骤会上传代码，可能消耗少量 S3 抵扣额度。模板名称带 free 表示兼容当前学习路径，不代表资源使用没有价格或消耗。Lambda 请求、API、Secrets、日志以及现有 Aurora 使用会按适用规则消耗额度。脚本不会升级账号。

若 PowerShell 提示脚本执行策略限制，不要修改全局策略；改用当前已安装的 PowerShell 7，仅对本次进程启动：`pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\preview-free.ps1`。

模板已校验为 9 个资源：Secret、LogGroup、IAM Role、Lambda Function、HTTP API、Integration、Route、Stage、Lambda Permission。审核预览资源清单后再执行该变更集；不要先去掉“不执行”选项盲目部署。

## 权限及认证

Lambda 使用自身执行角色生成 IAM 数据库令牌，不依赖本机 aws-course 登录配置，也不携带本机凭证。角色的 rds-db:connect 仅指向现有集群和指定数据库用户；当前课堂演示沿用 postgres，正式产品应拆分业务数据库账号。

公网业务 API 使用新建 Secret 中的共享项目令牌。数据库 IAM 令牌与项目访问令牌是两种不同用途的凭证。CORS 暂时允许 http://127.0.0.1:3000 和 http://localhost:3000。

Lambda 中每次查询归还连接后将其关闭，避免运行环境冻结使空闲连接长期阻止 Aurora 自动暂停。数据库恢复可能超过 HTTP API 超时，恢复后可重试；暂停期间存储等仍可能消耗额度。

## 后续验收

接口的云端只读验收已完成。接下来在网页填写项目访问令牌，验证通过新 API 执行新增、备注标签修改和删除；前端公网托管、Android 和 CI/CD 尚未完成。
