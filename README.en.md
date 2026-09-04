# AI Chat Playground

[中文版](README.md)

A lightweight Chrome and Edge side-panel extension for testing OpenAI-compatible chat APIs.

AI Chat Playground is designed for quick API experiments. It does not provide AI models, proxy requests through its own server, or include API keys.

## Features

- Chat with OpenAI-compatible APIs from the browser side panel
- SSE streaming responses
- Stop generation with a button or `Escape`
- Retry failed requests and regenerate responses
- GitHub-flavored Markdown rendering
- Copy assistant responses and code blocks
- Collapsible reasoning / thinking output when supported by the provider
- Multiple independent chat tabs
- Built-in provider presets and custom API endpoints
- Load available models from a provider's `/models` endpoint
- Advanced parameters including Temperature, Max Tokens, Top P, and Seed
- Light and dark themes

## Supported providers

Built-in presets are available for:

- OpenAI
- OpenRouter
- GLM / Zhipu
- Qwen
- MiniMax
- DeepSeek
- Moonshot / Kimi
- SiliconFlow
- Groq
- Google Gemini
- xAI

Any other service that provides a compatible Chat Completions API can be added as a custom endpoint.

## Getting started

1. Install the extension from the Chrome Web Store, or load a local build for testing.
2. Open the browser side panel from the extension icon.
3. Open **Settings** and select a provider or enter a custom Base URL.
4. Enter an API key if the provider requires one. Local services may not need a key.
5. Enter a model name, or use **Load** to retrieve models from the endpoint.
6. Save the configuration and start chatting.

Keyboard shortcuts:

- `Enter` — send a message
- `Shift + Enter` — insert a new line
- `Escape` — stop generation

Use the **+** button to create an independent chat tab. Each tab has its own endpoint, model, messages, and generation state.

## Privacy and permissions

The extension stores endpoint settings, API keys, prompts, and chat history locally in the browser using `chrome.storage.local`.

Requests are sent directly to the API endpoint selected by the user. The project has no developer-controlled backend, analytics, advertising, or data-selling services.

The extension uses the `sidePanel` and `storage` permissions. Access to an API host is requested only when the user saves or uses that endpoint. The extension does not inject scripts into websites or read browsing history.

Read the full privacy policy: [PRIVACY.md](PRIVACY.md)

## Local testing

To test an unpacked version, open `chrome://extensions` or `edge://extensions`, enable developer mode, choose **Load unpacked**, and select the built `dist/` folder.

## Support

Report problems or request features in [GitHub Issues](https://github.com/ReiiNoki/ai-chat-playground/issues).

Provider logos and related notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

This project is available under the [MIT License](LICENSE).
