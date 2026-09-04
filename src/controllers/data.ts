import type { ChatSession } from "../domain/types";
import { exportChat, removeLegacyApiKey, storageUsage } from "../services/local-data";
import { PersistenceService } from "../services/persistence";
import { SidepanelStore } from "../stores/app";
import { SettingsView } from "../views/settings-view";

type DataControllerCallbacks = {
  renderChat: () => void;
  reportStorageError: () => void;
  stopGenerating: (session: ChatSession) => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export class DataController {
  constructor(
    private readonly store: SidepanelStore,
    private readonly view: SettingsView,
    private readonly persistence: PersistenceService,
    private readonly callbacks: DataControllerCallbacks,
  ) {}

  async refreshStorageUsage(): Promise<void> {
    this.view.setStorageStatus(await storageUsage());
  }

  exportCurrentChat(): void {
    const session = this.store.activeChat;
    if (!session || session.messages.length === 0) {
      this.view.setStorageStatus("There are no messages to export.");
      return;
    }

    exportChat(session, this.store.chats.indexOf(session), this.store.customEndpoints);
    this.view.setStorageStatus("Current chat exported.");
    this.callbacks.notify("Chat exported.", "success");
  }

  clearAllChatMessages(): void {
    if (!window.confirm("Clear the messages in every chat? This cannot be undone.")) return;
    for (const session of this.store.chats) {
      if (session.controller) this.callbacks.stopGenerating(session);
      session.messages = [];
      session.error = "";
      session.retryStatus = "";
      session.hasNewContent = false;
      session.scrollTop = 0;
      session.stickToBottom = true;
    }
    this.callbacks.renderChat();
    void this.persistence
      .save()
      .then(() => {
        this.callbacks.notify("All chat messages cleared.", "success");
        return this.refreshStorageUsage();
      })
      .catch(() => {
        this.callbacks.notify("Could not clear chat messages.", "error");
        this.callbacks.reportStorageError();
      });
  }

  clearAllApiKeys(): void {
    if (!window.confirm("Remove every saved API key?")) return;
    for (const session of this.store.chats) session.config.apiKey = "";
    this.view.setApiKey("");
    void Promise.all([this.persistence.save(), removeLegacyApiKey()])
      .then(() => {
        this.view.setStorageStatus("All API keys removed.");
        this.callbacks.notify("All API keys removed.", "success");
        void this.refreshStorageUsage();
      })
      .catch(() => {
        this.callbacks.notify("Could not remove API keys.", "error");
        this.callbacks.reportStorageError();
      });
  }
}
