import type { Event } from "@/types";
import { fetchEventbriteEvents } from "./eventbrite";
import { fetchTicketmasterEvents } from "./ticketmaster";
import { fetchSeatgeekEvents } from "./seatgeek";
import { discoverLocalEvents } from "./aiEventDiscovery";
import {
  EVENTBRITE_API_KEY,
  TICKETMASTER_API_KEY,
  SEATGEEK_CLIENT_ID,
  GEMINI_API_KEY,
} from "./constants";

function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/g, "")
    .trim();
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter[i - 1] !== longer[j - 1]) {
          newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  return 1 - costs[longer.length] / longer.length;
}

function coordsAreClose(a: Event, b: Event): boolean {
  const latA = a.venue?.lat;
  const lngA = a.venue?.lng;
  const latB = b.venue?.lat;
  const lngB = b.venue?.lng;
  if (!latA || !lngA || !latB || !lngB) return false;
  // ~500m radius
  return Math.abs(latA - latB) < 0.005 && Math.abs(lngA - lngB) < 0.005;
}

function timesOverlap(a: Event, b: Event): boolean {
  const startA = a.time_start;
  const startB = b.time_start;
  if (!startA || !startB) return true;
  const [hA, mA] = startA.split(":").map(Number);
  const [hB, mB] = startB.split(":").map(Number);
  return Math.abs((hA * 60 + mA) - (hB * 60 + mB)) <= 90;
}

function sameLocation(a: Event, b: Event): boolean {
  const venueA = normalizeForComparison(a.venue?.name ?? "");
  const venueB = normalizeForComparison(b.venue?.name ?? "");
  if (venueA && venueB && venueA === venueB) return true;
  if (venueA && venueB && (venueA.includes(venueB) || venueB.includes(venueA))) return true;
  if (venueA && venueB && levenshteinSimilarity(venueA, venueB) > 0.85) return true;
  return coordsAreClose(a, b);
}

function areSimilarEvents(a: Event, b: Event): boolean {
  if (a.event_date !== b.event_date) return false;

  // Same location + overlapping time → almost certainly the same event
  if (sameLocation(a, b) && timesOverlap(a, b)) return true;

  const titleA = normalizeForComparison(a.title);
  const titleB = normalizeForComparison(b.title);

  if (titleA === titleB) return true;
  if (titleA.includes(titleB) || titleB.includes(titleA)) return true;
  if (levenshteinSimilarity(titleA, titleB) > 0.8) return true;

  // Same coords with moderate title similarity
  if (coordsAreClose(a, b) && levenshteinSimilarity(titleA, titleB) > 0.6) {
    return true;
  }

  return false;
}

const SOURCE_PRIORITY: Record<string, number> = {
  api_ticketmaster: 4,
  api_eventbrite: 3,
  api_seatgeek: 2,
  ai_discovered: 1,
};

function deduplicateEvents(events: Event[]): Event[] {
  const result: Event[] = [];

  for (const event of events) {
    const duplicateIdx = result.findIndex((existing) =>
      areSimilarEvents(existing, event)
    );

    if (duplicateIdx === -1) {
      result.push(event);
    } else {
      const existing = result[duplicateIdx];
      const existingPriority = SOURCE_PRIORITY[existing.source_type] ?? 0;
      const newPriority = SOURCE_PRIORITY[event.source_type] ?? 0;

      if (newPriority > existingPriority) {
        result[duplicateIdx] = event;
      } else if (newPriority === existingPriority) {
        if (event.image_url && !existing.image_url) {
          result[duplicateIdx] = event;
        }
      }
    }
  }

  return result;
}

export async function fetchExternalEvents(city: string): Promise<Event[]> {
  const apiResults = await Promise.allSettled([
    fetchEventbriteEvents(city, EVENTBRITE_API_KEY),
    fetchTicketmasterEvents(city, TICKETMASTER_API_KEY),
    fetchSeatgeekEvents(city, SEATGEEK_CLIENT_ID),
  ]);

  const apiEvents: Event[] = [
    ...(apiResults[0].status === "fulfilled" ? apiResults[0].value : []),
    ...(apiResults[1].status === "fulfilled" ? apiResults[1].value : []),
    ...(apiResults[2].status === "fulfilled" ? apiResults[2].value : []),
  ];

  // AI Discovery runs in parallel but is non-blocking —
  // API results are returned immediately, AI results merged when ready
  let aiEvents: Event[] = [];
  if (GEMINI_API_KEY) {
    try {
      aiEvents = await discoverLocalEvents(city);
    } catch {
      console.warn("AI Discovery failed, continuing with API results");
    }
  }

  const allEvents = [...apiEvents, ...aiEvents];
  const deduplicated = deduplicateEvents(allEvents);

  return deduplicated.sort(
    (a, b) =>
      new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
}
