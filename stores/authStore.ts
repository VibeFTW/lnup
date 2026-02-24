import { create } from "zustand";
import type { Profile } from "@/types";
import type { RankId } from "@/types";
import { supabase } from "@/lib/supabase";
import { getRankForScore } from "@/lib/ranks";

interface AuthState {
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: Profile | null) => void;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  initialize: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles_with_stats")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    username: data.username,
    display_name: data.display_name,
    avatar_url: data.avatar_url,
    role: data.role,
    trust_score: data.trust_score,
    rank: (data.rank ?? getRankForScore(data.trust_score).id) as RankId,
    email_verified: data.email_verified,
    phone_verified: data.phone_verified,
    created_at: data.created_at,
    events_posted: data.events_posted ?? 0,
    events_confirmed: data.events_confirmed ?? 0,
    reports_count: data.reports_count ?? 0,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfileById(session.user.id);
        set({ user: profile, isAuthenticated: !!profile, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfileById(session.user.id);
          set({ user: profile, isAuthenticated: !!profile });
        } else {
          set({ user: null, isAuthenticated: false });
        }
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    const profile = await fetchProfileById(data.user.id);
    set({ user: profile, isAuthenticated: true, isLoading: false });
  },

  register: async (email, password, username) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
      },
    });
    if (error) {
      set({ isLoading: false });
      throw error;
    }
    if (data.user) {
      const profile = await fetchProfileById(data.user.id);
      set({ user: profile, isAuthenticated: true, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  fetchProfile: async (userId) => {
    return fetchProfileById(userId);
  },

  deleteAccount: async () => {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) throw error;
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },
}));
