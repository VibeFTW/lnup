import { GEMINI_API_KEY } from "./constants";
import { geminiRequest, parseJsonArray } from "./geminiClient";
import type { EventCategory } from "@/types";

export interface ExtractedEvent {
  title: string;
  description: string;
  date: string;
  time_start: string;
  time_end: string | null;
  venue_name: string;
  venue_address: string;
  city: string;
  category: EventCategory;
  price_info: string;
  confidence: number;
}

const EXTRACTION_PROMPT = `Du bist ein Event-Daten-Extraktor. Analysiere den gegebenen Inhalt und extrahiere Event-Informationen daraus.

WICHTIG: Erfinde KEINE Daten. Nur was tatsächlich im Inhalt steht.

Gib ein JSON-Array zurück. Jedes Event hat folgende Felder:
- title (string): Name des Events
- description (string): Kurze Beschreibung, max 300 Zeichen
- date (string): Datum im Format YYYY-MM-DD
- time_start (string): Startzeit im Format HH:MM
- time_end (string | null): Endzeit im Format HH:MM oder null
- venue_name (string): Name der Location
- venue_address (string): Adresse
- city (string): Stadt
- category (string): Eine von: nightlife, food_drink, concert, festival, sports, art, family, other
- price_info (string): Preisinformation (z.B. "10€", "Kostenlos", "Ab 15€")
- confidence (number): Wie sicher du dir bist, 0.0 bis 1.0

Wenn keine Events gefunden werden, gib ein leeres Array zurück: []

WICHTIG: Antworte NUR mit dem JSON-Array. Kein Text davor oder danach, kein Markdown.`;

async function fetchUrlContent(url: string): Promise<string | null> {
  // 1. Direkt versuchen
  const direct = await fetchWithTimeout(url);
  if (direct) return direct;

  // 2. CORS-Proxy als Fallback
  const proxied = await fetchViaProxy(url);
  if (proxied) return proxied;

  return null;
}

async function fetchWithTimeout(url: string): Promise<string | null> {
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
    return stripHtmlToText(html).substring(0, 25000);
  } catch {
    return null;
  }
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url.replace(/^https?:\/\//, "").split("/")[0]; }
}

async function fetchViaProxy(url: string): Promise<string | null> {
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
      return stripHtmlToText(html).substring(0, 25000);
    } catch {
      continue;
    }
  }
  console.warn("[fetchViaProxy] All proxies failed for:", url);
  return null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractEventsFromUrl(url: string): Promise<ExtractedEvent[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key nicht konfiguriert. Bitte EXPO_PUBLIC_GEMINI_API_KEY in .env setzen.");
  }

  const pageContent = await fetchUrlContent(url);
  const useContent = pageContent && pageContent.length > 100;

  const { text } = await geminiRequest({
    apiKey: GEMINI_API_KEY,
    contents: [
      {
        parts: useContent
          ? [
              { text: EXTRACTION_PROMPT },
              { text: `Quelle: ${url}\n\nSeiteninhalt (zum Extrahieren der Events):\n\n${pageContent}` },
            ]
          : [
              { text: EXTRACTION_PROMPT },
              {
                text: `Der Seiteninhalt der folgenden URL konnte nicht direkt geladen werden.

AUFGABE: Besuche die URL über deine Google-Suchfunktion und finde alle Events/Veranstaltungen die dort gelistet sind.

Gehe so vor:
1. Suche nach "site:${safeHostname(url)} veranstaltungen events" und ähnlichen Begriffen
2. Durchsuche die Ergebnisse nach konkreten Events mit Datum, Uhrzeit, Location
3. Für jedes gefundene Event: Extrahiere alle verfügbaren Details (Titel, Datum, Uhrzeit, Ort, Preis)
4. Wenn keine Events gefunden werden, gib [] zurück

URL: ${url}`,
              },
            ],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.1,
    maxOutputTokens: 4096,
  });

  if (!text || typeof text !== "string") {
    throw new Error("Die KI hat keine Antwort geliefert.");
  }

  const trimmed = text.trim();
  const parsed = parseJsonArray<ExtractedEvent>(text);
  const valid = parsed.filter(
    (e) => e.title && e.date && e.time_start && e.venue_name
  );

  if (valid.length === 0) {
    const looksLikeEmptyArray =
      /^\[\s*\]$/.test(trimmed) ||
      trimmed.replace(/\s/g, "") === "[]" ||
      (trimmed.includes("[") && trimmed.includes("]") && trimmed.length < 100);
    if (!looksLikeEmptyArray && trimmed.length > 20) {
      throw new Error(
        "Die KI-Antwort konnte nicht ausgewertet werden. Bitte andere URL oder andere Seite versuchen."
      );
    }
  }

  return valid;
}

export async function extractEventsFromText(text: string, sourceUrl?: string): Promise<ExtractedEvent[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key nicht konfiguriert.");
  }

  const { text: responseText } = await geminiRequest({
    apiKey: GEMINI_API_KEY,
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          { text: `${sourceUrl ? `Quelle: ${sourceUrl}\n\n` : ""}Inhalt:\n${text.substring(0, 15000)}` },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.1,
    maxOutputTokens: 4096,
  });

  const parsed = parseJsonArray<ExtractedEvent>(responseText);
  return parsed.filter(
    (e) => e.title && e.date && e.time_start && e.venue_name
  );
}
