# AI Chat Playground

A minimal Chrome/Edge side-panel extension for testing OpenAI-compatible Chat Completions APIs with SSE streaming.

## Development

```bash
npm install
npm run build
```

The unpacked extension is generated in `dist/`.

## Source architecture

`src/` is the source root and is organized by responsibility:

- `entries/` contains the side-panel and background entry points only.
- `controllers/` coordinates app startup and feature-specific user actions.
- `stores/` owns the application state and persistence shape.
- `views/` renders DOM and emits typed UI events.
- `services/` contains API, persistence, storage, favicon, and export side effects.
- `domain/` contains shared types and provider/configuration logic.
- `lib/` contains generic rendering utilities.

Extension icons are stored in `src/assets/icons/` at 16, 32, 48, 128, and 512 pixels. The editable vector source is `src/assets/app-icon.svg`; the 128px PNG is used by the Chrome Web Store package.

## Chrome

```text
chrome://extensions
→ Developer mode
→ Load unpacked
→ Select the generated dist folder
```

Click the extension icon to open the side panel.

## Edge

```text
edge://extensions
→ Developer mode
→ Load unpacked
→ Select the dist folder
```

Click the extension icon to open the side panel.

## Usage

Open Settings, choose a built-in provider or use a custom endpoint, then enter:

- Base URL (automatically filled for a built-in provider)
- Optional API Key (leave empty for local OpenAI-compatible servers)
- Model
- Optional System Prompt
- Optional advanced parameters: Temperature, Max Tokens, Top P, and Seed

Built-in OpenAI-compatible endpoint presets include OpenAI, OpenRouter, GLM, Qwen, MiniMax (Global and China), DeepSeek, Moonshot, SiliconFlow, Groq, Gemini, and xAI. For another endpoint, enter its Base URL and click **+ URL** to save it into the Provider dropdown. Saved custom endpoints can be removed with the **−** button.

After entering the Base URL (and API Key when required), click **Load** beside Model to fetch the provider's complete OpenAI-compatible `/models` response. The Model field becomes a native dropdown like Provider. Choose **Custom model…** to type a model name manually. Save the configuration, then chat directly in the side panel. **Test** sends a small non-streaming Chat Completions request to verify the current endpoint and model. Enter sends a message; Shift+Enter inserts a new line. During streaming, **Send** changes to **Stop**, and Escape also stops generation. If a request fails before producing output, the original message is restored to the composer. Retryable `429/500/502/503/504` responses are retried up to twice with cancellable backoff. Assistant responses render GitHub-flavored Markdown, including headings, lists, links, tables, inline code, and fenced code blocks. Assistant messages can be copied or regenerated, code blocks have their own Copy button, and compatible `reasoning_content` output appears in a collapsed Thinking section.

Use the **+** tab button to open another independent chat for a different API. Each tab has its own API configuration, model, messages, streaming request, Stop action, and Clear action. Tabs can continue streaming while you switch between them.

API configurations, open tabs, chat messages, Markdown responses, and reasoning output are stored locally in `chrome.storage.local`. **Clear** removes the current tab's saved messages. The Local data section shows storage usage, exports the current chat as Markdown, clears all chat messages, or removes all saved API keys. Streaming follows the bottom only while the user is already near it; otherwise a **New content** button appears. When an endpoint is saved or used, the extension requests access only to that API origin. See [PRIVACY.md](PRIVACY.md) for the complete data-handling policy.
