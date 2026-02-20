import { create } from "zustand";
import type { Event, EventPhoto } from "@/types";
import { MOCK_EVENTS, MOCK_PHOTOS } from "@/lib/mockData";
import { fetchExternalEvents } from "@/lib/eventApis";
import { EVENTBRITE_API_KEY, TICKETMASTER_API_KEY } from "@/lib/constants";

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

export const useEventStore = create<EventState>((set, get) => ({
  events: MOCK_EVENTS,
  photos: MOCK_PHOTOS,
  savedEventIds: new Set(["e2"]),
  goingEventIds: new Set(["e2"]),
  isLoading: false,

  fetchEvents: async (city?: string) => {
    set({ isLoading: true });
    await new Promise((r) => setTimeout(r, 300));

    const hasApiKeys = EVENTBRITE_API_KEY || TICKETMASTER_API_KEY;
    if (hasApiKeys && city) {
      try {
        const externalEvents = await fetchExternalEvents(city);
        get().mergeExternalEvents(externalEvents);
      } catch (error) {
        console.warn("External event fetch failed:", error);
      }
    }

    set({ isLoading: false });
  },

  toggleSave: (eventId) => {
    set((state) => {
      const next = new Set(state.savedEventIds);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return {
        savedEventIds: next,
        events: state.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                is_saved: next.has(eventId),
                saves_count: Math.max(0, e.saves_count + (next.has(eventId) ? 1 : -1)),
              }
            : e
        ),
      };
    });
  },

  toggleGoing: (eventId) => {
    set((state) => {
      const next = new Set(state.goingEventIds);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return {
        goingEventIds: next,
        events: state.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                is_going: next.has(eventId),
                going_count: Math.max(0, e.going_count + (next.has(eventId) ? 1 : -1)),
              }
            : e
        ),
      };
    });
  },

  confirmAttended: (eventId) => {
    set((state) => ({
      events: state.events.map((e) =>
        e.id === eventId
          ? { ...e, confirmations_count: e.confirmations_count + 1 }
          : e
      ),
    }));
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

  uploadPhoto: (eventId, imageUri, userId) => {
    const newPhoto: EventPhoto = {
      id: `p-${Date.now()}`,
      event_id: eventId,
      uploaded_by: userId,
      image_url: imageUri,
      thumbnail_url: imageUri,
      status: "pending",
      approved_by: null,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      photos: [...state.photos, newPhoto],
      events: state.events.map((e) =>
        e.id === eventId ? { ...e, photos_count: e.photos_count + 1 } : e
      ),
    }));
  },

  moderatePhoto: (photoId, approved) => {
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === photoId
          ? { ...p, status: approved ? "approved" : "rejected" }
          : p
      ),
    }));
  },
}));
