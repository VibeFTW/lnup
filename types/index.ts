export type UserRole = "admin" | "verified_organizer" | "verified_user" | "user";

export type RankId =
  | "newbie"
  | "explorer"
  | "regular"
  | "insider"
  | "party_planner"
  | "scene_master"
  | "big_fish"
  | "city_icon";

export type EventCategory =
  | "nightlife"
  | "food_drink"
  | "concert"
  | "festival"
  | "sports"
  | "art"
  | "family"
  | "other";

export type EventSourceType =
  | "api_eventbrite"
  | "api_ticketmaster"
  | "platform"
  | "verified_organizer"
  | "verified_user"
  | "community";

export type EventStatus = "active" | "flagged" | "removed" | "past";

export type PhotoStatus = "pending" | "approved" | "rejected";

export type ReportReason = "fake" | "wrong_info" | "spam" | "duplicate";

export type AttendanceStatus = "going" | "attended" | "cancelled";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  trust_score: number;
  rank: RankId;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  events_posted: number;
  events_confirmed: number;
  reports_count: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id: string | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  verified: boolean;
  owner_id: string | null;
  created_at: string;
}

export interface EventSeries {
  id: string;
  host_id: string;
  venue_id: string;
  title: string;
  recurrence: string;
  description: string;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  venue_id: string;
  venue?: Venue;
  series_id: string | null;
  event_date: string;
  time_start: string;
  time_end: string | null;
  category: EventCategory;
  price_info: string;
  source_type: EventSourceType;
  source_url: string | null;
  created_by: string | null;
  creator?: Profile;
  status: EventStatus;
  ai_confidence: number | null;
  image_url: string | null;
  created_at: string;
  saves_count: number;
  going_count: number;
  confirmations_count: number;
  photos_count: number;
  is_saved?: boolean;
  is_going?: boolean;
}

export interface EventPhoto {
  id: string;
  event_id: string;
  uploaded_by: string;
  uploader?: Profile;
  image_url: string;
  thumbnail_url: string;
  status: PhotoStatus;
  approved_by: string | null;
  created_at: string;
}

export interface EventSave {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
}

export interface EventConfirmation {
  id: string;
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  created_at: string;
}

export interface EventReport {
  id: string;
  event_id: string;
  reported_by: string;
  reason: ReportReason;
  details: string | null;
  created_at: string;
}

export interface Rank {
  id: RankId;
  label: string;
  icon: string;
  min_score: number;
  max_score: number;
  color: string;
}

export interface Category {
  id: EventCategory;
  label: string;
  icon: string;
  gradientStart: string;
  gradientEnd: string;
}

export type DateFilter = "heute" | "morgen" | "wochenende" | "woche" | "alle";
