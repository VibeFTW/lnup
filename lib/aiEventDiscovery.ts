import type { Event, EventCategory, Venue } from "@/types";
import { GEMINI_API_KEY } from "./constants";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

const SEARCH_QUERIES = [
  "{city} events diese woche restaurant bar",
  "{city} veranstaltungen lokal gastronomie",
  "{city} pub quiz karaoke comedy abend",
  "{city} food event themenabend restaurant",
  "{city} live musik kneipe bar club",
  "{city} flohmarkt markt straßenfest",
  "{city} workshop kurs kreativ abend",
];

const DISCOVERY_PROMPT = `Du bist ein Event-Scout für die Stadt {city} in Deutschland.
Suche im Internet nach lokalen Events, die in den nächsten 7 Tagen stattfinden.

Fokussiere dich auf KLEINE, LOKALE Events die NICHT auf großen Plattformen (Ticketmaster, Eventbrite) zu finden sind:
- Themenabende in Restaurants (z.B. "Mexican Night", "Burger Special", "Weinprobe")
- Bar-Events (Pub Quiz, Karaoke, Open Mic, DJ-Abende)
- Lokale Live-Musik in Kneipen/Bars
- Food-Trucks, Street-Food-Märkte
- Flohmärkte, Kunstmärkte, Handwerkermärkte
- Comedy-Abende, Poetry Slams
- Workshops, Kurse, Kreativabende
- Vereinsevents, lokale Feste
- Sport-Events (Laufgruppen, Yoga im Park)

WICHTIG: Nur Events mit konkretem Datum, Uhrzeit und Ort. Keine generischen Angebote.
Heute ist ${new Date().toISOString().split("T")[0]}.

Antwort als JSON-Array. Jedes Event:
{
  "title": "Name des Events",
  "description": "Kurze Beschreibung, max 200 Zeichen",
  "date": "YYYY-MM-DD",
  "time_start": "HH:MM",
  "time_end": "HH:MM oder null",
  "venue_name": "Name der Location",
  "venue_address": "Adresse",
  "city": "${"{city}"}",
  "category": "nightlife|food_drink|concert|festival|sports|art|family|other",
  "price_info": "z.B. 10€, Kostenlos, Ab 5€",
  "source_url": "URL der Quelle wenn verfügbar, sonst null",
  "confidence": 0.0-1.0
}

Nur Events mit confidence >= 0.6 zurückgeben.
Antworte NUR mit dem JSON-Array, kein anderer Text.
Leeres Array [] wenn nichts gefunden.`;

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

export async function discoverLocalEvents(city: string): Promise<Event[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API-Key fehlt. Bitte in .env konfigurieren.");
  }

  const searchQueries = SEARCH_QUERIES.map((q) =>
    q.replace("{city}", city)
  );

  const prompt = DISCOVERY_PROMPT.replace(/\{city\}/g, city);

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          {
            text: `Suchbegriffe für die Recherche:\n${searchQueries.join("\n")}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    });

    if (response.ok) break;

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`Gemini 429 rate limit, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const body = await response.text().catch(() => "");
    console.warn(`Gemini API error ${response.status}:`, body);

    if (response.status === 429) {
      throw new Error("Rate-Limit erreicht. Bitte warte eine Minute und versuche es erneut.");
    }
    throw new Error(`Gemini API Fehler (${response.status})`);
  }

  const result = await (response as Response).json();
  const text =
    result?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("") ?? "";

  if (!text) {
    throw new Error("Gemini hat keine Antwort zurückgegeben.");
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("AI Discovery: No JSON array in response:", text.substring(0, 200));
    return [];
  }

  let discovered: DiscoveredEvent[];
  try {
    discovered = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn("AI Discovery: Failed to parse JSON:", jsonMatch[0].substring(0, 200));
    throw new Error("KI-Antwort konnte nicht verarbeitet werden.");
  }

  if (!Array.isArray(discovered)) return [];

  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return discovered
    .filter(
      (e) =>
        e.title &&
        e.date &&
        e.time_start &&
        e.venue_name &&
        e.confidence >= 0.5 &&
        e.date >= today &&
        e.date <= nextWeek
    )
    .map((e, i): Event => {
      const venue: Venue = {
        id: `ai-venue-${city}-${i}-${Date.now()}`,
        name: e.venue_name,
        address: e.venue_address || e.city,
        city: e.city || city,
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
