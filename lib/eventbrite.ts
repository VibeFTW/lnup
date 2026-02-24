import type { Event, Venue } from "@/types";
import { mapEventbriteCategory } from "./categoryMapping";

interface EventbriteEvent {
  id: string;
  name: { text: string };
  description: { text: string };
  url: string;
  start: { local: string };
  end: { local: string } | null;
  is_free: boolean;
  venue?: {
    id: string;
    name: string;
    address: {
      localized_address_display: string;
      latitude: string;
      longitude: string;
    };
  };
  category_id: string | null;
  logo?: { url: string } | null;
}

interface EventbriteResponse {
  events: EventbriteEvent[];
  pagination: { page_count: number };
}

export async function fetchEventbriteEvents(
  city: string,
  apiKey: string
): Promise<Event[]> {
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      "location.address": `${city}, Germany`,
      expand: "venue",
      "start_date.keyword": "this_week",
      page: "1",
    });

    const response = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?${params}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!response.ok) {
      console.warn(`Eventbrite API error: ${response.status}`);
      return [];
    }

    const data: EventbriteResponse = await response.json();

    return data.events.map((eb): Event => {
      const startDate = eb.start.local.split("T")[0];
      const startTime = eb.start.local.split("T")[1]?.substring(0, 5) ?? "00:00";
      const endTime = eb.end?.local.split("T")[1]?.substring(0, 5) ?? null;

      const venue: Venue | undefined = eb.venue
        ? {
            id: `eb-venue-${eb.venue.id}`,
            name: eb.venue.name,
            address: eb.venue.address.localized_address_display,
            city,
            lat: parseFloat(eb.venue.address.latitude) || 0,
            lng: parseFloat(eb.venue.address.longitude) || 0,
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
        id: `eb-${eb.id}`,
        title: eb.name.text,
        description: eb.description.text?.substring(0, 300) ?? "",
        venue_id: venue?.id ?? "",
        venue,
        series_id: null,
        event_date: startDate,
        time_start: startTime,
        time_end: endTime,
        category: mapEventbriteCategory(eb.category_id),
        price_info: eb.is_free ? "Kostenlos" : "Siehe Eventbrite",
        source_type: "api_eventbrite",
        source_url: eb.url,
        created_by: null,
        status: "active",
        ai_confidence: 0.95,
        image_url: eb.logo?.url ?? null,
        created_at: new Date().toISOString(),
        saves_count: 0,
        going_count: 0,
        confirmations_count: 0,
        photos_count: 0,
      };
    });
  } catch (error) {
    console.warn("Eventbrite fetch failed:", error);
    return [];
  }
}
