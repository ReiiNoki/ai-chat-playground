const MAX_FAVICON_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 5000;
const ALLOWED_TYPES = new Set([
  "application/octet-stream",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon",
]);

export class FaviconService {
  private readonly cache = new Map<string, Promise<string | null>>();

  get(baseUrl: string): Promise<string | null> {
    const origin = this.readOrigin(baseUrl);
    if (!origin) return Promise.resolve(null);

    const cached = this.cache.get(origin);
    if (cached) return cached;

    const request = this.load(origin).catch(() => null);
    this.cache.set(origin, request);
    return request;
  }

  private readOrigin(baseUrl: string): string | null {
    try {
      const url = new URL(baseUrl);
      return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
    } catch {
      return null;
    }
  }

  private async load(origin: string): Promise<string | null> {
    const defaultIcon = new URL("/favicon.ico", origin).href;
    const directIcon = await this.fetchIcon(defaultIcon);
    if (directIcon) return directIcon;

    const declaredIconUrl = await this.findDeclaredIcon(origin);
    return declaredIconUrl ? this.fetchIcon(declaredIconUrl) : null;
  }

  private async findDeclaredIcon(origin: string): Promise<string | null> {
    const response = await this.fetchWithTimeout(`${origin}/`);
    if (!response?.ok) return null;

    const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = (await response.text()).slice(0, 256 * 1024);
    const document = new DOMParser().parseFromString(html, "text/html");
    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[rel~="icon"][href], link[rel="apple-touch-icon"][href]',
    );

    for (const link of links) {
      try {
        const url = new URL(link.getAttribute("href") ?? "", response.url || origin);
        if (url.protocol === "http:" || url.protocol === "https:") return url.href;
      } catch {
        // Ignore malformed icon URLs and try the next declaration.
      }
    }
    return null;
  }

  private async fetchIcon(url: string): Promise<string | null> {
    const response = await this.fetchWithTimeout(url);
    if (!response?.ok) return null;

    const declaredLength = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FAVICON_BYTES) return null;

    const contentType = response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType && !ALLOWED_TYPES.has(contentType)) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FAVICON_BYTES) return null;

    const type = contentType && ALLOWED_TYPES.has(contentType) ? contentType : "image/x-icon";
    return URL.createObjectURL(new Blob([bytes], { type }));
  }

  private async fetchWithTimeout(url: string): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        cache: "force-cache",
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
