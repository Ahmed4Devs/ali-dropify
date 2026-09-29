export type AliExpressProductSource = {
  productId: string;
  url: string;
};

/** Only canonical item URLs are accepted as supplier sources. */
export function parseAliExpressProductUrl(value: string): AliExpressProductSource | null {
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" ||
      (host !== "aliexpress.com" && !host.endsWith(".aliexpress.com")) ||
      parsed.username || parsed.password || parsed.port) {
      return null;
    }
    const match = /^\/item\/([1-9]\d*)\.html\/?$/i.exec(parsed.pathname);
    if (!match) return null;
    return {
      productId: match[1],
      url: `https://www.aliexpress.com/item/${match[1]}.html`,
    };
  } catch {
    return null;
  }
}
