import { tabLabel } from "../domain/providers";
import { HostPermissionService } from "../services/host-permission";
import { PersistenceService } from "../services/persistence";
import { SidepanelStore } from "../stores/app";
import { ChatView } from "../views/chat-view";
import { SettingsView } from "../views/settings-view";
import { TabsView } from "../views/tabs-view";
import { ToastView } from "../views/toast-view";
import { ChatController } from "./chat";
import { DataController } from "./data";
import { SettingsController } from "./settings";
import { TabsController } from "./tabs";

export class AppController {
  private readonly store = new SidepanelStore();
  private readonly chatView = new ChatView();
  private readonly settingsView = new SettingsView();
  private readonly tabsView = new TabsView();
  private readonly toastView = new ToastView();
  private readonly hostPermission = new HostPermissionService();
  private readonly persistence: PersistenceService;
  private readonly chat: ChatController;
  private readonly data: DataController;
  private readonly settings: SettingsController;
  private readonly tabs: TabsController;

  constructor() {
    this.persistence = new PersistenceService(
      () => this.store.toSavedState(),
      () => this.reportStorageError(),
    );

    this.chat = new ChatController(
      this.store,
      this.chatView,
      this.hostPermission,
      this.persistence,
      {
        renderChat: () => this.renderChat(),
        openSettings: () => this.openSettings(),
        reportStorageError: () => this.reportStorageError(),
        refreshStorageUsage: () => this.data.refreshStorageUsage(),
        onHostPermissionGranted: () => this.tabs.render(),
        notify: (message, tone) => this.toastView.show(message, tone),
      },
    );

    this.data = new DataController(this.store, this.settingsView, this.persistence, {
      renderChat: () => this.renderChat(),
      reportStorageError: () => this.reportStorageError(),
      stopGenerating: (session) => this.chat.stopGenerating(session),
      notify: (message, tone) => this.toastView.show(message, tone),
    });

    this.settings = new SettingsController(
      this.store,
      this.settingsView,
      this.hostPermission,
      this.persistence,
      {
        renderChat: () => this.renderChat(),
        onSettingsSaved: () => {
          this.renderActiveChat();
          this.chatView.focusComposer();
        },
        reportStorageError: () => this.reportStorageError(),
        notify: (message, tone) => this.toastView.show(message, tone),
        onHostPermissionGranted: () => this.tabs.render(),
        onExportChat: () => this.data.exportCurrentChat(),
        onClearAllChats: () => this.data.clearAllChatMessages(),
        onClearAllKeys: () => this.data.clearAllApiKeys(),
      },
    );

    this.tabs = new TabsController(
      this.store,
      this.tabsView,
      this.settingsView,
      this.hostPermission,
      this.persistence,
      {
        renderActiveChat: () => this.renderActiveChat(),
        reportStorageError: () => this.reportStorageError(),
      },
    );

    this.bindControllers();
    this.setReady(false);
  }

  async start(): Promise<void> {
    try {
      this.store.hydrate(await this.persistence.load());
    } catch {
      this.store.initializeFallback("Could not load saved settings.");
    } finally {
      this.store.setReady(true);
      this.setReady(true);
      this.renderActiveChat();
      this.chatView.focusComposer();
    }
  }

  private bindControllers(): void {
    this.chat.bind();
    this.settings.bind();
    this.tabs.bind();
  }

  private setReady(ready: boolean): void {
    this.chatView.setReady(ready);
    this.tabsView.setReady(ready);
    this.settingsView.setReady(ready);
  }

  private renderChat(): void {
    const session = this.store.activeChat;
    if (!session) {
      this.chatView.render(undefined);
      return;
    }
    if (session.messages.length === 0 && !session.error) session.hasNewContent = false;

    const label = tabLabel(
      session,
      this.store.chats.indexOf(session),
      this.store.customEndpoints,
    );
    this.chatView.render(session, {
      provider: label.providerFull,
      model: session.config.model.trim() || "Model not configured",
      configured: Boolean(session.config.baseUrl.trim() && session.config.model.trim()),
    });
  }

  private renderActiveChat(): void {
    const session = this.store.activeChat;
    this.tabs.render();
    this.renderChat();
    if (!session) return;

    this.settingsView.render(session, this.store.customEndpoints);
    this.chatView.setDraft(session.draft);
    this.chatView.setGenerating(session.controller !== null);
    void this.data.refreshStorageUsage();
  }

  private openSettings(): void {
    this.settingsView.setOpen(true);
    this.settingsView.focusBaseUrl();
  }

  private reportStorageError(): void {
    const session = this.store.activeChat;
    if (!session) return;
    session.error = "Could not save chat settings.";
    this.renderChat();
  }
}
