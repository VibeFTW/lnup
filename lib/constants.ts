export const COLORS = {
  get background() { return getThemeColors().background; },
  get card() { return getThemeColors().card; },
  get cardHover() { return getThemeColors().cardHover; },
  get border() { return getThemeColors().border; },
  primary: "#6C5CE7",
  primaryLight: "#8B7CF7",
  get secondary() { return getThemeColors().secondary; },
  accent: "#FF6B9D",
  get success() { return getThemeColors().success; },
  get warning() { return getThemeColors().warning; },
  get danger() { return getThemeColors().danger; },
  get textPrimary() { return getThemeColors().textPrimary; },
  get textSecondary() { return getThemeColors().textSecondary; },
  get textMuted() { return getThemeColors().textMuted; },
};

function getThemeColors() {
  try {
    const { useThemeStore } = require("@/stores/themeStore");
    return useThemeStore.getState().colors;
  } catch {
    return {
      background: "#F5F5FA", card: "#FFFFFF", cardHover: "#F0F0F5",
      border: "#E8E8F0", secondary: "#00B4D8", success: "#00C853",
      warning: "#FF9800", danger: "#EF5350", textPrimary: "#1A1A2E",
      textSecondary: "#6B6B80", textMuted: "#A0A0B8",
    };
  }
}

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const GEMINI_API_KEY = process.env.EXPO_GEMINI_API_KEY ?? "";
export const EVENTBRITE_API_KEY = process.env.EXPO_PUBLIC_EVENTBRITE_API_KEY ?? "";
export const TICKETMASTER_API_KEY = process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY ?? "";
export const SEATGEEK_CLIENT_ID = process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID ?? "";

export const REGION_CENTER = {
  latitude: 48.8317,
  longitude: 12.9589,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

export const INITIAL_CITIES = [
  "Deggendorf",
  "Passau",
  "Straubing",
  "Regensburg",
] as const;
