import type { UiLanguage } from "../lib/i18n";
import type { Message } from "../services/chat-api";
import type { ApiConfig, SavedEndpoint, SendShortcut } from "../services/storage";

export type ChatSession = {
  id: string;
  config: ApiConfig;
  messages: Message[];
  mutationVersion: number;
  draft: string;
  error: string;
  modelOptions: string[];
  modelStatus: string;
  loadingModels: boolean;
  modelController: AbortController | null;
  connectionStatus: string;
  retryStatus: string;
  stickToBottom: boolean;
  scrollTop: number;
  hasNewContent: boolean;
  testingConnection: boolean;
  testController: AbortController | null;
  controller: AbortController | null;
};

export type SidepanelState = {
  chats: ChatSession[];
  activeChatId: string;
  customEndpoints: SavedEndpoint[];
  sendShortcut: SendShortcut;
  language: UiLanguage;
  ready: boolean;
};
