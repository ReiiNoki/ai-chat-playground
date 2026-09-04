export class HostPermissionService {
  async hasAccess(baseUrl: string): Promise<boolean> {
    const origin = this.toOriginPattern(baseUrl);
    if (!origin) return false;

    try {
      return await chrome.permissions.contains({ origins: [origin] });
    } catch {
      return false;
    }
  }

  async requestAccess(baseUrl: string): Promise<boolean> {
    const origin = this.toOriginPattern(baseUrl);
    if (!origin) return false;

    try {
      return await chrome.permissions.request({ origins: [origin] });
    } catch {
      return false;
    }
  }

  private toOriginPattern(baseUrl: string): string | null {
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return `${url.origin}/*`;
    } catch {
      return null;
    }
  }
}
