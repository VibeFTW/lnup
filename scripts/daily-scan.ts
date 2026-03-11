/**
 * LNUP Daily Scan Script
 *
 * Run manually: npx tsx scripts/daily-scan.ts
 * Or via GitHub Actions on a cron schedule.
 *
 * Environment variables required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   TICKETMASTER_API_KEY, GEMINI_API_KEY (optional)
 */

import { geminiRequest, parseJsonArray } from "../lib/geminiClient";
import { getSourcesForCity } from "../lib/eventSources";
import { stripHtmlToText } from "../lib/fetchProxy";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const TM_API_KEY = process.env.TICKETMASTER_API_KEY || process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

const CITY_TO_GERMAN: Record<string, string> = {
  "Munich": "München", "Cologne": "Köln", "Nuremberg": "Nürnberg",
  "Hanover": "Hannover", "Brunswick": "Braunschweig",
};

interface ScanResult {
  tmEventsFound: number;
  tmEventsPersisted: number;
  aiEventsFound: number;
  aiEventsPersisted: number;
  archivedCount: number;
  errors: string[];
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.method === "POST" ? "return=representation" : "return=minimal",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Step 1: Ticketmaster refresh
async function refreshTicketmaster(result: ScanResult) {
  if (!TM_API_KEY) {
    console.log("Skipping TM refresh: no API key");
    return;
  }

  console.log("--- Ticketmaster Refresh ---");

  const existingEvents = await supabaseRequest(
    "events?select=title,event_date&source_type=eq.api_ticketmaster&limit=3000"
  );
  const existingSet = new Set(
    (existingEvents || []).map((e: any) => `${e.title}|${e.event_date}`)
  );

  let page = 0;
  const maxPages = 5;
  const seenKeys = new Set<string>();

  while (page < maxPages) {
    const url = `${TM_BASE}?countryCode=DE&size=200&page=${page}&sort=date,asc&apikey=${TM_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      result.errors.push(`TM page ${page}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const events = data?._embedded?.events || [];
    if (events.length === 0) break;

    result.tmEventsFound += events.length;

    for (const tm of events) {
      try {
        if (tm.dates?.status?.code === "cancelled") continue;

        const title = tm.name;
        const eventDate = tm.dates?.start?.localDate;
        if (!title || !eventDate) continue;

        const dedupKey = `${title}|${eventDate}`;
        if (seenKeys.has(dedupKey) || existingSet.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        const tmVenue = tm._embedded?.venues?.[0];
        const tmCityName = tmVenue?.city?.name ?? "";
        const germanCity = CITY_TO_GERMAN[tmCityName] ?? tmCityName;

        let venueId: string | null = null;
        if (tmVenue?.name) {
          const venues = await supabaseRequest(
            `venues?select=id&name=eq.${encodeURIComponent(tmVenue.name)}&limit=1`
          );
          if (venues && venues.length > 0) {
            venueId = venues[0].id;
          } else {
            const newVenue = await supabaseRequest("venues?select=id", {
              method: "POST",
              body: JSON.stringify({
                name: tmVenue.name,
                address: tmVenue.address?.line1 || "",
                city: germanCity || "Deutschland",
                lat: parseFloat(tmVenue.location?.latitude ?? "0"),
                lng: parseFloat(tmVenue.location?.longitude ?? "0"),
              }),
            });
            venueId = newVenue?.[0]?.id ?? null;
          }
        }

        const bestImage = (tm.images || [])
          .filter((img: any) => !img.fallback && img.ratio === "16_9" && img.width >= 500)
          .sort((a: any, b: any) => b.width - a.width)[0];

        const category = mapTmSegment(tm.classifications?.[0]?.segment?.name);

        await supabaseRequest("events", {
          method: "POST",
          body: JSON.stringify({
            title,
            description: (tm.description ?? tm.info ?? "").substring(0, 500),
            venue_id: venueId,
            event_date: eventDate,
            time_start: tm.dates?.start?.localTime?.substring(0, 5) || "20:00",
            time_end: tm.dates?.end?.localTime?.substring(0, 5) || null,
            category,
            price_info: tm.priceRanges
              ? `${tm.priceRanges[0]?.min ?? ""}–${tm.priceRanges[0]?.max ?? ""}€`
              : "Siehe Ticketmaster",
            source_type: "api_ticketmaster",
            source_url: tm.url,
            status: "active",
            image_url: bestImage?.url || null,
          }),
        });

        result.tmEventsPersisted++;

        if (germanCity) {
          await supabaseRequest("cities", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({ name: germanCity, lat: 0, lng: 0 }),
          }).catch(() => {});
        }
      } catch {
        // skip individual event errors
      }
    }

    const totalPages = data?.page?.totalPages ?? 1;
    page++;
    if (page >= totalPages) break;

    await delay(300);
  }

  console.log(`  Found: ${result.tmEventsFound}, Persisted: ${result.tmEventsPersisted}`);
}

// Step 2: AI city scan
async function scanCitiesWithAi(result: ScanResult) {
  if (!GEMINI_API_KEY) {
    console.log("Skipping AI scan: no GEMINI_API_KEY");
    return;
  }

  console.log("--- AI City Scan ---");

  const cities = await supabaseRequest("cities?select=name&scan_enabled=eq.true");
  if (!cities || cities.length === 0) {
    console.log("  No scan-enabled cities found");
    return;
  }

  const existingEvents = await supabaseRequest(
    "events?select=title,event_date&source_type=in.(ai_discovered,ai_scraped)&limit=2000"
  );
  const existingSet = new Set(
    (existingEvents || []).map((e: any) => `${e.title}|${e.event_date}`)
  );

  const today = new Date().toISOString().split("T")[0];

  for (const city of cities) {
    console.log(`  Scanning: ${city.name}`);
    try {
      const events = await discoverEventsForCity(city.name, today);
      result.aiEventsFound += events.length;

      for (const event of events) {
        const dedupKey = `${event.title}|${event.date}`;
        if (existingSet.has(dedupKey)) continue;
        existingSet.add(dedupKey);

        let venueId: string | null = null;
        if (event.venue_name) {
          const venues = await supabaseRequest(
            `venues?select=id&name=eq.${encodeURIComponent(event.venue_name)}&limit=1`
          );
          if (venues && venues.length > 0) {
            venueId = venues[0].id;
          } else {
            const newVenue = await supabaseRequest("venues?select=id", {
              method: "POST",
              body: JSON.stringify({
                name: event.venue_name,
                address: event.venue_address || city.name,
                city: city.name,
                lat: 0,
                lng: 0,
              }),
            });
            venueId = newVenue?.[0]?.id ?? null;
          }
        }

        await supabaseRequest("events", {
          method: "POST",
          body: JSON.stringify({
            title: event.title,
            description: (event.description || "").substring(0, 300),
            venue_id: venueId,
            event_date: event.date,
            time_start: event.time_start,
            time_end: event.time_end || null,
            category: event.category || "other",
            price_info: event.price_info || null,
            source_type: "ai_discovered",
            source_url: event.source_url || null,
            status: "active",
            ai_confidence: event.confidence,
          }),
        });
        result.aiEventsPersisted++;
      }
      await supabaseRequest(
        `cities?name=eq.${encodeURIComponent(city.name)}`,
        { method: "PATCH", body: JSON.stringify({ last_scanned: new Date().toISOString() }) }
      ).catch(() => {});
    } catch (err: any) {
      const msg = `AI scan ${city.name}: ${err.message}`;
      console.warn(`  ${msg}`);
      result.errors.push(msg);
      if (err.message?.includes("429")) {
        console.warn("  Rate limit hit, stopping AI scan");
        break;
      }
    }

    await delay(1000);
  }

  console.log(`  AI Found: ${result.aiEventsFound}, Persisted: ${result.aiEventsPersisted}`);
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

async function fetchPageDirect(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LNUP-Bot/1.0", Accept: "text/html" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 50) return null;
    return stripHtmlToText(html).substring(0, 20000);
  } catch {
    return null;
  }
}

async function discoverEventsForCity(city: string, today: string): Promise<any[]> {
  const now = new Date();
  const weekday = WEEKDAYS[now.getDay()];
  const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const sources = getSourcesForCity(city);

  // Scrape-first: Quellen-URLs direkt laden (kein CORS auf Server)
  let combinedContent = "";
  if (sources.websites.length > 0) {
    console.log(`    Loading ${sources.websites.length} source URLs...`);
    for (const url of sources.websites) {
      const content = await fetchPageDirect(url);
      if (content && content.length > 100) {
        combinedContent += `\n\n=== QUELLE: ${url} ===\n${content}`;
        console.log(`    Loaded: ${url} (${content.length} chars)`);
      } else {
        console.log(`    Failed: ${url}`);
      }
      await delay(500);
    }
  }

  if (combinedContent.length > 500) {
    // Scrape-Modus: Konkreten Seiteninhalt auswerten (ohne google_search)
    const { text } = await geminiRequest({
      apiKey: GEMINI_API_KEY,
      contents: [{
        parts: [
          {
            text: `Analysiere den folgenden Seiteninhalt aus ${city} und extrahiere ALLE Events/Veranstaltungen die zwischen ${today} (${weekday}) und ${endDate} stattfinden.

Extrahiere NUR Events die im Text tatsächlich erwähnt werden. Erfinde NICHTS.
Wenn keine Uhrzeit angegeben: nutze "20:00". source_url = die URL der Quelle.

Antwort als JSON-Array:
[{"title":"...","description":"max 200 Zeichen","date":"YYYY-MM-DD","time_start":"HH:MM","time_end":null,"venue_name":"...","venue_address":"...","category":"nightlife|food_drink|concert|festival|sports|art|family|other","price_info":"...","source_url":"...","confidence":0.0-1.0}]

Leeres Array [] wenn keine Events gefunden.`,
          },
          { text: combinedContent.substring(0, 50000) },
        ],
      }],
      temperature: 0.1,
      maxOutputTokens: 8192,
    });

    const events = parseJsonArray<any>(text);
    const filtered = events.filter(
      (e: any) => e.title && e.date && e.venue_name && e.date >= today && e.date <= endDate
    );
    if (filtered.length > 0) return filtered;
  }

  // Fallback: google_search
  console.log(`    Falling back to google_search for ${city}`);
  const { text } = await geminiRequest({
    apiKey: GEMINI_API_KEY,
    systemInstruction: {
      parts: [{
        text: `Du bist ein Event-Scout für ${city}. Finde ECHTE Events zwischen ${today} (${weekday}) und ${endDate}.
Erfinde NIEMALS Events. Jedes Event MUSS eine echte source_url haben. Confidence >= 0.7.
KATEGORIEN: nightlife, food_drink, concert, festival, sports, art, family, other
Antworte NUR mit einem JSON-Array.`,
      }],
    },
    contents: [{
      parts: [{
        text: `Suche nach Events in ${city}. Antwort als JSON-Array:
[{"title":"...","description":"...","date":"YYYY-MM-DD","time_start":"HH:MM","time_end":null,"venue_name":"...","venue_address":"...","category":"...","price_info":"...","source_url":"...","confidence":0.0-1.0}]
Leeres Array [] wenn nichts gefunden.`,
      }],
    }],
    tools: [{ google_search: {} }],
    temperature: 0.2,
    maxOutputTokens: 8192,
  });

  const events = parseJsonArray<any>(text);
  return events.filter(
    (e: any) => e.title && e.date && e.venue_name
      && e.date >= today && e.date <= endDate
  );
}

// Step 3: Archive past events
async function archivePastEvents(result: ScanResult) {
  console.log("--- Archive Past Events ---");
  try {
    const data = await supabaseRequest("rpc/archive_past_events", {
      method: "POST",
      body: "{}",
    });
    result.archivedCount = data ?? 0;
    console.log(`  Archived: ${result.archivedCount} events`);
  } catch (err: any) {
    console.warn(`  Archive RPC failed: ${err.message}`);
    // Fallback: direct update
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];
      await supabaseRequest(
        `events?status=eq.active&event_date=lt.${yesterday}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "past" }),
        }
      );
      console.log("  Archived via fallback PATCH");
    } catch (e2: any) {
      result.errors.push(`Archive failed: ${e2.message}`);
    }
  }
}

// Helpers
function mapTmSegment(segment?: string): string {
  const map: Record<string, string> = {
    "Music": "concert", "Sports": "sports", "Arts & Theatre": "art",
    "Film": "art", "Miscellaneous": "other", "Undefined": "other",
  };
  return map[segment ?? ""] ?? "other";
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Main
async function main() {
  console.log(`\n=== LNUP Daily Scan - ${new Date().toISOString()} ===\n`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const result: ScanResult = {
    tmEventsFound: 0,
    tmEventsPersisted: 0,
    aiEventsFound: 0,
    aiEventsPersisted: 0,
    archivedCount: 0,
    errors: [],
  };

  try { await refreshTicketmaster(result); } catch (e: any) {
    console.error("TM refresh failed:", e.message);
    result.errors.push(`TM refresh: ${e.message}`);
  }
  try { await scanCitiesWithAi(result); } catch (e: any) {
    console.error("AI scan failed:", e.message);
    result.errors.push(`AI scan: ${e.message}`);
  }
  try { await archivePastEvents(result); } catch (e: any) {
    console.error("Archive failed:", e.message);
    result.errors.push(`Archive: ${e.message}`);
  }

  console.log("\n=== Scan Complete ===");
  console.log(`  TM: ${result.tmEventsPersisted}/${result.tmEventsFound} persisted`);
  console.log(`  AI: ${result.aiEventsPersisted}/${result.aiEventsFound} persisted`);
  console.log(`  Archived: ${result.archivedCount}`);
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`);
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
