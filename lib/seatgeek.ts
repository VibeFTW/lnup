import type { Event, Venue } from "@/types";
import { mapSeatgeekType } from "./categoryMapping";

interface SGPerformer {
  name: string;
  type: string;
  image?: string;
}

interface SGVenue {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: { lat: number; lon: number };
}

interface SGEvent {
  id: number;
  title: string;
  short_title?: string;
  description?: string;
  url: string;
  type: string;
  taxonomy?: { name: string }[];
  datetime_local: string;
  datetime_utc: string;
  venue: SGVenue;
  performers?: SGPerformer[];
  stats?: {
    lowest_price?: number;
    highest_price?: number;
    average_price?: number;
  };
}

interface SGResponse {
  events: SGEvent[];
  meta: { total: number; page: number; per_page: number };
}

export async function fetchSeatgeekEvents(
  city: string,
  clientId: string
): Promise<Event[]> {
  if (!clientId) return [];

  try {
    const params = new URLSearchParams({
      "venue.city": city,
      "venue.country": "DE",
      per_page: "20",
      sort: "datetime_local.asc",
      "datetime_local.gte": new Date().toISOString().split("T")[0],
      client_id: clientId,
    });

    const response = await fetch(
      `https://api.seatgeek.com/2/events?${params}`
    );

    if (!response.ok) {
      console.warn(`SeatGeek API error: ${response.status}`);
      return [];
    }

    const data: SGResponse = await response.json();

    return data.events.map((sg): Event => {
      const startDate = sg.datetime_local.split("T")[0];
      const startTime =
        sg.datetime_local.split("T")[1]?.substring(0, 5) ?? "20:00";

      const bestImage =
        sg.performers?.find((p) => p.image)?.image ?? null;

      let priceInfo = "";
      if (sg.stats?.lowest_price != null) {
        if (sg.stats.lowest_price === 0) {
          priceInfo = "Kostenlos";
        } else if (
          sg.stats.highest_price &&
          sg.stats.lowest_price !== sg.stats.highest_price
        ) {
          priceInfo = `${sg.stats.lowest_price}–${sg.stats.highest_price}€`;
        } else {
          priceInfo = `${sg.stats.lowest_price}€`;
        }
      }

      const venue: Venue = {
        id: `sg-venue-${sg.venue.id}`,
        name: sg.venue.name,
        address: [sg.venue.address, sg.venue.city].filter(Boolean).join(", "),
        city: sg.venue.city ?? city,
        lat: sg.venue.location?.lat ?? 0,
        lng: sg.venue.location?.lon ?? 0,
        google_place_id: null,
        website: null,
        instagram: null,
        phone: null,
        verified: false,
        owner_id: null,
        created_at: new Date().toISOString(),
      };

      const taxonomyType = sg.taxonomy?.[0]?.name ?? sg.type;

      return {
        id: `sg-${sg.id}`,
        title: sg.title,
        description: sg.description?.substring(0, 300) ?? "",
        venue_id: venue.id,
        venue,
        series_id: null,
        event_date: startDate,
        time_start: startTime,
        time_end: null,
        category: mapSeatgeekType(taxonomyType),
        price_info: priceInfo || "Siehe SeatGeek",
        source_type: "api_seatgeek",
        source_url: sg.url,
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
    console.warn("SeatGeek fetch failed:", error);
    return [];
  }
}
