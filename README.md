# AI Chat Playground

[English](README.en.md)

一个轻量的 Chrome / Edge 侧边栏扩展，用于测试兼容 OpenAI Chat Completions API 的服务。

AI Chat Playground 适合快速进行 API 接口测试。它不提供 AI 模型，不通过自己的服务器转发请求，也不包含任何 API Key。

## 功能

- 在浏览器侧边栏中使用兼容 OpenAI API 的服务聊天
- 支持 SSE 流式响应
- 支持按钮或 `Escape` 停止生成
- 支持失败重试和重新生成回答
- 支持 GitHub 风格 Markdown 渲染
- 支持复制回答和代码块
- 支持折叠显示 reasoning / thinking 内容
- 支持多个独立聊天标签页
- 支持内置 Provider 和自定义 API Endpoint
- 支持从 Endpoint 的 `/models` 接口加载模型
- 支持 Temperature、Max Tokens、Top P、Seed 等高级参数
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
- Groq
- Google Gemini
- xAI

其他提供兼容 Chat Completions API 的服务，也可以通过自定义 Endpoint 添加。

## 开始使用

1. 从 Chrome Web Store 安装扩展，或加载本地版本进行测试。
2. 点击扩展图标打开浏览器侧边栏。
3. 打开 **Settings / 设置**，选择 Provider，或输入自定义 Base URL。
4. 如果服务需要，输入 API Key；本地服务通常可以留空。
5. 输入模型名称，或点击 **Load** 从 Endpoint 获取模型列表。
6. 保存配置，然后开始聊天。

快捷操作：

- `Enter`：发送消息
- `Shift + Enter`：换行
- `Escape`：停止生成

点击 **+** 可以新建独立聊天标签。每个标签都有自己的 Endpoint、模型、消息记录和生成状态。

## 隐私和权限

扩展会通过 `chrome.storage.local` 将 Endpoint 配置、API Key、提示词和聊天记录保存在浏览器本地。

请求会直接发送到用户选择的 API Endpoint。本项目没有开发者后端，不使用分析服务或广告，也不会出售用户数据。

扩展使用 `sidePanel` 和 `storage` 权限。只有当用户保存或使用某个 Endpoint 时，扩展才会请求对应 API 域名的访问权限。扩展不会向网页注入脚本，也不会读取浏览历史。

完整隐私政策：[PRIVACY.md](PRIVACY.md)

## 本地测试

如需测试未打包版本，打开 `chrome://extensions` 或 `edge://extensions`，开启开发者模式，选择 **加载已解压的扩展程序**，然后选择构建后的 `dist/` 目录。

## 问题反馈

欢迎在 [GitHub Issues](https://github.com/ReiiNoki/ai-chat-playground/issues) 中反馈问题或提出功能建议。

Provider Logo 及相关许可信息请参阅：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

## 开源许可

本项目使用 [MIT License](LICENSE)。
