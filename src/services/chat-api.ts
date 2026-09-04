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
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new ApiError("Invalid Base URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ApiError("Base URL must use HTTP or HTTPS.");
  }

  return `${normalized}/${path}`;
}

function requestHeaders(apiKey: string, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
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
  let response: Response;

  try {
    response = await fetch(endpointFor(baseUrl, "models"), {
      headers: requestHeaders(apiKey),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "Network request failed.\n\nCheck the API endpoint and browser access permissions.",
    );
  }

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
}

export async function testChatConnection(config: ApiConfig, signal: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await fetch(endpointFor(config.baseUrl, "chat/completions"), {
      method: "POST",
      headers: requestHeaders(config.apiKey, true),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Reply with OK." }],
        stream: false,
      }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError(
      "Network request failed.\n\nCheck the API endpoint and browser access permissions.",
    );
  }

  if (!response.ok) throw await responseError(response);

  try {
    const payload: unknown = await response.json();
    const choices = payload && typeof payload === "object" ? (payload as { choices?: unknown }).choices : null;
    if (!Array.isArray(choices)) throw new Error();
  } catch {
    throw new ApiError("The Chat Completions endpoint returned an invalid response.");
  }
}

async function streamAttempt({ config, messages, signal, onDelta }: StreamOptions): Promise<void> {
  let response: Response;

  try {
    response = await fetch(endpointFor(config.baseUrl, "chat/completions"), {
      method: "POST",
      headers: requestHeaders(config.apiKey, true),
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
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError(
      "Network request failed.\n\nCheck the API endpoint and browser access permissions.",
    );
  }

  if (!response.ok) throw await responseError(response);
  if (!response.body) throw new ApiError("The API returned an empty streaming response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processLine = (line: string): boolean => {
    const cleanLine = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!cleanLine.startsWith("data:")) return false;

    const data = cleanLine.slice(5).trim();
    if (!data) return false;
    if (data === "[DONE]") return true;

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new ApiError("The API returned an invalid SSE message.");
    }

    const error = streamError(payload);
    if (error) throw error;

    if (payload && typeof payload === "object") {
      const choices = (payload as { choices?: unknown }).choices;
      if (Array.isArray(choices)) {
        const first = choices[0] as
          | {
              delta?: {
                content?: unknown;
                reasoning_content?: unknown;
                reasoning?: unknown;
                thinking?: unknown;
              };
            }
          | undefined;
        const delta = first?.delta;
        const content = delta?.content;
        const reasoning = delta?.reasoning_content ?? delta?.reasoning ?? delta?.thinking;
        const streamDelta: StreamDelta = {};
        if (typeof content === "string") streamDelta.content = content;
        if (typeof reasoning === "string") streamDelta.reasoning = reasoning;
        if (streamDelta.content !== undefined || streamDelta.reasoning !== undefined) {
          onDelta(streamDelta);
        }
      }
    }

    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (processLine(line)) {
        await reader.cancel();
        return;
      }
    }
  }

  buffer += decoder.decode();
  if (buffer && processLine(buffer)) return;
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
