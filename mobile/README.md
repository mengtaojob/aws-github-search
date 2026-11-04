# OctoShelf Android 展示端

Expo / React Native App，用来展示网页已收藏到同一后端的 GitHub 用户。支持姓名/备注/标签过滤、下拉刷新、打开 GitHub 主页。写入操作在网页端完成，与老师“展示系统添加进去的信息”的移动端要求对应。

## 启动

在本项目的 `mobile` 子目录打开终端：

```powershell
npm ci
npm start
```

安装与 SDK 58 匹配的 Expo Go 后扫码，或配置 Android Studio 模拟器后执行 `npm run android`。

App 中填写：

- AWS 部署：填 CloudFormation 的 `ApiUrl`，以及项目访问令牌。
- Android 模拟器访问本机 API：`http://10.0.2.2:3001`，本地默认无需令牌。
- 真机访问本机 API：先将根目录 `.env` 的 `HOST` 设为 `0.0.0.0`，重启 API；手机和电脑在同一局域网，填写 `http://电脑局域网IP:3001`。Windows 防火墙按需允许私有网络端口，不要将开发 API 暴露到公网。

Android App 内的 `localhost` 指向手机或模拟器，不是开发电脑。若开发环境拒绝明文 HTTP，直接使用已部署的 AWS HTTPS API。

令牌仅保存在 App 内存，关闭后重新输入。不要把令牌硬编码进 App、app.json 或 EXPO_PUBLIC 环境变量。

## 校验

```powershell
npm run typecheck
npm run export:android
```

这两个命令分别检查 TypeScript 和 Metro Android JavaScript 打包，不会生成 APK，也不证明真机运行成功。

`package.json` 对构建工具的传递依赖 glob/minimatch 指定了已修复版本，避免当前 Expo 工具链默认版本中的拒绝服务漏洞。安装后已验证类型检查与 Android JS 导出；升级 Expo 时应重新检查这些 overrides 是否仍需要。

## 构建可安装 APK

本地原生构建需要 Android Studio、SDK 与匹配的 JDK；EAS 云构建需要你自己的 Expo 账号，可能消耗构建额度。确认账号和额度后运行：

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

`eas.json` 的 preview profile 输出内部测试 APK，production profile 输出用于应用商店的 AAB。首次 EAS 构建会引导关联项目和 Android 签名配置；不要提交签名私钥。

验收时：先在网页收藏用户 → 手机连接相同 API → 下拉刷新 → 检查备注/标签 → 点击卡片打开 GitHub。保留真机或模拟器截图，APK 需实际安装验证。
