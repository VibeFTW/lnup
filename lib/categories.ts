import type { Category, DateFilter } from "@/types";

export const EVENT_CATEGORIES: Category[] = [
  { id: "nightlife", label: "Nightlife", icon: "moon", gradientStart: "#6C5CE7", gradientEnd: "#8B5CF6" },
  { id: "food_drink", label: "Food & Drinks", icon: "restaurant", gradientStart: "#FF6B9D", gradientEnd: "#FF8E53" },
  { id: "concert", label: "Konzerte", icon: "musical-notes", gradientStart: "#00D2FF", gradientEnd: "#6C5CE7" },
  { id: "festival", label: "Festivals", icon: "bonfire", gradientStart: "#FFC107", gradientEnd: "#FF6B00" },
  { id: "sports", label: "Sport", icon: "football", gradientStart: "#00E676", gradientEnd: "#00BFA5" },
  { id: "art", label: "Kunst", icon: "color-palette", gradientStart: "#FF5252", gradientEnd: "#FF6B9D" },
  { id: "family", label: "Familie", icon: "people", gradientStart: "#00D2FF", gradientEnd: "#00E676" },
  { id: "other", label: "Sonstiges", icon: "ellipsis-horizontal", gradientStart: "#6B6B80", gradientEnd: "#A0A0B8" },
];

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "heute", label: "Heute" },
  { id: "morgen", label: "Morgen" },
  { id: "wochenende", label: "Wochenende" },
  { id: "woche", label: "Diese Woche" },
  { id: "alle", label: "Alle" },
];

export function getCategoryLabel(id: string): string {
  return EVENT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function getCategoryIcon(id: string): string {
  return EVENT_CATEGORIES.find((c) => c.id === id)?.icon ?? "ellipsis-horizontal";
}

export function getCategoryGradient(id: string): [string, string] {
  const cat = EVENT_CATEGORIES.find((c) => c.id === id);
  return [cat?.gradientStart ?? "#6B6B80", cat?.gradientEnd ?? "#A0A0B8"];
}
