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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const TM_API_KEY = process.env.TICKETMASTER_API_KEY || process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

const CITY_TO_ENGLISH: Record<string, string> = {
  "München": "Munich", "Köln": "Cologne", "Nürnberg": "Nuremberg",
  "Hannover": "Hanover", "Braunschweig": "Brunswick",
};
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

async function discoverEventsForCity(city: string, today: string): Promise<any[]> {
  const prompt = `Du bist ein Event-Scout für die Stadt ${city} in Deutschland.
Suche nach lokalen Events, die in den nächsten 14 Tagen stattfinden (ab ${today}).
Fokussiere dich auf KLEINE, LOKALE Events: Themenabende, Bar-Events, Live-Musik, Flohmärkte, Comedy, Workshops, Sport-Events.
WICHTIG: Nur Events mit konkretem Datum, Uhrzeit und Ort.

Antwort als JSON-Array:
[{"title":"...","description":"...","date":"YYYY-MM-DD","time_start":"HH:MM","time_end":"HH:MM oder null","venue_name":"...","venue_address":"...","category":"nightlife|food_drink|concert|festival|sports|art|family|other","price_info":"...","source_url":"URL oder null","confidence":0.0-1.0}]

Nur Events mit confidence >= 0.6. Antworte NUR mit dem JSON-Array.`;

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("") ?? "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const events = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(events)) return [];

    const nextTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    return events.filter(
      (e: any) => e.title && e.date && e.time_start && e.venue_name
        && e.confidence >= 0.5
        && e.date >= today && e.date <= nextTwoWeeks
    );
  } catch {
    return [];
  }
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

  await refreshTicketmaster(result);
  await scanCitiesWithAi(result);
  await archivePastEvents(result);

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
