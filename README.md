# AI Chat Playground

[English](README.en.md)

一个轻量的 Chrome / Edge 侧边栏扩展，用于测试兼容 OpenAI Chat Completions API 的服务。

AI Chat Playground 适合快速进行 API 接口测试。它不提供 AI 模型，不通过自己的服务器转发请求，也不包含任何 API Key。

## 功能

- 在浏览器侧边栏中使用兼容 OpenAI API 的服务聊天
- 支持 SSE 流式响应，可随时停止生成
- 支持失败自动重试和重新生成回答
- 支持 GitHub 风格 Markdown 渲染、复制回答和代码块
- 支持折叠显示 reasoning / thinking 内容
- 支持多个独立聊天标签页
- 支持内置 Provider 预设和自定义 API Endpoint
- 支持从 Endpoint 的 `/models` 接口加载模型，部分内置 Provider 提供常用模型提示
- 支持 Temperature、Max Tokens、Top P、Seed 等高级参数
- 支持 **简体中文 / English** 界面切换
- 支持自定义发送快捷键（`Enter` 或 `Ctrl/Cmd + Enter`）
- 支持浅色和深色主题

## 支持的 Provider

内置配置包括：

- OpenAI
- OpenRouter
- GLM / 智谱
- Qwen / 通义千问
- MiniMax
- Xiaomi MiMo / 小米
- DeepSeek
- Moonshot / Kimi
- SiliconFlow / 硅基流动
- Google Gemini
- xAI

其他提供兼容 Chat Completions API 的服务，也可以通过自定义 Endpoint 添加。

## 开始使用

1. 从 Chrome Web Store 安装扩展，或加载本地版本进行测试。
2. 点击扩展图标打开浏览器侧边栏。
3. 点击输入框下方的 **Configure** 打开配置面板。
4. 在 **Connection** 分组选择 Provider，或输入自定义 Base URL；需要时填写 API Key。
5. 输入模型名称，或点击 **Load models** 从 Endpoint 获取模型列表。
6. 点击 **Save** 保存配置，然后开始聊天。

点击顶部的 **+** 可以新建独立聊天标签。每个标签都有自己的 Endpoint、模型、消息记录和生成状态。

### 键盘快捷键

在 **Configure → Keyboard shortcuts** 中可查看和修改：

- 默认：`Enter` 发送，`Shift + Enter` 换行
- 也可以改为：`Ctrl/Cmd + Enter` 发送，`Enter` 换行
- `Escape` 始终用于停止生成

### 界面语言

在 **Configure → Language** 中可在简体中文和 English 之间切换，偏好会保存在本地。

## 隐私和权限

扩展会通过 `chrome.storage.local` 将 Endpoint 配置、API Key、提示词、聊天记录以及界面偏好（语言、快捷键）保存在浏览器本地。

请求会直接发送到用户选择的 API Endpoint。本项目没有开发者后端，不使用分析服务或广告，也不会出售用户数据。

扩展使用 `sidePanel` 和 `storage` 权限。只有当用户保存或使用某个 Endpoint 时，扩展才会请求对应 API 域名的访问权限。扩展不会向网页注入脚本，也不会读取浏览历史。

完整隐私政策：[PRIVACY.md](PRIVACY.md)

## 本地开发

```bash
npm install       # 安装依赖
npm run dev       # Vite 开发模式
npm run build     # 类型检查并构建到 dist/
npm run package   # 构建并生成 release/ 下的商店 ZIP
```

如需测试未打包版本：打开 `chrome://extensions` 或 `edge://extensions`，开启开发者模式，选择 **加载已解压的扩展程序**，然后选择构建后的 `dist/` 目录。

商店宣传图可由面板截图合成，脚本见 `scripts/store-screenshot.py`。

## 问题反馈

欢迎在 [GitHub Issues](https://github.com/ReiiNoki/ai-chat-playground/issues) 中反馈问题或提出功能建议。

Provider Logo 及相关许可信息请参阅：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## 开源许可

本项目使用 [MIT License](LICENSE)。
