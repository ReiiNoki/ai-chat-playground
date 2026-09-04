import type { ChatSession } from "../domain/types";
import { normalizedBaseUrl, tabLabel, type ProviderLogo } from "../domain/providers";
import type { SavedEndpoint } from "../services/storage";
import { newChatButton, tabsList } from "./elements";

export type TabsViewHandlers = {
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
};

export class TabsView {
  private handlers: TabsViewHandlers | null = null;

  constructor() {
    newChatButton.addEventListener("click", () => this.handlers?.onNew());
  }

  bind(handlers: TabsViewHandlers): void {
    this.handlers = handlers;
  }

  setReady(ready: boolean): void {
    newChatButton.disabled = !ready;
  }

  render(
    chats: ChatSession[],
    activeChatId: string,
    customEndpoints: SavedEndpoint[],
    customFavicons: ReadonlyMap<string, string | null>,
  ): void {
    tabsList.replaceChildren();

    chats.forEach((session, index) => {
      const container = document.createElement("div");
      container.className = "chat-tab";
      container.classList.toggle("is-active", session.id === activeChatId);

      const selectButton = document.createElement("button");
      selectButton.className = "tab-select";
      selectButton.type = "button";
      selectButton.role = "tab";
      const label = tabLabel(session, index, customEndpoints);

      const provider = document.createElement("span");
      provider.className = "tab-provider";
      const customFavicon = customFavicons.get(normalizedBaseUrl(session.config.baseUrl));
      this.renderProvider(
        provider,
        label.logo ?? (customFavicon ? { src: customFavicon } : undefined),
        label.provider,
      );

      const model = document.createElement("span");
      model.className = "tab-model";
      model.textContent = label.model;

      selectButton.append(provider, model);
      selectButton.title = `${label.providerFull} · ${label.model}\n${session.config.baseUrl}`;
      selectButton.setAttribute("aria-label", `${label.providerFull} · ${label.model}`);
      selectButton.setAttribute("aria-selected", String(session.id === activeChatId));
      selectButton.addEventListener("click", () => this.handlers?.onSelect(session.id));

      const closeButton = document.createElement("button");
      closeButton.className = "tab-close";
      closeButton.type = "button";
      closeButton.textContent = "×";
      closeButton.title = "Close chat";
      closeButton.setAttribute("aria-label", `Close ${label.providerFull} · ${label.model}`);
      closeButton.addEventListener("click", () => this.handlers?.onClose(session.id));

      container.append(selectButton, closeButton);
      tabsList.append(container);
    });

    tabsList
      .querySelector(".chat-tab.is-active")
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  private renderProvider(
    container: HTMLElement,
    logo: ProviderLogo | undefined,
    fallback: string,
  ): void {
    container.replaceChildren();
    container.classList.toggle("is-fallback", !logo);
    container.classList.toggle("has-dark-background", logo?.darkBackground === true);

    if (!logo) {
      container.textContent = fallback;
      return;
    }

    const image = document.createElement("img");
    image.className = "provider-logo";
    image.classList.toggle("is-monochrome", logo.monochrome === true);
    image.src = logo.src;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.addEventListener(
      "error",
      () => this.renderProvider(container, undefined, fallback),
      { once: true },
    );
    container.append(image);
  }
}
