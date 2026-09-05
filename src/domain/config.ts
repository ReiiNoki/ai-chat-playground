import type { ApiConfig } from "../services/storage";

export const NETWORK_ERROR =
  "Network request failed.\n\nCheck the API endpoint and browser access permissions.";

export function parseBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function endpointOrigin(value: string): string | null {
  return parseBaseUrl(value)?.origin ?? null;
}

export function validateCredentialTransport(baseUrl: string, apiKey: string): string {
  const url = parseBaseUrl(baseUrl);
  if (!url || !apiKey.trim() || url.protocol === "https:") return "";
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return "";
  return "API keys require HTTPS except when connecting to localhost.";
}

export function validateConfig(config: ApiConfig): string {
  if (!config.baseUrl.trim()) return "Base URL is required. Open Settings to configure it.";
  if (!parseBaseUrl(config.baseUrl)) {
    return "Base URL must be an HTTP or HTTPS URL without credentials, query parameters, or fragments.";
  }
  const transportError = validateCredentialTransport(config.baseUrl, config.apiKey);
  if (transportError) return transportError;
  if (!config.model.trim()) return "Model is required. Open Settings to configure it.";
  if (config.temperature !== null && (config.temperature < 0 || config.temperature > 2)) {
    return "Temperature must be between 0 and 2.";
  }
  if (config.maxTokens !== null && (!Number.isInteger(config.maxTokens) || config.maxTokens < 1)) {
    return "Max Tokens must be a positive integer.";
  }
  if (config.topP !== null && (config.topP < 0 || config.topP > 1)) {
    return "Top P must be between 0 and 1.";
  }
  if (config.seed !== null && !Number.isInteger(config.seed)) return "Seed must be an integer.";
  return "";
}
