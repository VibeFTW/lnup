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
  page: { totalElements: number };
}

export async function fetchTicketmasterEvents(
  city: string,
  apiKey: string
): Promise<Event[]> {
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      city,
      countryCode: "DE",
      size: "20",
      sort: "date,asc",
      apikey: apiKey,
    });

    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`
    );

    if (!response.ok) {
      console.warn(`Ticketmaster API error: ${response.status}`);
      return [];
    }

    const data: TMResponse = await response.json();
    const tmEvents = data._embedded?.events ?? [];

    return tmEvents.map((tm): Event => {
      const tmVenue = tm._embedded?.venues?.[0];
      const segmentName = tm.classifications?.[0]?.segment?.name ?? null;
      const genreName = tm.classifications?.[0]?.genre?.name ?? null;

      const bestImage = tm.images
        ?.sort((a, b) => b.width - a.width)
        ?.[0]?.url ?? null;

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

      const venue: Venue | undefined = tmVenue
        ? {
            id: `tm-venue-${tmVenue.id}`,
            name: tmVenue.name,
            address: [tmVenue.address?.line1, tmVenue.city?.name]
              .filter(Boolean)
              .join(", "),
            city: tmVenue.city?.name ?? city,
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
