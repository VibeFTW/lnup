import type { Event, Venue } from "@/types";
import { mapTicketmasterSegment } from "./categoryMapping";

interface TMEvent {
  id: string;
  name: string;
  url: string;
  info?: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
    };
    end?: {
      localTime?: string;
    };
    status?: { code: string };
  };
  priceRanges?: { min: number; max: number; currency: string }[];
  images?: { url: string; width: number; height: number }[];
  classifications?: {
    segment?: { name: string };
    genre?: { name: string };
  }[];
  _embedded?: {
    venues?: {
      id: string;
      name: string;
      address?: { line1: string };
      city?: { name: string };
      state?: { name: string };
      country?: { countryCode: string };
      location?: { latitude: string; longitude: string };
    }[];
  };
}

interface TMResponse {
  _embedded?: { events: TMEvent[] };
  page: { totalElements: number; totalPages: number; number: number; size: number };
}

const CITY_TO_ENGLISH: Record<string, string> = {
  "München": "Munich",
  "Nürnberg": "Nuremberg",
  "Köln": "Cologne",
  "Braunschweig": "Brunswick",
  "Hannover": "Hanover",
};

const CITY_TO_GERMAN: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_TO_ENGLISH).map(([de, en]) => [en, de])
);

export async function fetchTicketmasterEvents(
  city: string,
  apiKey: string
): Promise<Event[]> {
  if (!apiKey) return [];

  try {
    const allTmEvents: TMEvent[] = [];
    const pageSize = 200;
    const maxPages = city ? 3 : 10;
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < maxPages) {
      const params = new URLSearchParams({
        countryCode: "DE",
        size: String(pageSize),
        page: String(page),
        sort: "date,asc",
        apikey: apiKey,
      });

      if (city) {
        params.set("city", CITY_TO_ENGLISH[city] ?? city);
      }

      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?${params}`
      );

      if (!response.ok) {
        console.warn(`Ticketmaster API error: ${response.status}`);
        break;
      }

      const data: TMResponse = await response.json();
      const pageEvents = data._embedded?.events ?? [];
      allTmEvents.push(...pageEvents);
      totalPages = data.page.totalPages;
      page++;
    }

    return allTmEvents
      .filter((tm) => tm.dates.status?.code !== "cancelled")
      .map((tm): Event => {
        const tmVenue = tm._embedded?.venues?.[0];
        const segmentName = tm.classifications?.[0]?.segment?.name ?? null;
        const genreName = tm.classifications?.[0]?.genre?.name ?? null;

        const bestImage = tm.images
          ?.filter((img) => img.width >= 500 && img.width <= 1200)
          ?.sort((a, b) => b.width - a.width)
          ?.[0]?.url
          ?? tm.images?.sort((a, b) => b.width - a.width)?.[0]?.url
          ?? null;

        let priceInfo = "";
        if (tm.priceRanges?.length) {
          const range = tm.priceRanges[0];
          if (range.min === 0) {
            priceInfo = "Kostenlos";
          } else if (range.min === range.max) {
            priceInfo = `${range.min}${range.currency === "EUR" ? "€" : range.currency}`;
          } else {
            priceInfo = `${range.min}–${range.max}${range.currency === "EUR" ? "€" : range.currency}`;
          }
        }

        const tmCityName = tmVenue?.city?.name ?? "";
        const germanCity = CITY_TO_GERMAN[tmCityName] ?? tmCityName;

        const venue: Venue | undefined = tmVenue
          ? {
              id: `tm-venue-${tmVenue.id}`,
              name: tmVenue.name,
              address: [tmVenue.address?.line1, germanCity].filter(Boolean).join(", "),
              city: germanCity || city,
              lat: parseFloat(tmVenue.location?.latitude ?? "0"),
              lng: parseFloat(tmVenue.location?.longitude ?? "0"),
              google_place_id: null,
              website: null,
              instagram: null,
              phone: null,
              verified: false,
              owner_id: null,
              created_at: new Date().toISOString(),
            }
          : undefined;

        return {
          id: `tm-${tm.id}`,
          title: tm.name,
          description: tm.info?.substring(0, 300) ?? "",
          venue_id: venue?.id ?? "",
          venue,
          series_id: null,
          event_date: tm.dates.start.localDate,
          time_start: tm.dates.start.localTime?.substring(0, 5) ?? "20:00",
          time_end: tm.dates.end?.localTime?.substring(0, 5) ?? null,
          category: mapTicketmasterSegment(segmentName, genreName),
          price_info: priceInfo || "Siehe Ticketmaster",
          source_type: "api_ticketmaster",
          source_url: tm.url,
          created_by: null,
          status: "active",
          ai_confidence: 0.95,
          image_url: bestImage,
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
  } catch (error) {
    console.warn("Ticketmaster fetch failed:", error);
    return [];
  }
}
