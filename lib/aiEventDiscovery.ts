import type { Event, EventCategory, Venue } from "@/types";
import { GEMINI_API_KEY } from "./constants";
import { geminiRequest, parseJsonArray } from "./geminiClient";
import { getSourcesForCity } from "./eventSources";
import { fetchMultiplePages } from "./fetchProxy";

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const SEARCH_QUERIES = [
  "{city} veranstaltungen diese woche",
  "{city} events März 2026",
  "{city} veranstaltungskalender",
  "{city} party konzert club bar",
  "{city} live musik comedy karaoke",
  "{city} flohmarkt markt straßenfest",
  "{city} workshop kurs veranstaltung",
  "was ist los in {city}",
];

function buildSystemInstruction(city: string, today: string, endDate: string, weekday: string) {
  const sources = getSourcesForCity(city);
  const websiteList = sources.websites.length > 0
    ? `\n\nWICHTIGE QUELLEN – Durchsuche diese Webseiten gezielt nach Events:\n${sources.websites.map((u) => `- ${u}`).join("\n")}`
    : "";
  const instaList = sources.instagram.length > 0
    ? `\n\nWICHTIGE INSTAGRAM-ACCOUNTS – Durchsuche diese Accounts GRÜNDLICH nach Events:
${sources.instagram.map((h) => `- https://www.instagram.com/${h}/`).join("\n")}

So gehst du bei jedem Instagram-Account vor:
1. Öffne die Profilseite und lies die BIOGRAPHIE – Clubs/Bars schreiben dort oft das nächste Event (Datum, Name, Uhrzeit).
2. Schau dir die neuesten POSTS und REELS an – Event-Ankündigungen mit Datum, Flyer, Beschreibungen.
3. Wenn in der Bio oder Posts ein Event mit Datum erwähnt wird, suche weitere Details (Adresse, Preis, Uhrzeit) auf der verlinkten Webseite oder über Google.
4. Die source_url kann der Instagram-Post, das Profil ODER eine verlinkte Webseite sein.`
    : "";

  return `Du bist ein Event-Scout für ${city} (Deutschland).
Finde ECHTE Events zwischen ${today} (${weekday}) und ${endDate}.
${websiteList}${instaList}

SUCHSTRATEGIE:
1. Suche "${city} veranstaltungen ${today.substring(0, 7)}" und "${city} events"
2. Öffne die Ergebnisse und extrahiere konkrete Events mit Datum
3. Suche auf den oben genannten Webseiten (falls vorhanden)
4. Suche auf Instagram nach den genannten Accounts
5. Auch reguläre Events wie Wochenmärkte, Stammtische, wiederkehrende Partys SIND gültig, solange sie im Zeitraum stattfinden

REGELN:
- Erfinde KEINE Events. Nur was du in Suchergebnissen findest.
- source_url: Die URL wo du das Event gefunden hast (Webseite, Instagram, Veranstaltungskalender)
- Wenn du keine genaue Uhrzeit findest: "20:00" als Default
- Wenn du keinen genauen Preis findest: "Keine Angabe"
- confidence: Wie sicher du dir bist dass das Event real ist und im Zeitraum stattfindet

KATEGORIEN: nightlife, food_drink, concert, festival, sports, art, family, other

ANTWORTFORMAT: NUR ein JSON-Array. Kein Text, kein Markdown.`;
}

function buildUserPrompt(city: string, today: string, searchQueries: string[]) {
  return `Finde alle Events in ${city} zwischen ${today} und 2 Wochen danach.

Suchbegriffe die du verwenden sollst:
${searchQueries.slice(0, 8).join("\n")}

JSON-Array Format:
[{"title":"...","description":"max 200 Zeichen","date":"YYYY-MM-DD","time_start":"HH:MM","time_end":"HH:MM oder null","venue_name":"...","venue_address":"...","city":"${city}","category":"nightlife|food_drink|concert|festival|sports|art|family|other","price_info":"...","source_url":"URL wo gefunden","confidence":0.0-1.0}]

Gib [] zurück wenn nichts gefunden. NUR das JSON-Array, kein anderer Text.`;
}

interface DiscoveredEvent {
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
  source_url: string | null;
  confidence: number;
}

const pendingCache = new Map<string, Event[]>();

export function clearAiCache(city?: string) {
  if (city) pendingCache.delete(city.toLowerCase());
  else pendingCache.clear();
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/**
 * Scrape-first-Ansatz: Quellen-URLs laden, Inhalt an Gemini geben (ohne google_search).
 * Zuverlässiger als google_search, weil wir den konkreten Seiteninhalt haben.
 */
async function scrapeAndAnalyze(
  city: string,
  today: string,
  endDate: string,
  weekday: string
): Promise<Event[]> {
  const sources = getSourcesForCity(city);
  if (sources.websites.length === 0) return [];

  console.log(`[scrapeAndAnalyze] Loading ${sources.websites.length} sources for ${city}...`);
  const { contents, totalLength } = await fetchMultiplePages(sources.websites);

  if (contents.size === 0 || totalLength < 100) {
    console.warn(`[scrapeAndAnalyze] No content loaded for ${city}`);
    return [];
  }

  console.log(`[scrapeAndAnalyze] Loaded ${contents.size}/${sources.websites.length} sources (${totalLength} chars)`);

  let combinedText = "";
  for (const [url, text] of contents) {
    combinedText += `\n\n=== QUELLE: ${url} ===\n${text}`;
  }

  const prompt = `Analysiere den folgenden Seiteninhalt aus ${city} und extrahiere ALLE Events/Veranstaltungen die zwischen ${today} (${weekday}) und ${endDate} stattfinden.

REGELN:
- Extrahiere NUR Events die im Text tatsächlich erwähnt werden
- Für jedes Event: Titel, Datum, Uhrzeit, Location, Beschreibung, Kategorie
- Wenn keine Uhrzeit angegeben: nutze "20:00" als Default
- source_url = die URL der Quelle (steht jeweils über dem Textblock)
- confidence basiert darauf wie vollständig die Event-Daten sind

Antwort als JSON-Array:
[{"title":"...","description":"max 200 Zeichen","date":"YYYY-MM-DD","time_start":"HH:MM","time_end":"HH:MM oder null","venue_name":"...","venue_address":"...","city":"${city}","category":"nightlife|food_drink|concert|festival|sports|art|family|other","price_info":"...","source_url":"URL der Quelle","confidence":0.0-1.0}]

Leeres Array [] wenn keine Events gefunden.`;

  const { text: responseText } = await geminiRequest({
    apiKey: GEMINI_API_KEY,
    contents: [
      { parts: [{ text: prompt }, { text: combinedText.substring(0, 50000) }] },
    ],
    temperature: 0.1,
    maxOutputTokens: 8192,
  });

  if (!responseText) return [];

  const discovered = parseJsonArray<DiscoveredEvent>(responseText);
  return discovered
    .filter(
      (e) =>
        e.title && e.date && e.venue_name &&
        e.date >= today && e.date <= endDate
    )
    .map((e, i): Event => {
      const venue: Venue = {
        id: `ai-venue-${city}-${i}-${Date.now()}`,
        name: e.venue_name,
        address: e.venue_address || e.city,
        city: toTitleCase(e.city || city),
        lat: 0, lng: 0,
        google_place_id: null, website: null, instagram: null,
        phone: null, verified: false, owner_id: null,
        created_at: new Date().toISOString(),
      };

      return {
        id: `ai-${city}-${e.date}-${i}-${Date.now()}`,
        title: e.title,
        description: e.description?.substring(0, 300) ?? "",
        venue_id: venue.id,
        venue,
        series_id: null,
        event_date: e.date,
        time_start: e.time_start || "20:00",
        time_end: e.time_end,
        category: validCategory(e.category),
        price_info: e.price_info || "Keine Angabe",
        source_type: "ai_discovered",
        source_url: e.source_url,
        created_by: null,
        status: "active",
        ai_confidence: e.confidence ?? 0.8,
        image_url: null,
        created_at: new Date().toISOString(),
        is_private: false,
        invite_code: null,
        max_attendees: null,
        saves_count: 0,
        going_count: 0,
        confirmations_count: 0,
        photos_count: 0,
      };
    });
}

export async function discoverLocalEvents(city: string): Promise<Event[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API-Key fehlt. Bitte in .env konfigurieren.");
  }

  const cacheKey = city.toLowerCase();
  const cached = pendingCache.get(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekday = WEEKDAYS[now.getDay()];
  const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 1. Scrape-first: Quellen direkt laden und auswerten (zuverlässiger)
  try {
    const scraped = await scrapeAndAnalyze(city, today, endDate, weekday);
    if (scraped.length > 0) {
      console.log(`[discoverLocalEvents] Scrape found ${scraped.length} events for ${city}`);
      pendingCache.set(cacheKey, scraped);
      return scraped;
    }
  } catch (e) {
    console.warn("[discoverLocalEvents] scrapeAndAnalyze failed:", e);
  }

  // 2. Fallback: Google Search Grounding
  console.log(`[discoverLocalEvents] Falling back to google_search for ${city}`);
  const sources = getSourcesForCity(city);
  const baseQueries = SEARCH_QUERIES.map((q) => q.replace("{city}", city));
  const sourceQueries = sources.websites.map((url) => {
    try { return `site:${new URL(url).hostname} events veranstaltungen`; }
    catch { return `${url} events veranstaltungen`; }
  });
  const instaQueries = sources.instagram.flatMap((handle) => [
    `site:instagram.com ${handle}`,
    `instagram.com/${handle} event party`,
  ]);
  const searchQueries = [...baseQueries, ...sourceQueries, ...instaQueries];

  const { text, groundingUrls } = await geminiRequest({
    apiKey: GEMINI_API_KEY,
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(city, today, endDate, weekday) }],
    },
    contents: [
      { parts: [{ text: buildUserPrompt(city, today, searchQueries) }] },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.2,
    maxOutputTokens: 8192,
  });

  if (!text) {
    throw new Error("Die KI konnte keine Events finden. Bitte später erneut versuchen.");
  }

  const events = processDiscoveredEvents(text, groundingUrls, city, today, endDate);

  if (events.length > 0) {
    pendingCache.set(cacheKey, events);
  }
  return events;
}

function processDiscoveredEvents(
  text: string,
  groundingUrls: string[],
  city: string,
  today: string,
  endDate: string
): Event[] {
  const discovered = parseJsonArray<DiscoveredEvent>(text);

  if (discovered.length === 0 && text) {
    console.warn(
      "[discoverLocalEvents] Gemini lieferte 0 Events. Rohtext (Auszug):",
      text.substring(0, 600)
    );
  }

  const groundingUrlSet = new Set(
    groundingUrls.map((u) => normalizeUrl(u))
  );

  return discovered
    .filter(
      (e) =>
        e.title &&
        e.date &&
        e.time_start &&
        e.venue_name &&
        (e.confidence ?? 0.8) >= 0.5 &&
        e.date >= today &&
        e.date <= endDate
    )
    .map((e) => {
      if (e.source_url && groundingUrlSet.size > 0) {
        const normalizedSource = normalizeUrl(e.source_url);
        const isGrounded = [...groundingUrlSet].some(
          (gUrl) => normalizedSource.includes(gUrl) || gUrl.includes(normalizedSource)
        );
        if (!isGrounded) {
          e.confidence = (e.confidence ?? 0.8) * 0.9;
        }
      }
      if (!e.source_url) {
        e.confidence = (e.confidence ?? 0.8) * 0.8;
      }
      return e;
    })
    .filter((e) => (e.confidence ?? 0.5) >= 0.5)
    .map((e, i): Event => {
      const venue: Venue = {
        id: `ai-venue-${city}-${i}-${Date.now()}`,
        name: e.venue_name,
        address: e.venue_address || e.city,
        city: toTitleCase(e.city || city),
        lat: 0,
        lng: 0,
        google_place_id: null,
        website: null,
        instagram: null,
        phone: null,
        verified: false,
        owner_id: null,
        created_at: new Date().toISOString(),
      };

      return {
        id: `ai-${city}-${e.date}-${i}-${Date.now()}`,
        title: e.title,
        description: e.description?.substring(0, 300) ?? "",
        venue_id: venue.id,
        venue,
        series_id: null,
        event_date: e.date,
        time_start: e.time_start,
        time_end: e.time_end,
        category: validCategory(e.category),
        price_info: e.price_info || "Keine Angabe",
        source_type: "ai_discovered",
        source_url: e.source_url,
        created_by: null,
        status: "active",
        ai_confidence: e.confidence,
        image_url: null,
        created_at: new Date().toISOString(),
        is_private: false,
        invite_code: null,
        max_attendees: null,
        saves_count: 0,
        going_count: 0,
        confirmations_count: 0,
        photos_count: 0,
      };
    });
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  }
}

const VALID_CATEGORIES: EventCategory[] = [
  "nightlife",
  "food_drink",
  "concert",
  "festival",
  "sports",
  "art",
  "family",
  "other",
];

function validCategory(cat: string): EventCategory {
  return VALID_CATEGORIES.includes(cat as EventCategory)
    ? (cat as EventCategory)
    : "other";
}
