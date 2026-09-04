import type { ChatSession } from "../domain/types";
import { tabLabel } from "../domain/providers";
import type { SavedEndpoint } from "./storage";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B used`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB used`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB used`;
}

export async function storageUsage(): Promise<string> {
  try {
    const bytes = await chrome.storage.local.getBytesInUse(null);
    return formatBytes(bytes);
  } catch {
    return "Storage usage unavailable.";
  }
}

export function exportChat(
  session: ChatSession,
  index: number,
  customEndpoints: SavedEndpoint[],
): void {
  const title = tabLabel(session, index, customEndpoints);
  const markdown = [
    `# ${title.providerFull} · ${title.model}`,
    "",
    ...session.messages.flatMap((message) => [
      `## ${message.role === "user" ? "User" : "Assistant"}`,
      "",
      message.content,
      "",
    ]),
  ].join("\n");
  const blobUrl = URL.createObjectURL(
    new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `ai-chat-playground-${Date.now()}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

export function removeLegacyApiKey(): Promise<void> {
  return chrome.storage.local.remove("apiKey");
}
