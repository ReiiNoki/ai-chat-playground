import type { UiLanguage } from "../lib/i18n";

export type ApiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  seed: number | null;
};

export type SavedMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
};

export type SavedChat = {
  id: string;
  config: ApiConfig;
  messages: SavedMessage[];
};

export type SavedEndpoint = {
  id: string;
  name: string;
  baseUrl: string;
};

export type SendShortcut = "enter" | "mod-enter";

export type SavedState = {
  chats: SavedChat[];
  activeChatId: string;
  customEndpoints: SavedEndpoint[];
  sendShortcut: SendShortcut;
  language: UiLanguage;
};

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  systemPrompt: "You are a helpful assistant.",
  temperature: null,
  maxTokens: null,
  topP: null,
  seed: null,
};

const STORAGE_KEYS = [
  "chats",
  "activeChatId",
  "customEndpoints",
  "sendShortcut",
  "language",
  "baseUrl",
  "apiKey",
  "model",
  "systemPrompt",
] as const;

export function createDefaultConfig(): ApiConfig {
  return { ...DEFAULT_CONFIG };
}

function optionalNumber(value: unknown, fallback: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readMessages(value: unknown): SavedMessage[] {
  if (!Array.isArray(value)) return [];

  const messages = value.flatMap((item): SavedMessage[] => {
    if (!item || typeof item !== "object") return [];
    const message = item as { role?: unknown; content?: unknown; reasoning?: unknown };
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
    ) {
      return [];
    }

    return [
      {
        role: message.role,
        content: message.content,
        ...(typeof message.reasoning === "string" ? { reasoning: message.reasoning } : {}),
      },
    ];
  });

  const lastMessage = messages.at(-1);
  if (lastMessage?.role === "assistant" && !lastMessage.content && !lastMessage.reasoning) {
    messages.pop();
  }
  return messages;
}

function readConfig(value: unknown, fallback: ApiConfig): ApiConfig {
  if (!value || typeof value !== "object") return { ...fallback };
  const candidate = value as Partial<ApiConfig>;

  return {
    baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl : fallback.baseUrl,
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey : fallback.apiKey,
    model: typeof candidate.model === "string" ? candidate.model : fallback.model,
    systemPrompt:
      typeof candidate.systemPrompt === "string" ? candidate.systemPrompt : fallback.systemPrompt,
    temperature: optionalNumber(candidate.temperature, fallback.temperature),
    maxTokens: optionalNumber(candidate.maxTokens, fallback.maxTokens),
    topP: optionalNumber(candidate.topP, fallback.topP),
    seed: optionalNumber(candidate.seed, fallback.seed),
  };
}

export async function loadState(): Promise<SavedState> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  const sendShortcut: SendShortcut = stored.sendShortcut === "mod-enter" ? "mod-enter" : "enter";
  const language: UiLanguage = stored.language === "zh-CN" ? "zh-CN" : "en";
  const chats = Array.isArray(stored.chats)
    ? stored.chats.flatMap((value): SavedChat[] => {
        if (!value || typeof value !== "object") return [];
        const candidate = value as { id?: unknown; config?: unknown; messages?: unknown };
        if (typeof candidate.id !== "string" || !candidate.id) return [];
        return [
          {
            id: candidate.id,
            config: readConfig(candidate.config, DEFAULT_CONFIG),
            messages: readMessages(candidate.messages),
          },
        ];
      })
    : [];

  const customEndpoints = Array.isArray(stored.customEndpoints)
    ? stored.customEndpoints.flatMap((value): SavedEndpoint[] => {
        if (!value || typeof value !== "object") return [];
        const endpoint = value as { id?: unknown; name?: unknown; baseUrl?: unknown };
        if (
          typeof endpoint.id !== "string" ||
          typeof endpoint.name !== "string" ||
          typeof endpoint.baseUrl !== "string" ||
          !endpoint.id ||
          !endpoint.name ||
          !endpoint.baseUrl
        ) {
          return [];
        }
        return [{ id: endpoint.id, name: endpoint.name, baseUrl: endpoint.baseUrl }];
      })
    : [];

  if (chats.length > 0) {
    const requestedActiveId =
      typeof stored.activeChatId === "string" ? stored.activeChatId : "";
    const activeChatId = chats.some((chat) => chat.id === requestedActiveId)
      ? requestedActiveId
      : (chats[0]?.id ?? "");
    return { chats, activeChatId, customEndpoints, sendShortcut, language };
  }

  // Migrate the original single-configuration storage format.
  const id = crypto.randomUUID();
  const legacyConfig = readConfig(stored, DEFAULT_CONFIG);
  return {
    chats: [{ id, config: legacyConfig, messages: [] }],
    activeChatId: id,
    customEndpoints,
    sendShortcut,
    language,
  };
}

export async function saveState(state: SavedState): Promise<void> {
  await chrome.storage.local.set({
    chats: state.chats,
    activeChatId: state.activeChatId,
    customEndpoints: state.customEndpoints,
    sendShortcut: state.sendShortcut,
    language: state.language,
  });
}
