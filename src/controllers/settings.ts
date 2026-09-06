import { t, type UiLanguage } from "../lib/i18n";
import {
  NETWORK_ERROR,
  parseBaseUrl,
  validateConfig,
  validateCredentialTransport,
} from "../domain/config";
import { isBuiltInEndpoint, normalizedBaseUrl } from "../domain/providers";
import { ApiError, listModels, testChatConnection } from "../services/chat-api";
import { HostPermissionService } from "../services/host-permission";
import { PersistenceService } from "../services/persistence";
import type { ApiConfig, SavedEndpoint, SendShortcut } from "../services/storage";
import { SidepanelStore } from "../stores/app";
import { SettingsView } from "../views/settings-view";

type SettingsControllerCallbacks = {
  renderChat: () => void;
  onSettingsSaved: () => void;
  reportStorageError: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
  onHostPermissionGranted: () => void;
  onExportChat: () => void;
  onClearAllChats: () => void;
  onClearAllKeys: () => void;
  onSendShortcutChanged: (shortcut: SendShortcut) => void;
  onLanguageChanged: (language: UiLanguage) => void;
};

export class SettingsController {
  private saveInProgress = false;

  constructor(
    private readonly store: SidepanelStore,
    private readonly view: SettingsView,
    private readonly hostPermission: HostPermissionService,
    private readonly persistence: PersistenceService,
    private readonly callbacks: SettingsControllerCallbacks,
  ) {}

  bind(): void {
    this.view.bind({
      onToggle: () => this.toggleSettings(),
      onCancel: () => this.cancelSettings(),
      onSave: (config) => void this.saveSettings(config),
      onLoadModels: (baseUrl, apiKey) => void this.loadAvailableModels(baseUrl, apiKey),
      onTestConnection: (config) => void this.testCurrentConnection(config),
      onSaveEndpoint: (baseUrl) => this.saveCurrentEndpoint(baseUrl),
      onRemoveEndpoint: (endpointId) => this.removeCurrentEndpoint(endpointId),
      onConnectionChange: (clearModels) => this.handleConnectionChange(clearModels),
      onSendShortcutChange: (shortcut) => this.saveSendShortcut(shortcut),
      onLanguageChange: (language) => this.saveLanguage(language),
      onExportChat: this.callbacks.onExportChat,
      onClearAllChats: this.callbacks.onClearAllChats,
      onClearAllKeys: this.callbacks.onClearAllKeys,
    });
  }

  private toggleSettings(): void {
    if (!this.view.isOpen()) {
      this.view.setOpen(true);
      return;
    }
    if (this.view.isDirty() && !window.confirm(t("Discard unsaved settings?"))) return;
    this.cancelSettings();
  }

  private cancelSettings(): void {
    const session = this.store.activeChat;
    if (session) {
      this.view.render(
        session,
        this.store.customEndpoints,
        this.store.sendShortcut,
        this.store.language,
      );
    }
    this.view.setOpen(false);
  }

  private async saveSettings(config: ApiConfig): Promise<void> {
    const session = this.store.activeChat;
    if (!session || this.saveInProgress) return;

    const configurationError = validateConfig(config);
    if (configurationError) {
      session.connectionStatus = configurationError;
      this.view.setConnectionStatus(configurationError);
      return;
    }
    this.saveInProgress = true;
    try {
      if (!(await this.hostPermission.requestAccess(config.baseUrl))) {
        session.connectionStatus = "Access to this API host was not granted.";
        if (session.id === this.store.activeChatId) this.view.setConnectionStatus(session.connectionStatus);
        return;
      }

      this.callbacks.onHostPermissionGranted();
      session.config = { ...config };
      await this.persistence.save();
      session.error = "";
      if (session.id === this.store.activeChatId) {
        this.view.setOpen(false);
        this.callbacks.notify("Settings saved.", "success");
        this.callbacks.onSettingsSaved();
      }
    } catch {
      session.error = "Could not save settings.";
      this.callbacks.notify("Could not save settings.", "error");
      if (session.id === this.store.activeChatId) this.callbacks.renderChat();
    } finally {
      this.saveInProgress = false;
    }
  }

  private saveLanguage(language: UiLanguage): void {
    this.store.setLanguage(language);
    this.callbacks.onLanguageChanged(language);
    void this.persistence.save().catch(() => {
      this.callbacks.notify("Could not save language preference.", "error");
      this.callbacks.reportStorageError();
    });
  }

  private saveSendShortcut(shortcut: SendShortcut): void {
    this.store.setSendShortcut(shortcut);
    this.callbacks.onSendShortcutChanged(shortcut);
    void this.persistence
      .save()
      .then(() => this.callbacks.notify("Keyboard shortcut saved.", "success"))
      .catch(() => {
        this.callbacks.notify("Could not save keyboard shortcut.", "error");
        this.callbacks.reportStorageError();
      });
  }

  private handleConnectionChange(clearModels: boolean): void {
    const session = this.store.activeChat;
    if (!session) return;
    session.testController?.abort();
    session.testController = null;
    session.testingConnection = false;
    this.view.setTesting(false);
    if (clearModels) {
      session.modelController?.abort();
      session.modelController = null;
      session.loadingModels = false;
    }
    session.connectionStatus = "";
    this.view.setConnectionStatus("");
    if (!clearModels) return;

    session.modelOptions = [];
    session.modelStatus = "";
    this.view.renderModelOptions(session);
  }

  private saveCurrentEndpoint(value: string): void {
    const normalized = normalizedBaseUrl(value);
    const parsed = parseBaseUrl(normalized);
    if (!parsed) {
      this.view.setEndpointStatus(
        "Enter an HTTP or HTTPS Base URL without credentials, query parameters, or fragments.",
      );
      return;
    }

    this.view.setBaseUrl(normalized);
    const savedEndpoint = this.store.customEndpoints.find(
      (endpoint) => normalizedBaseUrl(endpoint.baseUrl) === normalized,
    );
    if (savedEndpoint || isBuiltInEndpoint(normalized)) {
      this.view.syncProviderPreset();
      this.view.setEndpointStatus(
        savedEndpoint ? "This endpoint is already saved." : "This endpoint is already built in.",
      );
      return;
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    const endpoint: SavedEndpoint = {
      id: crypto.randomUUID(),
      name: `${parsed.host}${path}`.slice(0, 80),
      baseUrl: normalized,
    };
    this.store.addEndpoint(endpoint);
    this.view.renderCustomEndpoints(this.store.customEndpoints);
    this.view.syncProviderPreset();
    this.view.setEndpointStatus(`Saved · ${endpoint.name}`);

    void this.persistence
      .save()
      .then(() => this.callbacks.notify("Endpoint saved.", "success"))
      .catch(() => {
        this.view.setEndpointStatus("Could not save the endpoint.");
        this.callbacks.notify("Could not save the endpoint.", "error");
        this.callbacks.reportStorageError();
      });
  }

  private removeCurrentEndpoint(endpointId: string): void {
    this.store.removeEndpoint(endpointId);
    this.view.renderCustomEndpoints(this.store.customEndpoints);
    this.view.syncProviderPreset();
    this.view.setEndpointStatus("Saved endpoint removed.");

    void this.persistence
      .save()
      .then(() => this.callbacks.notify("Endpoint removed.", "success"))
      .catch(() => {
        this.view.setEndpointStatus("Could not remove the endpoint.");
        this.callbacks.notify("Could not remove the endpoint.", "error");
        this.callbacks.reportStorageError();
      });
  }

  private async testCurrentConnection(config: ApiConfig): Promise<void> {
    const session = this.store.activeChat;
    if (!session || session.testingConnection) return;

    const configurationError = validateConfig(config);
    if (configurationError) {
      session.connectionStatus = configurationError;
      this.view.setConnectionStatus(configurationError);
      return;
    }

    const controller = new AbortController();
    session.testingConnection = true;
    session.testController = controller;
    session.connectionStatus = "Requesting API access…";
    this.view.setConnectionStatus(session.connectionStatus);
    this.view.setTesting(true);

    if (!(await this.hostPermission.requestAccess(config.baseUrl))) {
      if (session.testController === controller) {
        session.connectionStatus = "Access to this API host was not granted.";
        session.testController = null;
        session.testingConnection = false;
        if (session.id === this.store.activeChatId) {
          this.view.setConnectionStatus(session.connectionStatus);
          this.view.setTesting(false);
        }
      }
      return;
    }
    if (controller.signal.aborted || session.testController !== controller || !this.store.findChat(session.id)) return;
    this.callbacks.onHostPermissionGranted();

    session.connectionStatus = "Testing Chat Completions…";
    if (session.id === this.store.activeChatId) {
      this.view.setConnectionStatus(session.connectionStatus);
      this.view.setTesting(true);
    }

    try {
      await testChatConnection(config, controller.signal);
      session.connectionStatus = "Connected · Chat Completions works.";
    } catch (error) {
      if (!controller.signal.aborted) {
        session.connectionStatus = error instanceof ApiError ? error.displayMessage : NETWORK_ERROR;
      }
    } finally {
      if (session.testController === controller) {
        session.testingConnection = false;
        session.testController = null;
        if (session.id === this.store.activeChatId) {
          this.view.setConnectionStatus(session.connectionStatus);
          this.view.setTesting(false);
        }
      }
    }
  }

  private async loadAvailableModels(baseUrl: string, apiKey: string): Promise<void> {
    const session = this.store.activeChat;
    if (!session || session.loadingModels) return;
    if (!baseUrl || !parseBaseUrl(baseUrl)) {
      session.error = "Enter a valid HTTP or HTTPS Base URL before loading models.";
      this.callbacks.renderChat();
      return;
    }
    const transportError = validateCredentialTransport(baseUrl, apiKey);
    if (transportError) {
      session.error = transportError;
      this.callbacks.renderChat();
      return;
    }
    const controller = new AbortController();
    session.modelController = controller;
    session.loadingModels = true;
    session.modelOptions = [];
    session.modelStatus = "";
    session.error = "";
    this.view.renderModelOptions(session);
    this.callbacks.renderChat();

    if (!(await this.hostPermission.requestAccess(baseUrl))) {
      if (session.modelController === controller) {
        session.error = "Access to this API host was not granted.";
        session.modelController = null;
        session.loadingModels = false;
        if (session.id === this.store.activeChatId) {
          this.view.renderModelOptions(session);
          this.callbacks.renderChat();
        }
      }
      return;
    }
    if (controller.signal.aborted || session.modelController !== controller || !this.store.findChat(session.id)) return;
    this.callbacks.onHostPermissionGranted();

    try {
      const models = await listModels(baseUrl, apiKey, controller.signal);
      session.modelOptions = models;
      if (models.length === 0) {
        session.error = "The API returned no models.";
      } else {
        session.modelStatus = `${models.length} model${models.length === 1 ? "" : "s"} loaded.`;
        if (session.id === this.store.activeChatId) this.view.setModelIfEmpty(models[0] ?? "");
      }
    } catch (error) {
      if (!controller.signal.aborted && session.modelController === controller) {
        session.error = error instanceof ApiError ? error.displayMessage : NETWORK_ERROR;
      }
    } finally {
      if (session.modelController === controller) {
        session.modelController = null;
        session.loadingModels = false;
        if (session.id === this.store.activeChatId) {
          this.view.renderModelOptions(session);
          this.callbacks.renderChat();
          if (session.modelOptions.length > 0) this.view.focusModelSelect();
        }
      }
    }
  }
}
