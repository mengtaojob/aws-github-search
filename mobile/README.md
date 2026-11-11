# OctoShelf Android 收藏展示端

Expo SDK 55 / React Native / TypeScript，展示网页保存到现有 AWS API 的 GitHub 人员。原预置 SDK 58 要求尚不可下载的 Android 37 SDK，因此本轮使用可构建的稳定 SDK 55 兼容组合。

## 已实现

- 连接设置：预设云端 HTTPS API，手动输入项目访问令牌；Android 使用 SecureStore 保存，重启后自动连接，可清除令牌。
- 收藏列表：头像、姓名、GitHub 用户名、简介、备注、标签，支持搜索和下拉刷新；提供手动刷新按钮。
- 人员详情：公司、地区、公开仓库数、关注者、完整备注和标签，支持跳转 GitHub 主页及 Android 返回键。
- 请求超时、无效令牌、网络失败、空列表和头像失败均有处理；刷新失败保留当前数据。
- 第一版仅展示，收藏与编辑继续在网页完成。人员资料是收藏时保存的 GitHub 快照，刷新用于同步网页对收藏、备注和标签的修改。

令牌不写入源码、app.json、EXPO_PUBLIC_* 或构建工作流。APK 安装后使用原来的项目访问令牌，不是 Cloudflare Token。

## 获取 APK（无需 Expo 构建账号）

推送 main 上的 mobile 变更后，GitHub Actions 的 **Build Android APK** 自动构建；也可在 Actions 选择该工作流 → Run workflow → main。

构建成功后下载 **OctoShelf-Android-APK** artifact，解压获得：

- `OctoShelf-android-demo.apk`
- `SHA256SUMS.txt`：文件校验值。
- `package-info.txt`：实际包名、最低 Android 版本和原生架构等信息。

这是用于课程演示的独立安装包，内含 JS bundle，无需启动 Metro。使用 Expo 原生模板的测试签名，不适合直接发布应用商店。GitHub 托管构建可能消耗私有仓库 Actions 分钟额度；不使用专用 AWS Lambda 部署 Runner 进行 Android 编译。

工作流使用 Node 24、JDK 17、Android SDK 36 / build-tools 36.0.0 / NDK 27.1，构建 arm64-v8a 和 x86_64，适配真机及 64 位模拟器。

## 逍遥模拟器安装

当前本机安装位置为 `D:\Program Files\Microvirt\MEmu`。已通过 ADB 确认 Android 9，支持 x86_64 和 arm64-v8a；设备序列号为 `127.0.0.1:21503`。安装命令（APK 路径以实际文件为准）：

```powershell
& 'D:\Program Files\Microvirt\MEmu\adb.exe' -s 127.0.0.1:21503 install -r 'D:\实际路径\OctoShelf-android-demo.apk'
& 'D:\Program Files\Microvirt\MEmu\adb.exe' -s 127.0.0.1:21503 shell am start -n com.homework.octoshelf/.MainActivity
```

也可以把 APK 拖入模拟器安装。首次打开输入项目访问令牌后连接。模拟器中的 localhost 指向模拟器自身，使用默认的 AWS HTTPS 地址即可。

## 验收

1. 安装并启动 APK，确认不依赖本机开发服务器。
2. 输入无效令牌，确认友好错误；输入正确令牌，显示真实收藏。
3. 搜索姓名、备注和标签；查看详情并跳转 GitHub。
4. 网页修改备注，在 App 下拉刷新，确认同步。
5. 彻底关闭并重新打开 App，确认通过 Android 安全存储恢复连接。
6. 清除令牌并断开，确认需要重新输入才能连接。

## 开发与检查

```powershell
cd mobile
npm ci
npm run typecheck
npm run export:android
npm start
```

本地编译另需 Android SDK：`npm run android`。Android JS 导出通过不代表 APK 已生成或模拟器验收通过。`web-preview` 仅用于快速核对界面，浏览器预览不保存令牌，也不能替代原生安全存储测试。

## 本轮验证记录

2026-11-11：移动端类型检查、Android JS 导出及连接/数据校验测试通过；浏览器使用测试 API 数据验证连接错误、列表、详情、搜索、刷新、刷新失败保留数据、断开及窄屏布局。APK 原生构建及模拟器运行结果待后续记录。
