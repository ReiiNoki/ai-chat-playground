const MAX_FAVICON_BYTES = 512 * 1024;
const MAX_HTML_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
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
    const directIcon = await this.fetchIcon(defaultIcon, origin);
    if (directIcon) return directIcon;

    const declaredIconUrl = await this.findDeclaredIcon(origin);
    return declaredIconUrl ? this.fetchIcon(declaredIconUrl, origin) : null;
  }

  private async findDeclaredIcon(origin: string): Promise<string | null> {
    const response = await this.fetchSameOrigin(`${origin}/`, origin);
    if (!response?.ok) return null;

    const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await this.readText(response, MAX_HTML_BYTES);
    const document = new DOMParser().parseFromString(html, "text/html");
    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[rel~="icon"][href], link[rel="apple-touch-icon"][href]',
    );

    for (const link of links) {
      try {
        const url = new URL(link.getAttribute("href") ?? "", response.url || origin);
        if ((url.protocol === "http:" || url.protocol === "https:") && url.origin === origin) {
          return url.href;
        }
      } catch {
        // Ignore malformed icon URLs and try the next declaration.
      }
    }
    return null;
  }

  private async fetchIcon(url: string, origin: string): Promise<string | null> {
    const response = await this.fetchSameOrigin(url, origin);
    if (!response?.ok) return null;

    const declaredLength = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FAVICON_BYTES) return null;

    const contentType = response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType && !ALLOWED_TYPES.has(contentType)) return null;

    const bytes = await this.readBytes(response, MAX_FAVICON_BYTES);
    if (bytes.byteLength === 0) return null;

    const type = contentType && ALLOWED_TYPES.has(contentType) ? contentType : "image/x-icon";
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return URL.createObjectURL(new Blob([buffer], { type }));
  }

  private async fetchSameOrigin(
    url: string,
    origin: string,
    redirects = 0,
  ): Promise<Response | null> {
    let requestUrl: URL;
    try {
      requestUrl = new URL(url);
    } catch {
      return null;
    }
    if (requestUrl.origin !== origin) return null;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(requestUrl.href, {
        cache: "force-cache",
        credentials: "omit",
        redirect: "manual",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        if (redirects >= MAX_REDIRECTS) return null;
        const location = response.headers.get("Location");
        if (!location) return null;
        const redirectedUrl = new URL(location, requestUrl.href);
        if (redirectedUrl.origin !== origin) return null;
        return this.fetchSameOrigin(redirectedUrl.href, origin, redirects + 1);
      }

      if (new URL(response.url || requestUrl.href).origin !== origin) return null;
      return response;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async readBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
    if (!response.body) {
      const buffer = await this.withTimeout(() => response.arrayBuffer());
      if (buffer.byteLength > maxBytes) throw new Error("Response is too large.");
      return new Uint8Array(buffer);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    let completed = false;
    try {
      while (true) {
        const { done, value } = await this.withTimeout(() => reader.read());
        if (done) {
          completed = true;
          break;
        }
        total += value.byteLength;
        if (total > maxBytes) throw new Error("Response is too large.");
        chunks.push(value);
      }
    } finally {
      if (!completed) await reader.cancel().catch(() => undefined);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  private withTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Request timed out.")), REQUEST_TIMEOUT_MS);
      void operation()
        .then(resolve, reject)
        .finally(() => window.clearTimeout(timeout));
    });
  }

  private async readText(response: Response, maxBytes: number): Promise<string> {
    const bytes = await this.readBytes(response, maxBytes);
    return new TextDecoder().decode(bytes);
  }
}
