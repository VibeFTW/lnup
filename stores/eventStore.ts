import { create } from "zustand";
import type { Event, EventPhoto } from "@/types";
import { supabase } from "@/lib/supabase";
import { fetchExternalEvents } from "@/lib/eventApis";
import { EVENTBRITE_API_KEY, TICKETMASTER_API_KEY } from "@/lib/constants";
import { getRankForScore } from "@/lib/ranks";

interface EventState {
  events: Event[];
  photos: EventPhoto[];
  savedEventIds: Set<string>;
  goingEventIds: Set<string>;
  isLoading: boolean;
  fetchEvents: (city?: string) => Promise<void>;
  toggleSave: (eventId: string) => void;
  toggleGoing: (eventId: string) => void;
  confirmAttended: (eventId: string) => void;
  mergeExternalEvents: (externalEvents: Event[]) => void;
  getEventById: (id: string) => Event | undefined;
  getSavedEvents: () => Event[];
  getEventsByCreator: (userId: string) => Event[];
  getPhotosForEvent: (eventId: string) => EventPhoto[];
  getPendingPhotosForEvent: (eventId: string) => EventPhoto[];
  uploadPhoto: (eventId: string, imageUri: string, userId: string) => void;
  moderatePhoto: (photoId: string, approved: boolean) => void;
}

function mapRowToEvent(row: any, savedIds?: Set<string>, goingIds?: Set<string>): Event {
  const venue = row.venues
    ? {
        id: row.venues.id,
        name: row.venues.name,
        address: row.venues.address,
        city: row.venues.city ?? "",
        lat: row.venues.lat,
        lng: row.venues.lng,
        google_place_id: row.venues.google_place_id,
        website: row.venues.website,
        instagram: row.venues.instagram,
        phone: row.venues.phone,
        verified: row.venues.verified,
        owner_id: row.venues.owner_id,
        created_at: row.venues.created_at,
      }
    : undefined;

  const creator = row.profiles
    ? {
        id: row.profiles.id,
        username: row.profiles.username,
        display_name: row.profiles.display_name,
        avatar_url: row.profiles.avatar_url,
        role: row.profiles.role,
        trust_score: row.profiles.trust_score,
        rank: getRankForScore(row.profiles.trust_score).id,
        email_verified: row.profiles.email_verified,
        phone_verified: row.profiles.phone_verified,
        created_at: row.profiles.created_at,
        events_posted: 0,
        events_confirmed: 0,
        reports_count: 0,
      }
    : undefined;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    venue_id: row.venue_id,
    venue,
    series_id: row.series_id,
    event_date: row.event_date,
    time_start: row.time_start,
    time_end: row.time_end,
    category: row.category,
    price_info: row.price_info ?? "",
    source_type: row.source_type,
    source_url: row.source_url,
    created_by: row.created_by,
    creator,
    status: row.status,
    ai_confidence: row.ai_confidence,
    image_url: row.image_url,
    created_at: row.created_at,
    saves_count: row.saves_count ?? 0,
    going_count: row.going_count ?? 0,
    confirmations_count: row.confirmations_count ?? 0,
    photos_count: row.photos_count ?? 0,
    is_saved: savedIds?.has(row.id) ?? false,
    is_going: goingIds?.has(row.id) ?? false,
  };
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  photos: [],
  savedEventIds: new Set<string>(),
  goingEventIds: new Set<string>(),
  isLoading: false,

  fetchEvents: async (city?: string) => {
    set({ isLoading: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      let savedIds = new Set<string>();
      let goingIds = new Set<string>();

      if (userId) {
        const [savesRes, goingRes] = await Promise.all([
          supabase.from("event_saves").select("event_id").eq("user_id", userId),
          supabase
            .from("event_confirmations")
            .select("event_id")
            .eq("user_id", userId)
            .eq("status", "going"),
        ]);
        savedIds = new Set((savesRes.data ?? []).map((s: any) => s.event_id));
        goingIds = new Set((goingRes.data ?? []).map((g: any) => g.event_id));
      }

      let query = supabase
        .from("events_with_counts")
        .select("*, venues(*), profiles:created_by(*)");

      if (city) {
        query = query.eq("venues.city", city);
      }

      const { data: rows, error } = await query
        .in("status", ["active", "past"])
        .order("event_date", { ascending: true });

      if (error) {
        console.warn("Supabase event fetch error:", error.message);
        set({ isLoading: false });
        return;
      }

      const events = (rows ?? []).map((row: any) =>
        mapRowToEvent(row, savedIds, goingIds)
      );

      set({ events, savedEventIds: savedIds, goingEventIds: goingIds });

      const hasApiKeys = EVENTBRITE_API_KEY || TICKETMASTER_API_KEY;
      if (hasApiKeys && city) {
        try {
          const externalEvents = await fetchExternalEvents(city);
          get().mergeExternalEvents(externalEvents);
        } catch (error) {
          console.warn("External event fetch failed:", error);
        }
      }
    } catch (error) {
      console.warn("Event fetch failed:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  toggleSave: async (eventId) => {
    const { savedEventIds } = get();
    const isSaved = savedEventIds.has(eventId);

    const next = new Set(savedEventIds);
    if (isSaved) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }

    set((state) => ({
      savedEventIds: next,
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              is_saved: !isSaved,
              saves_count: Math.max(0, e.saves_count + (isSaved ? -1 : 1)),
            }
          : e
      ),
    }));

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    if (isSaved) {
      await supabase
        .from("event_saves")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", session.user.id);
    } else {
      await supabase
        .from("event_saves")
        .insert({ event_id: eventId, user_id: session.user.id });
    }
  },

  toggleGoing: async (eventId) => {
    const { goingEventIds } = get();
    const isGoing = goingEventIds.has(eventId);

    const next = new Set(goingEventIds);
    if (isGoing) {
      next.delete(eventId);
    } else {
      next.add(eventId);
    }

    set((state) => ({
      goingEventIds: next,
      events: state.events.map((e) =>
        e.id === eventId
          ? {
              ...e,
              is_going: !isGoing,
              going_count: Math.max(0, e.going_count + (isGoing ? -1 : 1)),
            }
          : e
      ),
    }));

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    if (isGoing) {
      await supabase
        .from("event_confirmations")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", session.user.id);
    } else {
      await supabase
        .from("event_confirmations")
        .insert({ event_id: eventId, user_id: session.user.id, status: "going" });
    }
  },

  confirmAttended: async (eventId) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? { ...e, confirmations_count: e.confirmations_count + 1 }
          : e
      ),
    }));

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase
      .from("event_confirmations")
      .upsert(
        { event_id: eventId, user_id: session.user.id, status: "attended" },
        { onConflict: "event_id,user_id" }
      );
  },

  mergeExternalEvents: (externalEvents) => {
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const newEvents = externalEvents.filter((e) => !existingIds.has(e.id));
      if (newEvents.length === 0) return state;
      return { events: [...state.events, ...newEvents] };
    });
  },

  getEventById: (id) => get().events.find((e) => e.id === id),

  getSavedEvents: () => {
    const { events, savedEventIds } = get();
    return events.filter((e) => savedEventIds.has(e.id));
  },

  getEventsByCreator: (userId) => {
    return get().events.filter((e) => e.created_by === userId);
  },

  getPhotosForEvent: (eventId) => {
    return get().photos.filter((p) => p.event_id === eventId && p.status === "approved");
  },

  getPendingPhotosForEvent: (eventId) => {
    return get().photos.filter((p) => p.event_id === eventId && p.status === "pending");
  },

  uploadPhoto: async (eventId, imageUri, userId) => {
    try {
      const fileName = `${eventId}/${Date.now()}.jpg`;
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) {
        console.warn("Photo upload error:", uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("event-photos")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { data: photo, error: insertError } = await supabase
        .from("event_photos")
        .insert({
          event_id: eventId,
          uploaded_by: userId,
          image_url: publicUrl,
          thumbnail_url: publicUrl,
        })
        .select()
        .single();

      if (insertError || !photo) {
        console.warn("Photo insert error:", insertError?.message);
        return;
      }

      set((state) => ({
        photos: [...state.photos, { ...photo, status: "pending" as const }],
        events: state.events.map((e) =>
          e.id === eventId ? { ...e, photos_count: e.photos_count + 1 } : e
        ),
      }));
    } catch (error) {
      console.warn("Photo upload failed:", error);
    }
  },

  moderatePhoto: async (photoId, approved) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === photoId
          ? { ...p, status: approved ? ("approved" as const) : ("rejected" as const) }
          : p
      ),
    }));

    await supabase
      .from("event_photos")
      .update({ status: approved ? "approved" : "rejected" })
      .eq("id", photoId);
  },
}));
