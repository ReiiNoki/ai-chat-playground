import { endpointOrigin } from "../domain/config";
import { t, type UiLanguage } from "../lib/i18n";
import type { ChatSession } from "../domain/types";
import { normalizedBaseUrl } from "../domain/providers";
import type { ApiConfig, SavedEndpoint, SendShortcut } from "../services/storage";
import {
  apiKeyInput,
  baseUrlInput,
  clearAllChatsButton,
  clearAllKeysButton,
  connectionStatus,
  endpointStatus,
  exportChatButton,
  keyVisibilityButton,
  languageSelect,
  loadModelsButton,
  maxTokensInput,
  modelInput,
  modelSelect,
  modelSuggestions,
  modelStatus,
  providerPreset,
  removeEndpointButton,
  saveEndpointButton,
  seedInput,
  sendShortcutKey,
  sendShortcutSelect,
  newlineShortcutKey,
  settingsCancelButton,
  settingsChangeStatus,
  settingsForm,
  settingsPanel,
  settingsSaveButton,
  settingsToggle,
  storageStatus,
  systemPromptInput,
  temperatureInput,
  testConnectionButton,
  topPInput,
} from "./elements";

export type SettingsViewHandlers = {
  onToggle: () => void;
  onCancel: () => void;
  onSave: (config: ApiConfig) => void;
  onLoadModels: (baseUrl: string, apiKey: string) => void;
  onTestConnection: (config: ApiConfig) => void;
  onSaveEndpoint: (baseUrl: string) => void;
  onRemoveEndpoint: (endpointId: string) => void;
  onConnectionChange: (clearModels: boolean) => void;
  onSendShortcutChange: (shortcut: SendShortcut) => void;
  onLanguageChange: (language: UiLanguage) => void;
  onExportChat: () => void;
  onClearAllChats: () => void;
  onClearAllKeys: () => void;
};

export class SettingsView {
  private handlers: SettingsViewHandlers | null = null;
  private savedConfig: ApiConfig | null = null;
  private keyOrigin: string | null = null;

  constructor() {
    settingsToggle.addEventListener("click", () => this.handlers?.onToggle());
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handlers?.onSave(this.readConfig());
    });
    settingsForm.addEventListener("input", () => this.updateDirtyState());
    settingsForm.addEventListener("change", () => this.updateDirtyState());
    settingsCancelButton.addEventListener("click", () => this.handlers?.onCancel());

    keyVisibilityButton.addEventListener("click", () => this.toggleKeyVisibility());
    loadModelsButton.addEventListener("click", () => {
      this.handlers?.onLoadModels(baseUrlInput.value.trim(), apiKeyInput.value.trim());
    });
    testConnectionButton.addEventListener("click", () => {
      this.handlers?.onTestConnection(this.readConfig());
    });
    saveEndpointButton.addEventListener("click", () => {
      this.handlers?.onSaveEndpoint(baseUrlInput.value);
    });
    removeEndpointButton.addEventListener("click", () => {
      const endpointId = providerPreset.selectedOptions[0]?.dataset.customEndpointId;
      if (endpointId) this.handlers?.onRemoveEndpoint(endpointId);
    });

    exportChatButton.addEventListener("click", () => this.handlers?.onExportChat());
    clearAllChatsButton.addEventListener("click", () => this.handlers?.onClearAllChats());
    clearAllKeysButton.addEventListener("click", () => this.handlers?.onClearAllKeys());
    sendShortcutSelect.addEventListener("change", () => {
      const shortcut: SendShortcut = sendShortcutSelect.value === "mod-enter" ? "mod-enter" : "enter";
      this.renderSendShortcut(shortcut);
      this.handlers?.onSendShortcutChange(shortcut);
    });
    languageSelect.addEventListener("change", () => {
      const language: UiLanguage = languageSelect.value === "zh-CN" ? "zh-CN" : "en";
      this.handlers?.onLanguageChange(language);
    });

    providerPreset.addEventListener("change", () => {
      if (providerPreset.value) baseUrlInput.value = providerPreset.value;
      const defaultModel = providerPreset.selectedOptions[0]?.dataset.defaultModel;
      if (defaultModel) modelInput.value = defaultModel;
      this.updateModelSuggestions();
      endpointStatus.textContent = "";
      this.protectKeyFromOriginChange();
      removeEndpointButton.hidden = !providerPreset.selectedOptions[0]?.dataset.customEndpointId;
      this.handlers?.onConnectionChange(true);
    });

    baseUrlInput.addEventListener("input", () => {
      endpointStatus.textContent = "";
      this.protectKeyFromOriginChange();
      this.syncProviderPreset();
      this.handlers?.onConnectionChange(true);
    });
    apiKeyInput.addEventListener("input", () => {
      this.keyOrigin = endpointOrigin(baseUrlInput.value);
      this.handlers?.onConnectionChange(true);
    });

    modelSelect.addEventListener("change", () => {
      if (modelSelect.value === "__custom_model__") {
        modelSelect.hidden = true;
        modelInput.hidden = false;
        modelInput.focus();
        modelInput.select();
      } else {
        modelInput.value = modelSelect.value;
      }
      this.handlers?.onConnectionChange(false);
    });
    modelInput.addEventListener("input", () => this.handlers?.onConnectionChange(false));
  }

  bind(handlers: SettingsViewHandlers): void {
    this.handlers = handlers;
  }

  setReady(ready: boolean): void {
    loadModelsButton.disabled = !ready;
  }

  isOpen(): boolean {
    return !settingsPanel.hidden;
  }

  setOpen(open: boolean): void {
    settingsPanel.hidden = !open;
    document.body.classList.toggle("settings-open", open);
    settingsToggle.setAttribute("aria-expanded", String(open));
  }

  render(
    session: ChatSession,
    customEndpoints: SavedEndpoint[],
    sendShortcut: SendShortcut,
    language: UiLanguage,
  ): void {
    this.savedConfig = { ...session.config };
    languageSelect.value = language;
    this.renderCustomEndpoints(customEndpoints);
    baseUrlInput.value = session.config.baseUrl;
    this.syncProviderPreset();
    endpointStatus.textContent = "";
    apiKeyInput.value = session.config.apiKey;
    this.keyOrigin = endpointOrigin(session.config.baseUrl);
    apiKeyInput.type = "password";
    keyVisibilityButton.textContent = t("Show");
    keyVisibilityButton.setAttribute("aria-label", t("Show API key"));
    modelInput.value = session.config.model;
    systemPromptInput.value = session.config.systemPrompt;
    temperatureInput.value = session.config.temperature?.toString() ?? "";
    maxTokensInput.value = session.config.maxTokens?.toString() ?? "";
    topPInput.value = session.config.topP?.toString() ?? "";
    seedInput.value = session.config.seed?.toString() ?? "";
    connectionStatus.textContent = t(session.connectionStatus);
    this.setTesting(session.testingConnection);
    this.renderSendShortcut(sendShortcut);
    this.renderModelOptions(session);
    this.updateDirtyState();
  }

  isDirty(): boolean {
    return this.savedConfig !== null && !this.configsMatch(this.readConfig(), this.savedConfig);
  }

  renderCustomEndpoints(customEndpoints: SavedEndpoint[]): void {
    for (const option of providerPreset.querySelectorAll("option[data-custom-endpoint-id]")) {
      option.remove();
    }

    for (const endpoint of customEndpoints) {
      const option = document.createElement("option");
      option.value = endpoint.baseUrl;
      option.textContent = t(`Saved · ${endpoint.name}`);
      option.dataset.customEndpointId = endpoint.id;
      providerPreset.append(option);
    }
  }

  syncProviderPreset(): void {
    const baseUrl = normalizedBaseUrl(baseUrlInput.value);
    const matchingOption = Array.from(providerPreset.options).find(
      (option) => option.value && normalizedBaseUrl(option.value) === baseUrl,
    );
    providerPreset.value = matchingOption?.value ?? "";
    removeEndpointButton.hidden = !matchingOption?.dataset.customEndpointId;
    this.updateModelSuggestions();
  }

  private updateModelSuggestions(): void {
    const models = providerPreset.selectedOptions[0]?.dataset.models;
    modelSuggestions.replaceChildren(
      ...(models ?? "").split(",").filter(Boolean).map((model) => {
        const option = document.createElement("option");
        option.value = model;
        return option;
      }),
    );
  }

  renderModelOptions(session: ChatSession): void {
    const currentModel = modelInput.value.trim() || session.config.model.trim();
    const availableModels = [...session.modelOptions];
    if (currentModel && !availableModels.includes(currentModel)) {
      availableModels.unshift(currentModel);
    }

    modelSelect.replaceChildren(
      ...availableModels.map((model) => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent =
          model === currentModel && !session.modelOptions.includes(model)
            ? t("{model} (custom)", { model })
            : model;
        return option;
      }),
    );

    if (session.modelOptions.length > 0) {
      const customOption = document.createElement("option");
      customOption.value = "__custom_model__";
      customOption.textContent = t("Custom model…");
      modelSelect.append(customOption);

      const selectedModel = currentModel || session.modelOptions[0] || "";
      modelInput.value = selectedModel;
      modelSelect.value = selectedModel;
      modelInput.hidden = true;
      modelSelect.hidden = false;
    } else {
      modelSelect.hidden = true;
      modelInput.hidden = false;
    }

    modelStatus.textContent = session.loadingModels ? t("Loading models…") : t(session.modelStatus);
    loadModelsButton.disabled = session.loadingModels;
    loadModelsButton.textContent = session.loadingModels ? t("Loading") : t("Load models");
    loadModelsButton.classList.toggle("is-loading", session.loadingModels);
    loadModelsButton.setAttribute("aria-busy", String(session.loadingModels));
    this.updateDirtyState();
  }

  setConnectionStatus(status: string): void {
    connectionStatus.textContent = t(status);
  }

  setEndpointStatus(status: string): void {
    endpointStatus.textContent = t(status);
  }

  setStorageStatus(status: string): void {
    storageStatus.textContent = t(status);
  }

  renderSendShortcut(shortcut: SendShortcut): void {
    sendShortcutSelect.value = shortcut;
    sendShortcutKey.textContent = shortcut === "mod-enter" ? "Ctrl/Cmd + Enter" : "Enter";
    newlineShortcutKey.textContent = shortcut === "mod-enter" ? "Enter" : "Shift + Enter";
  }

  setTesting(testing: boolean): void {
    testConnectionButton.disabled = testing;
    testConnectionButton.textContent = testing ? t("Testing") : t("Test connection");
    testConnectionButton.classList.toggle("is-loading", testing);
    testConnectionButton.setAttribute("aria-busy", String(testing));
  }

  setBaseUrl(baseUrl: string): void {
    baseUrlInput.value = baseUrl;
    this.updateDirtyState();
  }

  setApiKey(apiKey: string): void {
    apiKeyInput.value = apiKey;
    if (this.savedConfig) this.savedConfig.apiKey = apiKey;
    this.updateDirtyState();
  }

  setModelIfEmpty(model: string): void {
    if (!modelInput.value.trim()) {
      modelInput.value = model;
      this.updateDirtyState();
    }
  }

  focusBaseUrl(): void {
    baseUrlInput.focus();
  }

  focusModelSelect(): void {
    modelSelect.focus();
  }

  private readConfig(): ApiConfig {
    return {
      baseUrl: baseUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      systemPrompt: systemPromptInput.value,
      temperature: this.optionalNumber(temperatureInput),
      maxTokens: this.optionalNumber(maxTokensInput),
      topP: this.optionalNumber(topPInput),
      seed: this.optionalNumber(seedInput),
    };
  }

  private optionalNumber(input: HTMLInputElement): number | null {
    return input.value.trim() ? input.valueAsNumber : null;
  }

  private updateDirtyState(): void {
    const dirty = this.isDirty();
    settingsSaveButton.disabled = !dirty;
    settingsChangeStatus.textContent = dirty ? "Unsaved changes" : "";
  }

  private configsMatch(left: ApiConfig, right: ApiConfig): boolean {
    return (
      left.baseUrl === right.baseUrl &&
      left.apiKey === right.apiKey &&
      left.model === right.model &&
      left.systemPrompt === right.systemPrompt &&
      Object.is(left.temperature, right.temperature) &&
      Object.is(left.maxTokens, right.maxTokens) &&
      Object.is(left.topP, right.topP) &&
      Object.is(left.seed, right.seed)
    );
  }

  private protectKeyFromOriginChange(): void {
    const nextOrigin = endpointOrigin(baseUrlInput.value);
    if (apiKeyInput.value && nextOrigin && this.keyOrigin && nextOrigin !== this.keyOrigin) {
      apiKeyInput.value = "";
      this.keyOrigin = nextOrigin;
      endpointStatus.textContent = "API key cleared because the API host changed.";
    }
  }

  private toggleKeyVisibility(): void {
    const show = apiKeyInput.type === "password";
    apiKeyInput.type = show ? "text" : "password";
    keyVisibilityButton.textContent = show ? t("Hide") : t("Show");
    keyVisibilityButton.setAttribute("aria-label", show ? t("Hide API key") : t("Show API key"));
  }
}
