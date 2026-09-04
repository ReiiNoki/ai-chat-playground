import type { Message } from "../services/chat-api";
import type { ApiConfig, SavedEndpoint } from "../services/storage";

export type ChatSession = {
  id: string;
  config: ApiConfig;
  messages: Message[];
  draft: string;
  error: string;
  modelOptions: string[];
  modelStatus: string;
  loadingModels: boolean;
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
  ready: boolean;
};
