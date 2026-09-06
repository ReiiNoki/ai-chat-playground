# AI Chat Playground

[中文版](README.md)

A lightweight Chrome and Edge side-panel extension for testing OpenAI-compatible chat APIs.

AI Chat Playground is designed for quick API experiments. It does not provide AI models, proxy requests through its own server, or include API keys.

## Features

- Chat with OpenAI-compatible APIs from the browser side panel
- SSE streaming responses that can be stopped at any time
- Automatic retry on failures and response regeneration
- GitHub-flavored Markdown rendering, with copy buttons for answers and code blocks
- Collapsible reasoning / thinking output when supported by the provider
- Multiple independent chat tabs
- Built-in provider presets and custom API endpoints
- Load available models from a provider's `/models` endpoint, plus built-in model suggestions for selected providers
- Advanced parameters including Temperature, Max Tokens, Top P, and Seed
- **English / 简体中文** interface switching
- Configurable send shortcut (`Enter` or `Ctrl/Cmd + Enter`)
- Light and dark themes

## Supported providers

Built-in presets are available for:

- OpenAI
- OpenRouter
- GLM / Zhipu
- Qwen
- MiniMax
- Xiaomi MiMo
- DeepSeek
- Moonshot / Kimi
- SiliconFlow
- Google Gemini
- xAI

Any other service that provides a compatible Chat Completions API can be added as a custom endpoint.

## Getting started

1. Install the extension from the Chrome Web Store, or load a local build for testing.
2. Open the browser side panel from the extension icon.
3. Click **Configure** below the message input to open the settings panel.
4. In the **Connection** section, select a provider or enter a custom Base URL, and add an API key if required.
5. Enter a model name, or click **Load models** to fetch models from the endpoint.
6. Click **Save** and start chatting.

Use the **+** button at the top to create an independent chat tab. Each tab has its own endpoint, model, messages, and generation state.

### Keyboard shortcuts

View and adjust them under **Configure → Keyboard shortcuts**:

- Default: `Enter` sends, `Shift + Enter` inserts a new line
- Alternative: `Ctrl/Cmd + Enter` sends, `Enter` inserts a new line
- `Escape` always stops generation

### Interface language

Switch between 简体中文 and English under **Configure → Language**. The preference is saved locally.

## Privacy and permissions

The extension stores endpoint settings, API keys, prompts, chat history, and interface preferences (language and shortcuts) locally in the browser using `chrome.storage.local`.

Requests are sent directly to the API endpoint selected by the user. The project has no developer-controlled backend, analytics, advertising, or data-selling services.

The extension uses the `sidePanel` and `storage` permissions. Access to an API host is requested only when the user saves or uses that endpoint. The extension does not inject scripts into websites or read browsing history.

Read the full privacy policy: [PRIVACY.md](PRIVACY.md)

## Local development

```bash
npm install       # install dependencies
npm run dev       # Vite dev server
npm run build     # type-check and build to dist/
npm run package   # build and create the store ZIP under release/
```

To test an unpacked version: open `chrome://extensions` or `edge://extensions`, enable developer mode, choose **Load unpacked**, and select the built `dist/` folder.

Store listing artwork can be composed from a panel screenshot with `scripts/store-screenshot.py`.

## Support

Report problems or request features in [GitHub Issues](https://github.com/ReiiNoki/ai-chat-playground/issues).

Provider logos and related notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

This project is available under the [MIT License](LICENSE).
