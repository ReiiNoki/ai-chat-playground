import type { ChatSession } from "../domain/types";
import { t } from "../lib/i18n";
import { renderMarkdown } from "../lib/markdown";
import type { Message, StreamDelta } from "../services/chat-api";
import type { SendShortcut } from "../services/storage";
import {
  chatElement,
  clearButton,
  messageInput,
  scrollBottomButton,
  sendButton,
} from "./elements";

export type ChatViewHandlers = {
  onPrimaryAction: () => void;
  onSubmit: () => void;
  onCancelGeneration: () => void;
  onOpenSettings: () => void;
  onNotify: (message: string, tone?: "success" | "error" | "info") => void;
  onClear: () => void;
  onDraftChange: (draft: string) => void;
  onScroll: (scrollTop: number, distanceFromBottom: number) => void;
  onScrollBottom: () => void;
  onRegenerate: (chatId: string, assistantIndex: number) => void;
};

type PendingStreamingRender = {
  session: ChatSession;
  message: Message;
  contentChanged: boolean;
  reasoningChanged: boolean;
  onRendered: () => void;
};

const STREAM_RENDER_INTERVAL_MS = 50;

export type EmptyStateInfo = {
  provider: string;
  model: string;
  configured: boolean;
};

export class ChatView {
  private handlers: ChatViewHandlers | null = null;
  private ready = false;
  private generating = false;
  private sendShortcut: SendShortcut = "enter";
  private streamingRenderTimer: number | null = null;
  private pendingStreamingRender: PendingStreamingRender | null = null;

  constructor() {
    sendButton.addEventListener("click", () => this.handlers?.onPrimaryAction());
    clearButton.addEventListener("click", () => this.handlers?.onClear());
    scrollBottomButton.addEventListener("click", () => this.handlers?.onScrollBottom());

    messageInput.addEventListener("input", () => {
      this.handlers?.onDraftChange(messageInput.value);
      this.resizeComposer();
      this.syncPrimaryButton();
    });

    messageInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;

      const shouldSend = this.sendShortcut === "mod-enter"
        ? (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
        : !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!shouldSend) return;

      event.preventDefault();
      this.handlers?.onSubmit();
    });

    chatElement.addEventListener("scroll", () => {
      const distanceFromBottom =
        chatElement.scrollHeight - chatElement.scrollTop - chatElement.clientHeight;
      this.handlers?.onScroll(chatElement.scrollTop, distanceFromBottom);
    });

    window.addEventListener("resize", () => this.resizeComposer());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.generating) {
        event.preventDefault();
        this.handlers?.onCancelGeneration();
      }
    });
  }

  bind(handlers: ChatViewHandlers): void {
    this.handlers = handlers;
  }

  setSendShortcut(shortcut: SendShortcut): void {
    this.sendShortcut = shortcut;
    if (!this.generating) {
      sendButton.title = shortcut === "mod-enter"
        ? t("Send message (Ctrl/Cmd+Enter)")
        : t("Send message (Enter)");
    }
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    clearButton.disabled = !ready;
    this.syncPrimaryButton();
  }

  setDraft(draft: string): void {
    messageInput.value = draft;
    this.resizeComposer();
    this.syncPrimaryButton();
  }

  getDraft(): string {
    return messageInput.value;
  }

  clearDraft(): void {
    messageInput.value = "";
    this.resizeComposer();
    this.syncPrimaryButton();
  }

  focusComposer(): void {
    messageInput.focus();
  }

  setGenerating(generating: boolean): void {
    this.generating = generating;
    sendButton.textContent = generating ? t("Stop") : t("Send");
    sendButton.classList.toggle("is-stop", generating);
    sendButton.setAttribute("aria-label", generating ? t("Stop generating") : t("Send message"));
    sendButton.title = generating
      ? t("Stop generating (Esc)")
      : this.sendShortcut === "mod-enter"
        ? t("Send message (Ctrl/Cmd+Enter)")
        : t("Send message (Enter)");
    this.syncPrimaryButton();
  }

  setNewContentVisible(visible: boolean): void {
    scrollBottomButton.hidden = !visible;
  }

  scrollToEnd(): number {
    chatElement.scrollTop = chatElement.scrollHeight;
    return chatElement.scrollTop;
  }

  render(session: ChatSession | undefined, emptyState?: EmptyStateInfo): void {
    this.cancelStreamingRender();
    chatElement.replaceChildren();
    if (!session) return;

    if (session.messages.length === 0 && !session.error) {
      chatElement.append(this.createEmptyState(emptyState));
      this.setNewContentVisible(false);
      return;
    }

    if (emptyState?.configured) chatElement.append(this.createChatSummary(emptyState));

    session.messages.forEach((message, index) => {
      chatElement.append(this.createMessage(session, message, index));
    });

    if (session.retryStatus) {
      const status = document.createElement("div");
      status.className = "retry-message";
      status.textContent = t(session.retryStatus);
      chatElement.append(status);
    }

    if (session.error) chatElement.append(this.createError(session.error));

    if (session.stickToBottom) this.scrollToEnd();
    else chatElement.scrollTop = session.scrollTop;
    this.setNewContentVisible(session.hasNewContent);
  }

  scheduleStreamingAssistant(
    session: ChatSession,
    message: Message,
    delta: StreamDelta,
    onRendered: () => void,
  ): void {
    const contentChanged = Boolean(delta.content);
    const reasoningChanged = Boolean(delta.reasoning);
    if (!contentChanged && !reasoningChanged) return;

    const pending = this.pendingStreamingRender;
    if (pending && pending.session === session && pending.message === message) {
      pending.contentChanged ||= contentChanged;
      pending.reasoningChanged ||= reasoningChanged;
      pending.onRendered = onRendered;
    } else {
      this.cancelStreamingRender();
      this.pendingStreamingRender = {
        session,
        message,
        contentChanged,
        reasoningChanged,
        onRendered,
      };
    }

    if (this.streamingRenderTimer !== null) return;
    this.streamingRenderTimer = window.setTimeout(
      () => this.flushStreamingRender(),
      STREAM_RENDER_INTERVAL_MS,
    );
  }

  private flushStreamingRender(): void {
    this.streamingRenderTimer = null;
    const pending = this.pendingStreamingRender;
    this.pendingStreamingRender = null;
    if (!pending) return;

    this.updateStreamingAssistant(pending);
    pending.onRendered();
  }

  private updateStreamingAssistant(pending: PendingStreamingRender): void {
    const { session, message, contentChanged, reasoningChanged } = pending;
    const articles = chatElement.querySelectorAll<HTMLElement>(".message");
    const article = articles.item(articles.length - 1);
    const content = article?.querySelector<HTMLElement>(".assistant-content");
    if (!article || !content) {
      this.render(session);
      return;
    }

    if (contentChanged) {
      renderMarkdown(content, message.content, { codeCopyButtons: false });
    }
    if (reasoningChanged && message.reasoning) {
      let reasoningBlock = article.querySelector<HTMLDetailsElement>(".reasoning-block");
      if (!reasoningBlock) {
        reasoningBlock = this.createReasoningBlock(message, false);
        article.insertBefore(reasoningBlock, content);
      } else {
        const reasoningContent = reasoningBlock.querySelector<HTMLElement>(".reasoning-content");
        if (reasoningContent) {
          renderMarkdown(reasoningContent, message.reasoning, { codeCopyButtons: false });
        }
      }
    }
  }

  private cancelStreamingRender(): void {
    if (this.streamingRenderTimer !== null) {
      window.clearTimeout(this.streamingRenderTimer);
      this.streamingRenderTimer = null;
    }
    this.pendingStreamingRender = null;
  }

  private syncPrimaryButton(): void {
    sendButton.disabled = !this.ready || (!this.generating && !messageInput.value.trim());
  }

  private createEmptyState(info?: EmptyStateInfo): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const title = document.createElement("h2");
    title.textContent = info?.configured ? t("Start a conversation") : t("Configure this chat");

    const description = document.createElement("p");
    description.textContent = info?.configured
      ? `${info.provider} · ${info.model}`
      : t("Choose an API endpoint and model. API keys stay in local Chrome storage.");

    const actions = document.createElement("div");
    actions.className = "empty-actions";

    const settingsButton = document.createElement("button");
    settingsButton.className = info?.configured ? "small-button" : "primary-button";
    settingsButton.type = "button";
    settingsButton.textContent = info?.configured ? t("Edit settings") : t("Configure API");
    settingsButton.addEventListener("click", () => this.handlers?.onOpenSettings());
    actions.append(settingsButton);

    if (info?.configured) {
      const prompts = ["Reply with a short hello.", "Show a small Markdown example."];
      for (const prompt of prompts) {
        const promptButton = document.createElement("button");
        promptButton.className = "small-button prompt-button";
        promptButton.type = "button";
        promptButton.textContent = t(prompt.replace(/\.$/, ""));
        promptButton.addEventListener("click", () => {
          this.setDraft(t(prompt));
          this.focusComposer();
        });
        actions.append(promptButton);
      }
    }

    empty.append(title, description, actions);
    return empty;
  }

  private createChatSummary(info: EmptyStateInfo): HTMLElement {
    const summary = document.createElement("button");
    summary.className = "chat-summary";
    summary.type = "button";
    summary.title = t("Open settings");
    summary.addEventListener("click", () => this.handlers?.onOpenSettings());

    const label = document.createElement("span");
    label.className = "chat-summary-label";
    label.textContent = t("Current API");

    const value = document.createElement("span");
    value.className = "chat-summary-value";
    value.textContent = `${info.provider} · ${info.model}`;

    summary.append(label, value);
    return summary;
  }

  private resizeComposer(): void {
    messageInput.style.height = "auto";
    messageInput.style.overflowY = "hidden";

    const styles = getComputedStyle(messageInput);
    const configuredMinHeight = Number.parseFloat(styles.minHeight);
    const configuredMaxHeight = Number.parseFloat(styles.maxHeight);
    const minHeight = Number.isFinite(configuredMinHeight) ? configuredMinHeight : 48;
    const proportionalMaxHeight = Math.min(Math.max(window.innerHeight * 0.2, 80), 180);
    const maxHeight = Number.isFinite(configuredMaxHeight)
      ? Math.min(configuredMaxHeight, proportionalMaxHeight)
      : proportionalMaxHeight;
    const nextHeight = Math.max(minHeight, Math.min(messageInput.scrollHeight, maxHeight));

    messageInput.style.height = `${Math.ceil(nextHeight)}px`;
    messageInput.style.overflowY = messageInput.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  private createMessage(
    session: ChatSession,
    message: Message,
    index: number,
  ): HTMLElement {
    const container = document.createElement("article");
    container.className = "message";
    container.dataset.role = message.role;

    const role = document.createElement("div");
    role.className = "message-role";
    role.textContent = message.role === "user" ? t("You") : session.config.model.trim() || t("Assistant");

    const content = document.createElement("div");
    content.className = "message-content";
    if (message.role === "assistant") {
      content.classList.add("assistant-content");
      if (message.content) {
        this.renderInteractiveMarkdown(content, message.content);
      } else if (session.controller) {
        content.append(this.createWaitingIndicator());
      }
    } else {
      content.textContent = message.content;
    }

    container.append(role);
    if (message.role === "assistant" && message.reasoning) {
      container.append(this.createReasoningBlock(message));
    }
    container.append(content);

    if (message.role === "assistant" && (message.content || message.reasoning)) {
      container.append(this.createMessageActions(session, message, index));
    }
    return container;
  }

  private createWaitingIndicator(): HTMLElement {
    const indicator = document.createElement("div");
    indicator.className = "waiting-indicator";
    indicator.textContent = t("Waiting for response…");
    return indicator;
  }

  private createMessageActions(
    session: ChatSession,
    message: Message,
    index: number,
  ): HTMLElement {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = document.createElement("button");
    copyButton.className = "message-action";
    copyButton.type = "button";
    copyButton.textContent = t("Copy");
    copyButton.addEventListener("click", () => {
      void this.copyWithFeedback(copyButton, message.content || message.reasoning || "");
    });
    actions.append(copyButton);

    if (!session.controller) {
      const regenerateButton = document.createElement("button");
      regenerateButton.className = "message-action";
      regenerateButton.type = "button";
      regenerateButton.textContent = t("Regenerate");
      regenerateButton.addEventListener("click", () => {
        this.handlers?.onRegenerate(session.id, index);
      });
      actions.append(regenerateButton);
    }
    return actions;
  }

  private createReasoningBlock(
    message: Message,
    codeCopyButtons = true,
  ): HTMLDetailsElement {
    const details = document.createElement("details");
    details.className = "reasoning-block";

    const summary = document.createElement("summary");
    summary.textContent = t("Thinking");

    const content = document.createElement("div");
    content.className = "message-content reasoning-content";
    renderMarkdown(content, message.reasoning ?? "", {
      codeCopyButtons,
      onCopyResult: codeCopyButtons
        ? (success) => this.notifyCopyResult(success)
        : undefined,
    });

    details.append(summary, content);
    return details;
  }

  private createError(error: string): HTMLElement {
    const container = document.createElement("article");
    container.className = "error-message";

    const role = document.createElement("div");
    role.className = "message-role";
    role.textContent = t("Error");

    const content = document.createElement("div");
    content.className = "error-content";
    content.textContent = t(error);

    container.append(role, content);
    return container;
  }

  private renderInteractiveMarkdown(element: HTMLElement, source: string): void {
    renderMarkdown(element, source, {
      onCopyResult: (success) => this.notifyCopyResult(success),
    });
  }

  private notifyCopyResult(success: boolean): void {
    this.handlers?.onNotify(
      success ? t("Copied to clipboard.") : t("Copy failed."),
      success ? "success" : "error",
    );
  }

  private async copyWithFeedback(button: HTMLButtonElement, text: string): Promise<void> {
    if (!text) return;
    const originalLabel = button.textContent ?? t("Copy");
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = t("Copied");
      this.notifyCopyResult(true);
    } catch {
      button.textContent = t("Failed");
      this.notifyCopyResult(false);
    }
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = originalLabel;
    }, 1200);
  }
}
