# 前端发布到 Cloudflare Pages

当前前端使用 Next.js 静态导出，后端继续使用 AWS API Gateway、Lambda 和现有 Aurora。

## 本地构建与打包

在项目根目录的 PowerShell 中执行：

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = 'https://bya6zpuudd.execute-api.ap-southeast-2.amazonaws.com'
npm run build:web
New-Item -ItemType Directory -Force -Path dist/cloudflare | Out-Null
Compress-Archive -Path out/* -DestinationPath dist/cloudflare/octoshelf-pages.zip -Force
```

确认构建成功后再打包。压缩包根目录应包含 `index.html` 和 `_next`；只上传构建产物，不上传项目源码、`.env` 或 Lambda 包。项目访问令牌由使用者在网站的连接设置中输入，不能写入 `NEXT_PUBLIC_*`。

## 首次发布

1. 登录 https://dash.cloudflare.com/，进入自己的账户。
2. 打开 **Workers & Pages**，点击 **Create application**，进入 **Pages / Get started**，选择 **Drag and drop your files**（直接上传文件）。
3. 项目名可以填 `octoshelf-github-search`，上传 `dist/cloudflare/octoshelf-pages.zip`，点击 **Deploy site / Save and Deploy**。
4. 记录实际分配的生产域名，例如 `https://octoshelf-github-search.pages.dev`；以控制台显示为准。

直接上传项目以后可以通过 GitHub Actions 调用 Wrangler 自动部署；不能在同一项目切换为 Cloudflare 自带的 Git 集成。作业要求的 GitHub Actions 可以沿用直接上传项目完成。

## 配置 AWS 允许的新网站来源

获取实际生产域名后，更新 `octoshelf-free-api` 堆栈的 `AllowedOrigins` 参数，保留原来的本地来源并追加该 HTTPS 域名。应通过 CloudFormation 更新，保留其它参数和现有资源。不要直接执行旧的完整 VPC 模板，也不要重建数据库。

更新前，网页能打开但浏览器可能拦截跨域 API 请求。更新后，在 Pages 网站的连接设置中输入自己的项目访问令牌，验证收藏列表、备注和标签。新域名与本地网页的浏览器会话相互独立，需要重新输入令牌。

## 官方说明

- [Cloudflare Pages 直接上传](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Next.js 静态网站部署](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
- [直接上传与持续集成](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
