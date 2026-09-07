export type UiLanguage = "en" | "zh-CN";

type Variables = Record<string, string | number>;

const ZH_CN: Record<string, string> = {
  "Custom endpoint": "自定义端点",
  "Save URL": "保存 URL",
  "Remove": "移除",
  "Connection": "连接",
  "Provider": "服务商",
  "Base URL": "基础 URL",
  "API Key": "API 密钥",
  "optional": "可选",
  "Show": "显示",
  "Hide": "隐藏",
  "Model & behavior": "模型与行为",
  "Model": "模型",
  "Load models": "加载模型",
  "Loading": "加载中",
  "Loading models…": "正在加载模型…",
  "System Prompt": "系统提示词",
  "Advanced parameters": "高级参数",
  "Temperature": "温度",
  "Max Tokens": "最大 Token 数",
  "Top P": "Top P",
  "Seed": "随机种子",
  "Provider default": "使用服务商默认值",
  "Language": "语言",
  "Interface language": "界面语言",
  "English": "English",
  "Simplified Chinese": "简体中文",
  "Keyboard shortcuts": "键盘快捷键",
  "Send message with": "发送消息按键",
  "Send message": "发送消息",
  "New line": "换行",
  "Stop generating": "停止生成",
  "Local data": "本地数据",
  "Calculating storage…": "正在计算存储空间…",
  "Export Markdown": "导出 Markdown",
  "Clear all chats": "清空所有聊天",
  "Clear API keys": "清除 API 密钥",
  "Test connection": "测试连接",
  "Testing": "测试中",
  "Cancel": "取消",
  "Save": "保存",
  "Clear": "清空",
  "Configure": "设置",
  "Send": "发送",
  "Stop": "停止",
  "Configure an API, then send a message.": "配置 API 后即可发送消息。",
  "Configure this chat": "配置此聊天",
  "Start a conversation": "开始对话",
  "Choose an API endpoint and model. API keys stay in local Chrome storage.": "选择 API 端点和模型。API 密钥仅保存在 Chrome 本地存储中。",
  "Configure API": "配置 API",
  "Edit settings": "编辑设置",
  "Reply with a short hello": "用一句简短的话打个招呼",
  "Reply with a short hello.": "用一句简短的话打个招呼。",
  "Show a small Markdown example": "展示一个简短的 Markdown 示例",
  "Show a small Markdown example.": "展示一个简短的 Markdown 示例。",
  "Could not save language preference.": "无法保存语言偏好。",
  "Current API": "当前 API",
  "You": "你",
  "Assistant": "助手",
  "Waiting for response…": "正在等待响应…",
  "Thinking": "思考内容",
  "Copy": "复制",
  "Copied": "已复制",
  "Failed": "失败",
  "Regenerate": "重新生成",
  "Error": "错误",
  "↓ New content": "↓ 新内容",
  "Unsaved changes": "有未保存的更改",
  "Type a message...": "输入消息…",
  "Optional for local APIs": "本地 API 可不填写",
  "Stored locally in this browser": "仅保存在此浏览器本地",
  "Available models": "可用模型",
  "New chat": "新建聊天",
  "Close chat": "关闭聊天",
  "Toggle settings": "切换设置",
  "Configure API settings": "配置 API 设置",
  "Show API key": "显示 API 密钥",
  "Hide API key": "隐藏 API 密钥",
  "Open settings": "打开设置",
  "Send message (Enter)": "发送消息（Enter）",
  "Send message (Ctrl/Cmd+Enter)": "发送消息（Ctrl/Cmd+Enter）",
  "Stop generating (Esc)": "停止生成（Esc）",
  "Copied to clipboard.": "已复制到剪贴板。",
  "Copy failed.": "复制失败。",
  "Keyboard shortcut saved.": "快捷键已保存。",
  "Could not save keyboard shortcut.": "无法保存快捷键。",
  "Settings saved.": "设置已保存。",
  "Could not save settings.": "无法保存设置。",
  "Could not save chat settings.": "无法保存聊天设置。",
  "Could not clear the chat.": "无法清空聊天。",
  "Could not clear chat messages.": "无法清空聊天消息。",
  "Could not remove API keys.": "无法移除 API 密钥。",
  "There are no messages to export.": "没有可导出的消息。",
  "Current chat exported.": "当前聊天已导出。",
  "Storage usage unavailable.": "无法获取存储用量。",
  "The API returned no models.": "API 没有返回模型。",
  "Discard unsaved settings?": "放弃未保存的设置吗？",
  "Discard unsaved settings and leave this chat?": "放弃未保存的设置并离开此聊天吗？",
  "Regenerating this response will remove the messages after it. Continue?": "重新生成此回复会移除其后的消息，是否继续？",
  "Clear the messages in every chat? This cannot be undone.": "清空所有聊天中的消息？此操作无法撤销。",
  "Remove every saved API key?": "移除所有已保存的 API 密钥？",
  "Chat cleared.": "聊天已清空。",
  "All chat messages cleared.": "所有聊天消息已清空。",
  "All API keys removed.": "所有 API 密钥已移除。",
  "Chat exported.": "聊天已导出。",
  "Connected · Chat Completions works.": "连接成功 · Chat Completions 可用。",
  "Testing Chat Completions…": "正在测试 Chat Completions…",
  "Requesting API access…": "正在请求 API 访问权限…",
  "Access to this API host was not granted.": "未授予此 API 主机的访问权限。",
  "The API returned no text.": "API 没有返回文本。",
  "Model not configured": "尚未配置模型",
  "Custom model…": "自定义模型…",
  "{model} (custom)": "{model}（自定义）",
};

let currentLanguage: UiLanguage = "en";
const textSources = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;

export function setLanguage(language: UiLanguage): void {
  currentLanguage = language;
  document.documentElement.lang = language;
}

export function getLanguage(): UiLanguage {
  return currentLanguage;
}

export function t(source: string, variables: Variables = {}): string {
  let result = currentLanguage === "zh-CN" ? (ZH_CN[source] ?? translatePattern(source)) : source;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}

function translatePattern(source: string): string {
  const models = source.match(/^(\d+) models? loaded\.$/);
  if (models) return `已加载 ${models[1]} 个模型。`;

  const storage = source.match(/^([\d.]+ (?:B|KB|MB)) used$/);
  if (storage) return `已使用 ${storage[1]}`;

  const saved = source.match(/^Saved · (.+)$/);
  if (saved) return `已保存 · ${saved[1]}`;

  const retry = source.match(/^(\d+) · Retrying in (\d+)s… \((\d+)\/(\d+)\)$/);
  if (retry) return `${retry[1]} · ${retry[2]} 秒后重试…（${retry[3]}/${retry[4]}）`;

  return source;
}

function elementsIn(root: ParentNode): Element[] {
  return root instanceof Element
    ? [root, ...root.querySelectorAll("*")]
    : [...root.querySelectorAll("*")];
}

export function initializeDocumentTranslations(root: ParentNode = document): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const source = textNode.data.trim();
    if (source) textSources.set(textNode, source);
    node = walker.nextNode();
  }

  for (const element of elementsIn(root)) {
    const sources = new Map<string, string>();
    for (const attribute of TRANSLATED_ATTRIBUTES) {
      const source = element.getAttribute(attribute);
      if (source !== null) sources.set(attribute, source);
    }
    if (sources.size > 0) attributeSources.set(element, sources);
  }
}

export function applyDocumentTranslations(root: ParentNode = document): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const source = textSources.get(textNode);
    if (source !== undefined) {
      const current = textNode.data.trim();
      textNode.data = textNode.data.replace(current, t(source));
    }
    node = walker.nextNode();
  }

  for (const element of elementsIn(root)) {
    const sources = attributeSources.get(element);
    if (!sources) continue;
    for (const [attribute, source] of sources) element.setAttribute(attribute, t(source));
  }
}
