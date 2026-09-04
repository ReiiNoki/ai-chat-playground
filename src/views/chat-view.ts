import type { ChatSession } from "../domain/types";
import { renderMarkdown } from "../lib/markdown";
import type { Message, StreamDelta } from "../services/chat-api";
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
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.handlers?.onSubmit();
      }
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
    sendButton.textContent = generating ? "Stop" : "Send";
    sendButton.classList.toggle("is-stop", generating);
    sendButton.setAttribute("aria-label", generating ? "Stop generating" : "Send message");
    sendButton.title = generating ? "Stop generating (Esc)" : "Send message (Enter)";
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

    session.messages.forEach((message, index) => {
      chatElement.append(this.createMessage(session, message, index));
    });

    if (session.retryStatus) {
      const status = document.createElement("div");
      status.className = "retry-message";
      status.textContent = session.retryStatus;
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
    title.textContent = info?.configured ? "Start a conversation" : "Configure this chat";

    const description = document.createElement("p");
    description.textContent = info
      ? `${info.provider} · ${info.model}`
      : "Choose an API endpoint and model to get started.";

    const settingsButton = document.createElement("button");
    settingsButton.className = "primary-button";
    settingsButton.type = "button";
    settingsButton.textContent = "Open settings";
    settingsButton.addEventListener("click", () => this.handlers?.onOpenSettings());

    empty.append(title, description, settingsButton);
    return empty;
  }

  private resizeComposer(): void {
    messageInput.style.height = "auto";
    messageInput.style.overflowY = "hidden";
    const configuredMaxHeight = Number.parseFloat(getComputedStyle(messageInput).maxHeight);
    const maxHeight = Number.isFinite(configuredMaxHeight) ? configuredMaxHeight : 220;
    const nextHeight = Math.min(messageInput.scrollHeight, maxHeight);
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
    role.textContent = message.role === "user" ? "User" : "Assistant";

    const content = document.createElement("div");
    content.className = "message-content";
    if (message.role === "assistant") {
      content.classList.add("assistant-content");
      this.renderInteractiveMarkdown(content, message.content);
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
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => {
      void this.copyWithFeedback(copyButton, message.content || message.reasoning || "");
    });
    actions.append(copyButton);

    if (!session.controller) {
      const regenerateButton = document.createElement("button");
      regenerateButton.className = "message-action";
      regenerateButton.type = "button";
      regenerateButton.textContent = "Regenerate";
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
    summary.textContent = "Thinking";

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
    role.textContent = "Error";

    const content = document.createElement("div");
    content.className = "error-content";
    content.textContent = error;

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
      success ? "Copied to clipboard." : "Copy failed.",
      success ? "success" : "error",
    );
  }

  private async copyWithFeedback(button: HTMLButtonElement, text: string): Promise<void> {
    if (!text) return;
    const originalLabel = button.textContent ?? "Copy";
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      this.notifyCopyResult(true);
    } catch {
      button.textContent = "Failed";
      this.notifyCopyResult(false);
    }
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = originalLabel;
    }, 1200);
  }
}
