import type { ApiConfig } from "../services/storage";

export const NETWORK_ERROR =
  "Network request failed.\n\nCheck the API endpoint and browser access permissions.";

export function validateConfig(config: ApiConfig): string {
  if (!config.baseUrl.trim()) return "Base URL is required. Open Settings to configure it.";
  if (!config.model.trim()) return "Model is required. Open Settings to configure it.";
  return "";
}
