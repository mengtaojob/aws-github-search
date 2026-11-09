# 专用 EC2 部署 Runner

用户选择新建专用 EC2，避免与跳板机共用机器。模板：`infrastructure/github-runner.yaml`；堆栈：`octoshelf-github-runner`。

已创建实例 `i-04cea0d8ca7ff6374`，Runner `octoshelf-lambda-runner` 注册成功，标签 `octoshelf-lambda-deploy`。已通过 SSM 将前台监听切换为 systemd 后台服务，运行用户为 actions，开机自启。Deploy #10 的 Lambda 构建和部署任务均已成功，已使用实例角色完成真实代码发布；API 健康检查通过。

## 实例与权限

- Ubuntu 24.04 LTS x86_64，t3.micro，16 GiB 加密 gp3 系统盘。
- 复用现有公有子网及 IGW，分配公有 IPv4；无需再建 NAT。
- 不开放入站端口，不配置 SSH 密钥，通过 Session Manager 管理。
- EC2 实例角色包含 SSM 管理权限，以及对现有 `octoshelf-free-api-api` 的 `lambda:UpdateFunctionCode`、`lambda:GetFunctionConfiguration` 权限。没有数据库登录、读取项目令牌或修改 VPC 的权限。
- 使用 IMDSv2，CPU credits 为 standard，避免 unlimited 模式的额外 CPU 积分费用。
- UserData 安装 AWS CLI 和基础工具，创建无 sudo 权限的 `actions` 用户。实例创建完成不等于 UserData 或 GitHub Runner 注册已完成。

EC2、系统盘和公有 IPv4 会计费。停止实例后 Runner 离线，系统盘仍计费；删除堆栈会删除该专用实例和系统盘。不要删除现有 API 或网络堆栈来停止 Runner。

## 创建

变更预览 `create-dedicated-runner` 已准备并通过 SAM lint。执行创建：

```powershell
aws cloudformation execute-change-set --stack-name octoshelf-github-runner --change-set-name create-dedicated-runner --region ap-southeast-2 --profile aws-course
aws cloudformation describe-stacks --stack-name octoshelf-github-runner --region ap-southeast-2 --profile aws-course --query "Stacks[0].StackStatus" --output text --no-cli-pager
```

## 注册（创建完成后继续）

1. 从堆栈输出获取 InstanceId，通过 `aws ssm start-session --target <InstanceId> --region ap-southeast-2 --profile aws-course` 连接。
2. 确认 `/var/lib/octoshelf-runner-bootstrap-complete` 已存在；若无则查看 `/var/log/cloud-init-output.log`。
3. GitHub Settings → Actions → Runners → New self-hosted runner，选择 Linux、x64。使用页面提供的当前下载地址和校验和，不从其他来源下载。
4. 切换 `sudo su - actions`，进入 `/home/actions/actions-runner`，下载、校验、解压 GitHub Runner。
5. 用 GitHub 页面的一次性注册 Token 运行 config.sh，添加标签 `octoshelf-lambda-deploy`。注册 Token 不提交源码、不发到聊天。
6. 安装 Runner 自带依赖时由管理用户执行；服务通过管理用户执行 `sudo ./svc.sh install actions` 和 `sudo ./svc.sh start`。不要以 root 运行 Runner 任务。
7. 确认 GitHub Runner 显示 Idle 后，再改造 AWS 部署 job，构建留在 GitHub 托管执行机，EC2 仅下载构建包及调用 Lambda 更新 API。不为 pull_request job 配置自托管标签。
8. 保持 `AWS_DEPLOY_ENABLED` 关闭，直到 Runner、production 环境仅 main 分支的限制及部署 job 均准备好。

GitHub 建议自托管 Runner 用于私有仓库。公开仓库尤其要防止不受信任的 PR 在 Runner 上执行；专用 EC2 只承担可信 main 分支的正式部署，仍需保护仓库写权限和工作流修改权限。

## 官方说明

- https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners
- https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-instance-profile.html
