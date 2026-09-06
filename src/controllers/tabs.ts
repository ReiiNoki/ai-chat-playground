import { isBuiltInEndpoint, normalizedBaseUrl } from "../domain/providers";
import { t } from "../lib/i18n";
import { FaviconService } from "../services/favicon";
import { HostPermissionService } from "../services/host-permission";
import { PersistenceService } from "../services/persistence";
import { SidepanelStore } from "../stores/app";
import { SettingsView } from "../views/settings-view";
import { TabsView } from "../views/tabs-view";

type TabsControllerCallbacks = {
  renderActiveChat: () => void;
  reportStorageError: () => void;
};

export class TabsController {
  private readonly faviconService = new FaviconService();
  private readonly customFavicons = new Map<string, string | null>();
  private readonly faviconChecks = new Set<string>();

  constructor(
    private readonly store: SidepanelStore,
    private readonly view: TabsView,
    private readonly settingsView: SettingsView,
    private readonly hostPermission: HostPermissionService,
    private readonly persistence: PersistenceService,
    private readonly callbacks: TabsControllerCallbacks,
  ) {}

  bind(): void {
    this.view.bind({
      onSelect: (id) => this.switchChat(id),
      onClose: (id) => this.closeChat(id),
      onNew: () => this.addChat(),
    });
  }

  render(): void {
    this.view.render(
      this.store.chats,
      this.store.activeChatId,
      this.store.customEndpoints,
      this.customFavicons,
    );
    this.loadCustomFavicons();
  }

  private loadCustomFavicons(): void {
    for (const session of this.store.chats) {
      const baseUrl = normalizedBaseUrl(session.config.baseUrl);
      if (
        !baseUrl ||
        isBuiltInEndpoint(baseUrl) ||
        this.customFavicons.has(baseUrl) ||
        this.faviconChecks.has(baseUrl)
      ) {
        continue;
      }

      this.faviconChecks.add(baseUrl);
      void this.hostPermission
        .hasAccess(baseUrl)
        .then(async (hasAccess) => {
          if (!hasAccess) return null;
          this.customFavicons.set(baseUrl, null);
          return this.faviconService.get(baseUrl);
        })
        .then((favicon) => {
          if (!favicon) return;
          this.customFavicons.set(baseUrl, favicon);
          const faviconIsVisible = this.store.chats.some(
            (chat) => normalizedBaseUrl(chat.config.baseUrl) === baseUrl,
          );
          if (faviconIsVisible) this.render();
        })
        .finally(() => this.faviconChecks.delete(baseUrl));
    }
  }

  private switchChat(id: string): void {
    if (id === this.store.activeChatId || !this.store.findChat(id)) return;
    if (!this.canLeaveActiveChat()) return;
    if (!this.store.switchChat(id)) return;
    this.settingsView.setOpen(false);
    this.callbacks.renderActiveChat();
    void this.persistence.save().catch(this.callbacks.reportStorageError);
  }

  private addChat(): void {
    if (!this.store.ready || !this.canLeaveActiveChat()) return;
    this.store.addChat();
    this.settingsView.setOpen(true);
    this.callbacks.renderActiveChat();
    this.settingsView.focusBaseUrl();
    void this.persistence.save().catch(this.callbacks.reportStorageError);
  }

  private closeChat(id: string): void {
    const session = this.store.findChat(id);
    if (!session) return;
    const wasActive = session.id === this.store.activeChatId;
    if (wasActive && !this.canLeaveActiveChat()) return;
    session.controller?.abort();
    session.testController?.abort();
    session.modelController?.abort();
    if (!this.store.closeChat(id)) return;

    if (wasActive) this.settingsView.setOpen(false);
    this.callbacks.renderActiveChat();
    void this.persistence.save().catch(this.callbacks.reportStorageError);
  }

  private canLeaveActiveChat(): boolean {
    if (!this.settingsView.isOpen() || !this.settingsView.isDirty()) return true;
    return window.confirm(t("Discard unsaved settings and leave this chat?"));
  }
}
