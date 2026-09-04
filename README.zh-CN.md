# AI Chat Playground

一个轻量的 Chrome / Edge 侧边栏扩展，用于测试兼容 OpenAI Chat Completions API 的服务，并支持 SSE 流式响应。

> 本项目主要用于开发和接口测试，不提供模型服务，也不包含任何 API Key。

## 功能

- 在浏览器侧边栏中进行 AI 对话
- 支持 OpenAI-compatible API
- 支持 SSE 流式输出
- 支持停止生成、重试和重新生成回答
- 支持 Markdown、表格、链接和代码块渲染
- 支持代码块复制和完整回答复制
- 支持 reasoning / thinking 内容折叠展示
- 支持多个独立聊天标签页
- 支持内置 Provider 配置和自定义 Endpoint
- 支持从 `/models` 加载模型列表
- 支持 Temperature、Max Tokens、Top P、Seed 等参数
- 支持深色模式
- 配置、API Key 和聊天记录仅保存在浏览器本地

## 支持的 Provider

内置 Endpoint 包括：

- OpenAI
- OpenRouter
- GLM / 智谱
- Qwen / 通义千问
- MiniMax（全球和中国区）
- DeepSeek
- Moonshot / Kimi
- SiliconFlow / 硅基流动
- Groq
- Google Gemini
- xAI

也可以输入其他兼容 OpenAI API 的服务地址，保存为自定义 Endpoint。

## 安装和开发

环境要求：

- Node.js 18 或更高版本
- Chrome 116 或更高版本，或较新的 Microsoft Edge

安装依赖并构建：

```bash
npm install
npm run build
```

构建产物会生成在 `dist/` 目录。

## 本地加载扩展

### Chrome

1. 打开 `chrome://extensions`
2. 开启右上角的“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目中的 `dist/` 目录
5. 点击扩展图标打开侧边栏

### Edge

1. 打开 `edge://extensions`
2. 开启“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择项目中的 `dist/` 目录
5. 点击扩展图标打开侧边栏

## 使用方法

1. 打开 Settings / 设置
2. 选择内置 Provider，或输入自定义 Base URL
3. 输入 API Key（本地服务可以留空）
4. 输入模型名称，或点击 **Load** 从服务端读取模型列表
5. 保存配置后，在聊天框输入内容并发送

快捷操作：

- `Enter`：发送消息
- `Shift + Enter`：换行
- `Escape`：停止生成

点击 **+** 可以新建独立聊天标签。每个标签拥有自己的 API 配置、模型、消息记录和生成状态。

## 权限说明

扩展使用以下权限：

- `sidePanel`：在浏览器侧边栏中显示聊天界面
- `storage`：在本地保存配置、API Key 和聊天记录
- 可选 Host 权限：用户保存或使用 API Endpoint 时，仅请求对应 API 域名的访问权限

扩展不会注入网页脚本，也不会读取浏览历史。请求会直接发送到用户选择的 API Endpoint，而不会经过本项目的服务器。

## 数据和隐私

以下数据会保存在浏览器的 `chrome.storage.local` 中：

- API Endpoint 和模型配置
- API Key
- System Prompt
- 聊天消息和 reasoning 内容
- 聊天标签页及自定义 Endpoint

项目不提供开发者后端，不收集分析数据，不展示广告，也不会出售用户数据。API Key 和聊天内容可能会根据用户操作直接发送到所选择的第三方 API Provider。

详细说明请参阅：[PRIVACY.md](PRIVACY.md)。

## 源码结构

`src/` 是统一源码根目录：

- `entries/`：侧边栏和后台入口
- `controllers/`：应用启动及功能控制器
- `stores/`：应用状态和持久化数据结构
- `views/`：DOM 视图渲染和 UI 事件
- `services/`：API、持久化、存储、Favicon 和导出服务
- `domain/`：共享类型、Provider 和配置逻辑
- `lib/`：通用工具，例如 Markdown 渲染

Provider Logo 使用本地资源，相关许可信息请参阅：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## Chrome Web Store 发布

构建后可以将 `dist/` 目录打包上传到 Chrome Web Store。项目中的商店素材位于 `store-assets/`，发布前还需要准备真实扩展界面截图。

## 开源许可

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
