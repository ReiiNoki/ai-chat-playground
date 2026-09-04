import { NETWORK_ERROR, validateConfig } from "../domain/config";
import { isBuiltInEndpoint, normalizedBaseUrl } from "../domain/providers";
import { ApiError, listModels, testChatConnection } from "../services/chat-api";
import { HostPermissionService } from "../services/host-permission";
import { PersistenceService } from "../services/persistence";
import type { ApiConfig, SavedEndpoint } from "../services/storage";
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
};

export class SettingsController {
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
    if (this.view.isDirty() && !window.confirm("Discard unsaved settings?")) return;
    this.cancelSettings();
  }

  private cancelSettings(): void {
    const session = this.store.activeChat;
    if (session) this.view.render(session, this.store.customEndpoints);
    this.view.setOpen(false);
  }

  private async saveSettings(config: ApiConfig): Promise<void> {
    const session = this.store.activeChat;
    if (!session) return;

    const configurationError = validateConfig(config);
    if (configurationError) {
      session.connectionStatus = configurationError;
      this.view.setConnectionStatus(configurationError);
      return;
    }
    if (!(await this.hostPermission.requestAccess(config.baseUrl))) {
      session.connectionStatus = "Access to this API host was not granted.";
      this.view.setConnectionStatus(session.connectionStatus);
      return;
    }

    this.callbacks.onHostPermissionGranted();
    session.config = config;

    void this.persistence
      .save()
      .then(() => {
        session.error = "";
        if (session.id === this.store.activeChatId) {
          this.view.setOpen(false);
          this.callbacks.notify("Settings saved.", "success");
          this.callbacks.onSettingsSaved();
        }
      })
      .catch(() => {
        session.error = "Could not save settings.";
        this.callbacks.notify("Could not save settings.", "error");
        if (session.id === this.store.activeChatId) this.callbacks.renderChat();
      });
  }

  private handleConnectionChange(clearModels: boolean): void {
    const session = this.store.activeChat;
    if (!session) return;
    session.connectionStatus = "";
    this.view.setConnectionStatus("");
    if (!clearModels) return;

    session.modelOptions = [];
    session.modelStatus = "";
    this.view.renderModelOptions(session);
  }

  private saveCurrentEndpoint(value: string): void {
    const normalized = normalizedBaseUrl(value);
    let parsed: URL;
    try {
      parsed = new URL(normalized);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      this.view.setEndpointStatus("Enter a valid HTTP or HTTPS Base URL first.");
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

    if (!(await this.hostPermission.requestAccess(config.baseUrl))) {
      session.connectionStatus = "Access to this API host was not granted.";
      this.view.setConnectionStatus(session.connectionStatus);
      return;
    }
    this.callbacks.onHostPermissionGranted();

    const controller = new AbortController();
    session.testingConnection = true;
    session.testController = controller;
    session.connectionStatus = "Testing Chat Completions…";
    this.view.setConnectionStatus(session.connectionStatus);
    this.view.setTesting(true);

    try {
      await testChatConnection(config, controller.signal);
      session.connectionStatus = "Connected · Chat Completions works.";
    } catch (error) {
      if (!controller.signal.aborted) {
        session.connectionStatus = error instanceof ApiError ? error.displayMessage : NETWORK_ERROR;
      }
    } finally {
      session.testingConnection = false;
      if (session.testController === controller) session.testController = null;
      if (session.id === this.store.activeChatId) {
        this.view.setConnectionStatus(session.connectionStatus);
        this.view.setTesting(false);
      }
    }
  }

  private async loadAvailableModels(baseUrl: string, apiKey: string): Promise<void> {
    const session = this.store.activeChat;
    if (!session || session.loadingModels) return;
    if (!baseUrl) {
      session.error = "Enter a Base URL before loading models.";
      this.callbacks.renderChat();
      return;
    }
    if (!(await this.hostPermission.requestAccess(baseUrl))) {
      session.error = "Access to this API host was not granted.";
      this.callbacks.renderChat();
      return;
    }
    this.callbacks.onHostPermissionGranted();

    session.loadingModels = true;
    session.modelOptions = [];
    session.modelStatus = "";
    session.error = "";
    this.view.renderModelOptions(session);
    this.callbacks.renderChat();

    try {
      const models = await listModels(baseUrl, apiKey);
      session.modelOptions = models;
      if (models.length === 0) {
        session.error = "The API returned no models.";
      } else {
        session.modelStatus = `${models.length} model${models.length === 1 ? "" : "s"} loaded.`;
        if (session.id === this.store.activeChatId) this.view.setModelIfEmpty(models[0] ?? "");
      }
    } catch (error) {
      session.error = error instanceof ApiError ? error.displayMessage : NETWORK_ERROR;
    } finally {
      session.loadingModels = false;
      if (session.id === this.store.activeChatId) {
        this.view.renderModelOptions(session);
        this.callbacks.renderChat();
        if (session.modelOptions.length > 0) this.view.focusModelSelect();
      }
    }
  }
}
