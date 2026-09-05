import type { Message } from "../services/chat-api";
import {
  createDefaultConfig,
  type ApiConfig,
  type SavedEndpoint,
  type SavedState,
} from "../services/storage";
import type { ChatSession, SidepanelState } from "../domain/types";

function createChat(
  id: string = crypto.randomUUID(),
  config: ApiConfig = createDefaultConfig(),
  messages: Message[] = [],
): ChatSession {
  return {
    id,
    config: { ...config },
    messages: messages.map((message) => ({ ...message })),
    mutationVersion: 0,
    draft: "",
    error: "",
    modelOptions: [],
    modelStatus: "",
    loadingModels: false,
    modelController: null,
    connectionStatus: "",
    retryStatus: "",
    stickToBottom: true,
    scrollTop: 0,
    hasNewContent: false,
    testingConnection: false,
    testController: null,
    controller: null,
  };
}

export class SidepanelStore {
  private readonly state: SidepanelState = {
    chats: [],
    activeChatId: "",
    customEndpoints: [],
    ready: false,
  };

  get chats(): ChatSession[] {
    return this.state.chats;
  }

  get activeChatId(): string {
    return this.state.activeChatId;
  }

  get customEndpoints(): SavedEndpoint[] {
    return this.state.customEndpoints;
  }

  get ready(): boolean {
    return this.state.ready;
  }

  get activeChat(): ChatSession | undefined {
    return this.findChat(this.state.activeChatId);
  }

  setReady(ready: boolean): void {
    this.state.ready = ready;
  }

  hydrate(saved: SavedState): void {
    this.state.chats = saved.chats.map(({ id, config, messages }) =>
      createChat(id, config, messages),
    );
    this.state.activeChatId = saved.activeChatId;
    this.state.customEndpoints = saved.customEndpoints.map((endpoint) => ({ ...endpoint }));

    if (this.state.chats.length === 0) this.state.chats.push(createChat());
    if (!this.activeChat) this.state.activeChatId = this.state.chats[0]?.id ?? "";
  }

  initializeFallback(error = ""): ChatSession {
    const session = createChat();
    session.error = error;
    this.state.chats = [session];
    this.state.activeChatId = session.id;
    this.state.customEndpoints = [];
    return session;
  }

  findChat(id: string): ChatSession | undefined {
    return this.state.chats.find((chat) => chat.id === id);
  }

  switchChat(id: string): boolean {
    if (id === this.state.activeChatId || !this.findChat(id)) return false;
    this.state.activeChatId = id;
    return true;
  }

  addChat(): ChatSession {
    const session = createChat();
    this.state.chats.push(session);
    this.state.activeChatId = session.id;
    return session;
  }

  closeChat(id: string): boolean {
    const index = this.state.chats.findIndex((chat) => chat.id === id);
    if (index < 0) return false;

    this.state.chats.splice(index, 1);
    if (this.state.chats.length === 0) this.state.chats.push(createChat());
    if (id === this.state.activeChatId) {
      this.state.activeChatId =
        this.state.chats[Math.min(index, this.state.chats.length - 1)]?.id ??
        this.state.chats[0]?.id ??
        "";
    }
    return true;
  }

  addEndpoint(endpoint: SavedEndpoint): void {
    this.state.customEndpoints.push(endpoint);
  }

  removeEndpoint(id: string): void {
    this.state.customEndpoints = this.state.customEndpoints.filter(
      (endpoint) => endpoint.id !== id,
    );
  }

  toSavedState(): SavedState {
    return {
      chats: this.state.chats.map(({ id, config, messages }) => ({
        id,
        config,
        messages: messages.map((message) => ({ ...message })),
      })),
      activeChatId: this.state.activeChatId,
      customEndpoints: this.state.customEndpoints.map((endpoint) => ({ ...endpoint })),
    };
  }
}
