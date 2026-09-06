import { parseBaseUrl } from "../domain/config";
import type { ApiConfig } from "./storage";

export type Message = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
};

export type StreamDelta = {
  content?: string;
  reasoning?: string;
};

export type RetryInfo = {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  status: number;
};

type StreamOptions = {
  config: ApiConfig;
  messages: Message[];
  signal: AbortSignal;
  onDelta: (delta: StreamDelta) => void;
  onRetry?: (info: RetryInfo) => void;
};

const MAX_RETRIES = 2;
const MODEL_REQUEST_TIMEOUT_MS = 30_000;
const TEST_REQUEST_TIMEOUT_MS = 60_000;
const STREAM_IDLE_TIMEOUT_MS = 120_000;
const MAX_SSE_BUFFER_BYTES = 1024 * 1024;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class ApiError extends Error {
  constructor(
    public readonly displayMessage: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(displayMessage);
    this.name = "ApiError";
  }
}

function endpointFor(baseUrl: string, path: string): string {
  const parsed = parseBaseUrl(baseUrl);
  if (!parsed) {
    throw new ApiError(
      "Base URL must be an HTTP or HTTPS URL without credentials, query parameters, or fragments.",
    );
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/${path}`;
  return parsed.href;
}

type LinkedSignal = {
  controller: AbortController;
  signal: AbortSignal;
  dispose: () => void;
};

function createLinkedSignal(signal: AbortSignal | undefined): LinkedSignal {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort(signal?.reason);

  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener("abort", onAbort, { once: true });

  return {
    controller,
    signal: controller.signal,
    dispose: () => signal?.removeEventListener("abort", onAbort),
  };
}

function isTimeoutAbort(signal: AbortSignal | undefined): boolean {
  const reason = signal?.reason;
  return reason instanceof DOMException && reason.name === "TimeoutError";
}

async function withRequestTimeout<T>(
  signal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutMessage: string,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const linked = createLinkedSignal(signal);
  const timeout = window.setTimeout(
    () => linked.controller.abort(new DOMException(timeoutMessage, "TimeoutError")),
    timeoutMs,
  );

  try {
    return await operation(linked.signal);
  } catch (error) {
    if (!signal?.aborted && isTimeoutAbort(linked.signal)) throw new ApiError(timeoutMessage);
    throw error;
  } finally {
    window.clearTimeout(timeout);
    linked.dispose();
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(input, { ...init, signal });
}

function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const idleTimeout = window.setTimeout(
      () => reject(new ApiError("The streaming response timed out.")),
      STREAM_IDLE_TIMEOUT_MS,
    );
    const onAbort = (): void => reject(signal.reason);

    signal.addEventListener("abort", onAbort, { once: true });
    void reader
      .read()
      .then(resolve, reject)
      .finally(() => {
        window.clearTimeout(idleTimeout);
        signal.removeEventListener("abort", onAbort);
      });
  });
}

const API_KEY_HEADER_HOSTS = new Set(["api.xiaomimimo.com"]);

function authHeaderName(baseUrl: string): "Authorization" | "api-key" {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (API_KEY_HEADER_HOSTS.has(host) || host.endsWith(".xiaomimimo.com")) return "api-key";
  } catch {
    // Fall through to the default Authorization header.
  }
  return "Authorization";
}

function requestHeaders(baseUrl: string, apiKey: string, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const trimmed = apiKey.trim();
  if (trimmed) {
    const header = authHeaderName(baseUrl);
    headers[header] = header === "api-key" ? trimmed : `Bearer ${trimmed}`;
  }
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

function limitedText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 1000);
}

function retryAfter(response: Response): number | undefined {
  const value = response.headers.get("Retry-After")?.trim();
  if (!value) return undefined;

  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1000
    : new Date(value).getTime() - Date.now();
  if (!Number.isFinite(milliseconds)) return undefined;
  return Math.min(Math.max(milliseconds, 0), 30_000);
}

async function responseError(response: Response): Promise<ApiError> {
  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
  let detail = "";

  try {
    const responseText = await response.text();
    try {
      const payload: unknown = JSON.parse(responseText);
      if (payload && typeof payload === "object") {
        const error = (payload as { error?: unknown }).error;
        if (error && typeof error === "object") {
          detail = limitedText((error as { message?: unknown }).message);
        } else {
          detail = limitedText((payload as { message?: unknown }).message);
        }
      }
    } catch {
      detail = limitedText(responseText);
    }
  } catch {
    detail = "";
  }

  return new ApiError(
    detail ? `${status}\n\n${detail}` : status,
    response.status,
    retryAfter(response),
  );
}

function streamError(payload: unknown): ApiError | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (!error) return null;

  if (typeof error === "string") {
    return new ApiError(limitedText(error) || "The API returned a streaming error.");
  }

  if (typeof error === "object") {
    const message = limitedText((error as { message?: unknown }).message);
    return new ApiError(message || "The API returned a streaming error.");
  }

  return new ApiError("The API returned a streaming error.");
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = (): void => {
      window.clearTimeout(timeout);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function listModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    return await withRequestTimeout(
      signal,
      MODEL_REQUEST_TIMEOUT_MS,
      "The API request timed out.",
      async (requestSignal) => {
        const response = await fetchWithTimeout(
          endpointFor(baseUrl, "models"),
          { headers: requestHeaders(baseUrl, apiKey) },
          requestSignal,
        );

        if (!response.ok) throw await responseError(response);

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new ApiError("The API returned an invalid model list.");
        }

        if (!payload || typeof payload !== "object") {
          throw new ApiError("The API returned an invalid model list.");
        }

        const record = payload as { data?: unknown; models?: unknown };
        const data = Array.isArray(record.data)
          ? record.data
          : Array.isArray(record.models)
            ? record.models
            : null;
        if (!data) throw new ApiError("The API returned an invalid model list.");

        return [
          ...new Set(
            data
              .map((item): unknown => {
                if (typeof item === "string") return item;
                if (!item || typeof item !== "object") return undefined;
                const model = item as { id?: unknown; name?: unknown; model?: unknown };
                return model.id ?? model.name ?? model.model;
              })
              .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
              .map((id) => id.trim()),
          ),
        ].sort((left, right) => left.localeCompare(right));
      },
    );
  } catch (error) {
    if (signal?.aborted || error instanceof ApiError) throw error;
    throw new ApiError(
      "Network request failed.\n\nCheck the API endpoint and browser access permissions.",
    );
  }
}

export async function testChatConnection(config: ApiConfig, signal: AbortSignal): Promise<void> {
  try {
    await withRequestTimeout(
      signal,
      TEST_REQUEST_TIMEOUT_MS,
      "The API request timed out.",
      async (requestSignal) => {
        const response = await fetchWithTimeout(
          endpointFor(config.baseUrl, "chat/completions"),
          {
            method: "POST",
            headers: requestHeaders(config.baseUrl, config.apiKey, true),
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: "user", content: "Reply with OK." }],
              stream: false,
            }),
          },
          requestSignal,
        );

        if (!response.ok) throw await responseError(response);

        try {
          const payload: unknown = await response.json();
          const choices =
            payload && typeof payload === "object" ? (payload as { choices?: unknown }).choices : null;
          if (!Array.isArray(choices)) throw new Error();
        } catch {
          throw new ApiError("The Chat Completions endpoint returned an invalid response.");
        }
      },
    );
  } catch (error) {
    if (signal.aborted || error instanceof ApiError) throw error;
    throw new ApiError(
      "Network request failed.\n\nCheck the API endpoint and browser access permissions.",
    );
  }
}

async function streamAttempt({ config, messages, signal, onDelta }: StreamOptions): Promise<void> {
  const linked = createLinkedSignal(signal);
  let response: Response;

  try {
    const headerTimeout = window.setTimeout(
      () => linked.controller.abort(new DOMException("The API request timed out.", "TimeoutError")),
      STREAM_IDLE_TIMEOUT_MS,
    );
    try {
      response = await fetchWithTimeout(
        endpointFor(config.baseUrl, "chat/completions"),
        {
          method: "POST",
          headers: requestHeaders(config.baseUrl, config.apiKey, true),
          body: JSON.stringify({
            model: config.model,
            messages: [
              ...(config.systemPrompt.trim()
                ? [{ role: "system" as const, content: config.systemPrompt }]
                : []),
              ...messages.map(({ role, content }) => ({ role, content })),
            ],
            stream: true,
            ...(config.temperature !== null ? { temperature: config.temperature } : {}),
            ...(config.maxTokens !== null ? { max_tokens: config.maxTokens } : {}),
            ...(config.topP !== null ? { top_p: config.topP } : {}),
            ...(config.seed !== null ? { seed: config.seed } : {}),
          }),
        },
        linked.signal,
      );
    } finally {
      window.clearTimeout(headerTimeout);
    }
  } catch (error) {
    linked.dispose();
    if (!signal.aborted && isTimeoutAbort(linked.signal)) throw new ApiError("The API request timed out.");
    if (signal.aborted || error instanceof ApiError) throw error;
    throw new ApiError(
      "Network request failed.\n\nCheck the API endpoint and browser access permissions.",
    );
  }

  if (!response.ok) {
    try {
      throw await responseError(response);
    } finally {
      linked.dispose();
    }
  }
  if (!response.body) {
    linked.dispose();
    throw new ApiError("The API returned an empty streaming response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const processEvent = (event: string): void => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data) return;
    if (data === "[DONE]") {
      completed = true;
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new ApiError("The API returned an invalid SSE message.");
    }
    const error = streamError(payload);
    if (error) throw error;
    if (!payload || typeof payload !== "object") return;

    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices)) return;
    const first = choices[0] as
      | {
          finish_reason?: unknown;
          delta?: {
            content?: unknown;
            reasoning_content?: unknown;
            reasoning?: unknown;
            thinking?: unknown;
          };
        }
      | undefined;
    if (typeof first?.finish_reason === "string" && first.finish_reason) completed = true;
    const delta = first?.delta;
    const content = delta?.content;
    const reasoning = delta?.reasoning_content ?? delta?.reasoning ?? delta?.thinking;
    const streamDelta: StreamDelta = {};
    if (typeof content === "string") streamDelta.content = content;
    if (typeof reasoning === "string") streamDelta.reasoning = reasoning;
    if (streamDelta.content !== undefined || streamDelta.reasoning !== undefined) {
      onDelta(streamDelta);
    }
  };

  try {
    while (!completed) {
      const { done, value } = await readWithTimeout(reader, linked.signal);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_SSE_BUFFER_BYTES) throw new ApiError("The SSE event is too large.");
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) processEvent(event);
    }
    buffer += decoder.decode();
    if (buffer.trim()) processEvent(buffer);
    if (!completed) throw new ApiError("The streaming response ended unexpectedly.");
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    linked.dispose();
  }
}

export async function streamChat(options: StreamOptions): Promise<void> {
  let receivedOutput = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await streamAttempt({
        ...options,
        onDelta(delta) {
          receivedOutput = true;
          options.onDelta(delta);
        },
      });
      return;
    } catch (error) {
      if (options.signal.aborted) throw error;
      const canRetry =
        !receivedOutput &&
        error instanceof ApiError &&
        error.status !== undefined &&
        RETRYABLE_STATUSES.has(error.status) &&
        attempt < MAX_RETRIES;
      if (!canRetry) throw error;

      const delayMs = error.retryAfterMs ?? 1000 * 2 ** attempt;
      options.onRetry?.({
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        delayMs,
        status: error.status ?? 0,
      });
      await abortableDelay(delayMs, options.signal);
    }
  }
}
