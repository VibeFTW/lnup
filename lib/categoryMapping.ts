import type { EventCategory } from "@/types";

const EVENTBRITE_CATEGORY_MAP: Record<string, EventCategory> = {
  "103": "concert",      // Music
  "104": "art",           // Film & Media
  "105": "art",           // Performing & Visual Arts
  "106": "other",         // Fashion
  "107": "other",         // Health
  "108": "sports",        // Sports & Fitness
  "109": "other",         // Travel & Outdoor
  "110": "food_drink",    // Food & Drink
  "111": "other",         // Charity & Causes
  "112": "other",         // Government & Politics
  "113": "other",         // Community & Culture
  "114": "other",         // Religion & Spirituality
  "115": "family",        // Family & Education
  "116": "other",         // Seasonal & Holiday
  "117": "other",         // Business & Professional
  "118": "other",         // Science & Technology
  "119": "nightlife",     // Nightlife (custom/rare)
  "199": "other",         // Other
};

const TICKETMASTER_SEGMENT_MAP: Record<string, EventCategory> = {
  "Music": "concert",
  "Sports": "sports",
  "Arts & Theatre": "art",
  "Film": "art",
  "Miscellaneous": "other",
  "Undefined": "other",
};

const TICKETMASTER_GENRE_MAP: Record<string, EventCategory> = {
  "Club": "nightlife",
  "Dance/Electronic": "nightlife",
  "DJ": "nightlife",
  "Rock": "concert",
  "Pop": "concert",
  "Hip-Hop/Rap": "concert",
  "R&B": "concert",
  "Jazz": "concert",
  "Classical": "concert",
  "Metal": "concert",
  "Alternative": "concert",
  "Folk": "concert",
  "Country": "concert",
  "Latin": "concert",
  "Reggae": "concert",
  "Blues": "concert",
  "World": "concert",
  "Comedy": "art",
  "Theatre": "art",
  "Opera": "art",
  "Dance": "art",
  "Circus & Specialty Acts": "family",
  "Fairs & Festivals": "festival",
  "Festival": "festival",
  "Food & Drink": "food_drink",
  "Family": "family",
  "Soccer": "sports",
  "Football": "sports",
  "Basketball": "sports",
  "Ice Hockey": "sports",
  "Tennis": "sports",
  "Boxing": "sports",
  "Motorsports/Racing": "sports",
};

const SEATGEEK_TYPE_MAP: Record<string, EventCategory> = {
  "concert": "concert",
  "music_festival": "festival",
  "theater": "art",
  "comedy": "art",
  "dance_performance_tour": "art",
  "classical": "concert",
  "opera": "art",
  "literary": "art",
  "film": "art",
  "circus": "family",
  "family": "family",
  "sports": "sports",
  "soccer": "sports",
  "football": "sports",
  "basketball": "sports",
  "ice_hockey": "sports",
  "tennis": "sports",
  "baseball": "sports",
  "golf": "sports",
  "boxing": "sports",
  "mma": "sports",
  "wrestling": "sports",
  "motorsports": "sports",
  "minor_league_sports": "sports",
  "nfl": "sports",
  "nba": "sports",
  "mlb": "sports",
  "nhl": "sports",
  "ncaa_football": "sports",
  "ncaa_basketball": "sports",
  "food_and_drink": "food_drink",
  "nightlife": "nightlife",
  "club": "nightlife",
  "festival": "festival",
};

export function mapSeatgeekType(typeName: string | null | undefined): EventCategory {
  if (!typeName) return "other";
  const normalized = typeName.toLowerCase().replace(/[\s-]/g, "_");
  return SEATGEEK_TYPE_MAP[normalized] ?? "other";
}

export function mapEventbriteCategory(categoryId: string | null | undefined): EventCategory {
  if (!categoryId) return "other";
  return EVENTBRITE_CATEGORY_MAP[categoryId] ?? "other";
}

export function mapTicketmasterSegment(
  segmentName: string | null | undefined,
  genreName: string | null | undefined
): EventCategory {
  if (genreName && TICKETMASTER_GENRE_MAP[genreName]) {
    return TICKETMASTER_GENRE_MAP[genreName];
  }
  if (segmentName && TICKETMASTER_SEGMENT_MAP[segmentName]) {
    return TICKETMASTER_SEGMENT_MAP[segmentName];
  }
  return "other";
}
