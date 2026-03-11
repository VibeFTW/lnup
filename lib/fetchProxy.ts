/**
 * Shared URL-Fetch-Funktionen mit CORS-Proxy-Fallback.
 * Nutzbar in aiEventDiscovery, aiScraper und anderen Modulen.
 */

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeHostname(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url.replace(/^https?:\/\//, "").split("/")[0]; }
}

async function fetchDirect(url: string, maxChars = 25000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html,text/plain;q=0.9,*/*;q=0.8" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 50) return null;
    return stripHtmlToText(html).substring(0, maxChars);
  } catch {
    return null;
  }
}

async function fetchViaProxy(url: string, maxChars = 25000): Promise<string | null> {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const html = await res.text();
      if (!html || html.length < 50) continue;
      return stripHtmlToText(html).substring(0, maxChars);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Lädt den Textinhalt einer URL. Versucht zuerst direkt, dann über CORS-Proxies.
 */
export async function fetchPageContent(url: string, maxChars = 25000): Promise<string | null> {
  const direct = await fetchDirect(url, maxChars);
  if (direct) return direct;

  const proxied = await fetchViaProxy(url, maxChars);
  if (proxied) return proxied;

  return null;
}

/**
 * Lädt mehrere URLs parallel und gibt den kombinierten Text zurück.
 */
export async function fetchMultiplePages(
  urls: string[],
  maxTotalChars = 50000
): Promise<{ contents: Map<string, string>; totalLength: number }> {
  const contents = new Map<string, string>();
  let totalLength = 0;
  const perUrlLimit = Math.max(5000, Math.floor(maxTotalChars / Math.max(urls.length, 1)));

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const text = await fetchPageContent(url, perUrlLimit);
      return { url, text };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.text) {
      if (totalLength + result.value.text.length > maxTotalChars) {
        const remaining = maxTotalChars - totalLength;
        if (remaining > 500) {
          contents.set(result.value.url, result.value.text.substring(0, remaining));
          totalLength += remaining;
        }
        break;
      }
      contents.set(result.value.url, result.value.text);
      totalLength += result.value.text.length;
    }
  }

  return { contents, totalLength };
}
