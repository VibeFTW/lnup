import type { Event, EventCategory, Venue } from "@/types";
import { GEMINI_API_KEY } from "./constants";
import { geminiRequest, parseJsonArray } from "./geminiClient";

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const SEARCH_QUERIES = [
  "{city} events diese woche restaurant bar",
  "{city} veranstaltungen lokal gastronomie",
  "{city} pub quiz karaoke comedy abend",
  "{city} food event themenabend restaurant",
  "{city} live musik kneipe bar club",
  "{city} flohmarkt markt straßenfest",
  "{city} workshop kurs kreativ abend",
  "{city} club bar Instagram events Termine",
  "{city} Instagram Location events Party Konzert",
  "site:instagram.com {city} club Party Event",
];

function buildSystemInstruction(city: string, today: string, endDate: string, weekday: string) {
  return `Du bist ein erfahrener Event-Scout für die Stadt ${city} in Deutschland.
Deine Aufgabe: Finde ECHTE, AKTUELLE Events die zwischen ${today} (${weekday}) und ${endDate} stattfinden.

REGELN:
- Erfinde NIEMALS Events. Nur Events die du tatsächlich über die Google-Suche findest.
- Jedes Event MUSS eine echte, funktionierende source_url haben (Webseite ODER Instagram-Beitrag/Seite).
- Suche auch gezielt auf Instagram: Clubs, Bars und Locations posten dort oft ihre Events. Instagram-URLs (instagram.com/...) sind als source_url erlaubt.
- Gib NUR Events zurück bei denen du dir sicher bist (confidence >= 0.7).

NICHT zurückgeben:
- Regelmäßige Öffnungszeiten von Restaurants/Bars (z.B. "Happy Hour jeden Freitag")
- Dauerausstellungen in Museen
- Events die bereits stattgefunden haben (vor ${today})
- Erfundene oder vermutete Events

KATEGORIEN: nightlife, food_drink, concert, festival, sports, art, family, other

ANTWORTFORMAT: Antworte NUR mit einem JSON-Array. Kein einleitender Text, keine Erklärungen, kein Markdown. Nur das reine JSON-Array.`;
}

function buildUserPrompt(city: string, today: string, searchQueries: string[]) {
  return `Suche nach Events in ${city} mit folgenden Suchbegriffen:
${searchQueries.join("\n")}

Suche nach:
- Themenabende in Restaurants, Weinproben
- Bar-Events (Pub Quiz, Karaoke, Open Mic, DJ-Abende)
- Lokale Live-Musik in Kneipen/Bars, Club-Events
- Instagram-Posts und -Seiten von Clubs, Bars und Locations in ${city} (dort werden oft Events angekündigt)
- Flohmärkte, Kunstmärkte, Straßenfeste
- Comedy-Abende, Poetry Slams
- Workshops, Kurse
- Vereinsevents, lokale Feste
- Sport-Events

Antwort als JSON-Array. Jedes Event:
{
  "title": "Name des Events",
  "description": "Kurze Beschreibung, max 200 Zeichen",
  "date": "YYYY-MM-DD",
  "time_start": "HH:MM",
  "time_end": "HH:MM oder null",
  "venue_name": "Name der Location",
  "venue_address": "Vollständige Adresse",
  "city": "${city}",
  "category": "nightlife|food_drink|concert|festival|sports|art|family|other",
  "price_info": "z.B. 10€, Kostenlos, Ab 5€",
  "source_url": "URL der Webseite oder des Instagram-Posts (PFLICHT). Instagram z.B. https://www.instagram.com/p/... oder https://instagram.com/username/",
  "confidence": 0.0-1.0
}

BEISPIEL für ein korrektes Event (Webseite):
[{"title":"Pub Quiz Night","description":"Wöchentliches Pub Quiz mit Preisen. Teams bis 6 Personen.","date":"${today}","time_start":"20:00","time_end":"22:30","venue_name":"Irish Pub Downtown","venue_address":"Hauptstraße 12, ${city}","city":"${city}","category":"nightlife","price_info":"5€ pro Person","source_url":"https://example.com/events/pub-quiz","confidence":0.85}]
BEISPIEL mit Instagram-Quelle: source_url kann auch "https://www.instagram.com/p/ABC123/" oder die Instagram-Seite einer Location sein.

Leeres Array [] wenn nichts gefunden.

WICHTIG: Antworte NUR mit dem JSON-Array. Kein Text davor oder danach.`;
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

  const searchQueries = SEARCH_QUERIES.map((q) => q.replace("{city}", city));

  const { text, groundingUrls } = await geminiRequest({
    apiKey: GEMINI_API_KEY,
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(city, today, endDate, weekday) }],
    },
    contents: [
      {
        parts: [{ text: buildUserPrompt(city, today, searchQueries) }],
      },
    ],
    tools: [{ google_search: {} }],
    temperature: 0.2,
    maxOutputTokens: 8192,
  });

  if (!text) {
    throw new Error("Gemini hat keine Antwort zurückgegeben.");
  }

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

  const events = discovered
    .filter(
      (e) =>
        e.title &&
        e.date &&
        e.time_start &&
        e.venue_name &&
        e.confidence >= 0.7 &&
        e.source_url &&
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
          e.confidence *= 0.85;
        }
      }
      return e;
    })
    .filter((e) => e.confidence >= 0.7)
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

  pendingCache.set(cacheKey, events);
  return events;
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
