import { NETWORK_ERROR, validateConfig } from "../domain/config";
import { t } from "../lib/i18n";
import type { ChatSession } from "../domain/types";
import { ApiError, streamChat, type Message } from "../services/chat-api";
import { HostPermissionService } from "../services/host-permission";
import { PersistenceService } from "../services/persistence";
import type { ApiConfig } from "../services/storage";
import { SidepanelStore } from "../stores/app";
import { ChatView } from "../views/chat-view";

type ChatControllerCallbacks = {
  renderChat: () => void;
  openSettings: () => void;
  reportStorageError: () => void;
  refreshStorageUsage: () => Promise<void>;
  onHostPermissionGranted: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

type GenerationResult = {
  completed: boolean;
  hasOutput: boolean;
};

function apiMessages(messages: Message[]): Message[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

function removeMessage(session: ChatSession, message: Message): void {
  const index = session.messages.indexOf(message);
  if (index >= 0) session.messages.splice(index, 1);
}

export class ChatController {
  constructor(
    private readonly store: SidepanelStore,
    private readonly view: ChatView,
    private readonly hostPermission: HostPermissionService,
    private readonly persistence: PersistenceService,
    private readonly callbacks: ChatControllerCallbacks,
  ) {}

  bind(): void {
    this.view.bind({
      onPrimaryAction: () => this.handlePrimaryAction(),
      onSubmit: () => void this.sendMessage(),
      onCancelGeneration: () => this.cancelActiveGeneration(),
      onOpenSettings: this.callbacks.openSettings,
      onNotify: this.callbacks.notify,
      onClear: () => this.clearCurrentChat(),
      onDraftChange: (draft) => this.updateDraft(draft),
      onScroll: (scrollTop, distanceFromBottom) =>
        this.updateScrollPosition(scrollTop, distanceFromBottom),
      onScrollBottom: () => this.scrollActiveChatToEnd(),
      onRegenerate: (chatId, index) => {
        const session = this.store.findChat(chatId);
        if (session) void this.regenerateMessage(session, index);
      },
    });
  }

  stopGenerating(session: ChatSession): void {
    const controller = session.controller;
    if (!controller) return;
    session.controller = null;
    controller.abort();
    if (session.id === this.store.activeChatId) this.view.setGenerating(false);
  }

  private handlePrimaryAction(): void {
    const session = this.store.activeChat;
    if (!session) return;
    if (session.controller) this.stopGenerating(session);
    else void this.sendMessage();
  }

  private cancelActiveGeneration(): void {
    const session = this.store.activeChat;
    if (session?.controller) this.stopGenerating(session);
  }

  private async generateAssistant(
    session: ChatSession,
    requestMessages: Message[],
    controller: AbortController,
    persist = true,
    config: ApiConfig = { ...session.config },
  ): Promise<GenerationResult> {
    const assistantMessage: Message = { role: "assistant", content: "", reasoning: "" };
    let completed = false;
    session.retryStatus = "";
    session.messages.push(assistantMessage);

    if (session.id === this.store.activeChatId) {
      this.callbacks.renderChat();
      this.view.setGenerating(true);
    }

    try {
      await streamChat({
        config,
        messages: requestMessages,
        signal: controller.signal,
        onRetry: (info) => {
          const seconds = Math.max(1, Math.ceil(info.delayMs / 1000));
          session.retryStatus = `${info.status} · Retrying in ${seconds}s… (${info.attempt}/${info.maxRetries})`;
          if (session.id === this.store.activeChatId) this.callbacks.renderChat();
        },
        onDelta: (delta) => {
          if (controller.signal.aborted) return;
          if (session.retryStatus) {
            session.retryStatus = "";
            if (session.id === this.store.activeChatId) this.callbacks.renderChat();
          }
          if (delta.content) assistantMessage.content += delta.content;
          if (delta.reasoning) {
            assistantMessage.reasoning = (assistantMessage.reasoning ?? "") + delta.reasoning;
          }
          if (persist) this.persistence.schedule();
          if (session.id === this.store.activeChatId) {
            this.view.scheduleStreamingAssistant(session, assistantMessage, delta, () => {
              if (session.id === this.store.activeChatId) this.followNewContent(session);
            });
          }
        },
      });

      if (!assistantMessage.content && !assistantMessage.reasoning) {
        removeMessage(session, assistantMessage);
        session.error = "The API returned no text.";
      } else {
        completed = true;
      }
    } catch (error) {
      const hasOutput = Boolean(assistantMessage.content || assistantMessage.reasoning);
      if (controller.signal.aborted) {
        if (!hasOutput) removeMessage(session, assistantMessage);
      } else {
        if (!hasOutput) removeMessage(session, assistantMessage);
        session.error = error instanceof ApiError ? error.displayMessage : NETWORK_ERROR;
      }
    } finally {
      if (session.controller === controller) session.controller = null;
      session.retryStatus = "";
      if (persist) void this.persistence.save().catch(this.callbacks.reportStorageError);
      if (session.id === this.store.activeChatId) {
        this.callbacks.renderChat();
        this.view.setGenerating(session.controller !== null);
      }
    }

    return {
      completed,
      hasOutput: Boolean(assistantMessage.content || assistantMessage.reasoning),
    };
  }

  private async regenerateMessage(
    session: ChatSession,
    assistantIndex: number,
  ): Promise<void> {
    if (
      !this.store.ready ||
      session.controller ||
      session.messages[assistantIndex]?.role !== "assistant"
    ) {
      return;
    }

    const configurationError = validateConfig(session.config);
    if (configurationError) {
      session.error = configurationError;
      if (session.id === this.store.activeChatId) this.callbacks.renderChat();
      return;
    }
    if (
      assistantIndex < session.messages.length - 1 &&
      !window.confirm(t("Regenerating this response will remove the messages after it. Continue?"))
    ) {
      return;
    }

    const controller = new AbortController();
    const config = { ...session.config };
    session.controller = controller;
    if (session.id === this.store.activeChatId) this.view.setGenerating(true);
    if (!(await this.ensureApiAccess(session, config.baseUrl))) {
      if (session.controller === controller) session.controller = null;
      if (session.id === this.store.activeChatId) this.view.setGenerating(false);
      return;
    }
    if (controller.signal.aborted || session.controller !== controller || !this.store.findChat(session.id)) return;

    session.error = "";
    session.stickToBottom = true;
    session.hasNewContent = false;
    const originalMessages = session.messages;
    const mutationVersion = session.mutationVersion;
    const prefix = originalMessages.slice(0, assistantIndex);
    this.persistence.suspend();
    try {
      session.messages = prefix;
      const result = await this.generateAssistant(
        session,
        apiMessages(prefix),
        controller,
        false,
        config,
      );
      if (!result.completed && session.mutationVersion === mutationVersion) {
        session.messages = originalMessages;
        if (session.id === this.store.activeChatId) this.callbacks.renderChat();
      }
    } finally {
      void this.persistence.save();
      this.persistence.resume();
    }
  }

  private async sendMessage(): Promise<void> {
    const session = this.store.activeChat;
    if (!this.store.ready || !session || session.controller) return;

    const content = this.view.getDraft().trim();
    if (!content) return;

    const configurationError = validateConfig(session.config);
    if (configurationError) {
      session.error = configurationError;
      this.callbacks.renderChat();
      return;
    }
    const controller = new AbortController();
    const config = { ...session.config };
    session.controller = controller;
    if (session.id === this.store.activeChatId) this.view.setGenerating(true);
    if (!(await this.ensureApiAccess(session, config.baseUrl))) {
      if (session.controller === controller) session.controller = null;
      if (session.id === this.store.activeChatId) this.view.setGenerating(false);
      return;
    }
    if (controller.signal.aborted || session.controller !== controller || !this.store.findChat(session.id)) return;

    session.error = "";
    session.stickToBottom = true;
    session.hasNewContent = false;
    const mutationVersion = session.mutationVersion;
    const userMessage: Message = { role: "user", content };
    session.messages.push(userMessage);
    void this.persistence.save().catch(this.callbacks.reportStorageError);
    const requestMessages = apiMessages(session.messages);
    session.draft = "";
    if (session.id === this.store.activeChatId) this.view.clearDraft();
    const result = await this.generateAssistant(session, requestMessages, controller, true, config);

    if (!result.completed && !result.hasOutput && session.mutationVersion === mutationVersion) {
      removeMessage(session, userMessage);
      session.draft = session.draft ? `${content}\n\n${session.draft}` : content;
      if (session.id === this.store.activeChatId) {
        this.view.setDraft(session.draft);
        this.callbacks.renderChat();
      }
      void this.persistence.save().catch(this.callbacks.reportStorageError);
    }
  }

  private async ensureApiAccess(session: ChatSession, baseUrl: string): Promise<boolean> {
    if (await this.hostPermission.requestAccess(baseUrl)) {
      this.callbacks.onHostPermissionGranted();
      return true;
    }

    session.error = "Access to this API host was not granted.";
    if (session.id === this.store.activeChatId) this.callbacks.renderChat();
    return false;
  }

  private clearCurrentChat(): void {
    const session = this.store.activeChat;
    if (!session) return;
    session.mutationVersion += 1;
    this.stopGenerating(session);
    session.messages = [];
    session.error = "";
    this.callbacks.renderChat();
    void this.persistence
      .save()
      .then(() => {
        this.callbacks.notify("Chat cleared.", "success");
        return this.callbacks.refreshStorageUsage();
      })
      .catch(() => {
        this.callbacks.notify("Could not clear the chat.", "error");
        this.callbacks.reportStorageError();
      });
    this.view.focusComposer();
  }

  private updateDraft(draft: string): void {
    const session = this.store.activeChat;
    if (session) session.draft = draft;
  }

  private updateScrollPosition(scrollTop: number, distanceFromBottom: number): void {
    const session = this.store.activeChat;
    if (!session) return;
    session.scrollTop = scrollTop;
    session.stickToBottom = distanceFromBottom <= 48;
    if (session.stickToBottom) session.hasNewContent = false;
    this.view.setNewContentVisible(session.hasNewContent);
  }

  private scrollActiveChatToEnd(): void {
    const session = this.store.activeChat;
    if (!session) return;
    session.scrollTop = this.view.scrollToEnd();
    session.stickToBottom = true;
    session.hasNewContent = false;
    this.view.setNewContentVisible(false);
  }

  private followNewContent(session: ChatSession): void {
    if (session.stickToBottom) {
      session.scrollTop = this.view.scrollToEnd();
      session.hasNewContent = false;
    } else {
      session.hasNewContent = true;
    }
    this.view.setNewContentVisible(session.hasNewContent);
  }
}
