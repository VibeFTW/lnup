import type { Rank, RankId } from "@/types";

export const RANKS: Rank[] = [
  { id: "newbie", label: "Newbie", icon: "🌱", min_score: 0, max_score: 24, color: "#6B6B80" },
  { id: "explorer", label: "Explorer", icon: "🧭", min_score: 25, max_score: 74, color: "#A0A0B8" },
  { id: "regular", label: "Regular", icon: "⭐", min_score: 75, max_score: 149, color: "#FFC107" },
  { id: "insider", label: "Insider", icon: "🔥", min_score: 150, max_score: 299, color: "#FF6B9D" },
  { id: "party_planner", label: "Party Planner", icon: "🎉", min_score: 300, max_score: 499, color: "#6C5CE7" },
  { id: "scene_master", label: "Scene Master", icon: "👑", min_score: 500, max_score: 799, color: "#00D2FF" },
  { id: "big_fish", label: "Big Fish", icon: "🐋", min_score: 800, max_score: 1499, color: "#00E676" },
  { id: "city_icon", label: "City Icon", icon: "💎", min_score: 1500, max_score: Infinity, color: "#FFD700" },
];

export function getRankForScore(score: number): Rank {
  return RANKS.findLast((r) => score >= r.min_score) ?? RANKS[0];
}

export function getNextRank(currentRank: RankId): Rank | null {
  const idx = RANKS.findIndex((r) => r.id === currentRank);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

export function getProgressToNextRank(score: number): number {
  const current = getRankForScore(score);
  const next = getNextRank(current.id);
  if (!next) return 1;
  const range = next.min_score - current.min_score;
  const progress = score - current.min_score;
  return Math.max(0, Math.min(progress / range, 1));
}

export const POINTS = {
  verifyEmail: 5,
  verifyPhone: 10,
  linkSocial: 5,
  postEvent: 3,
  eventGets10Saves: 5,
  eventGets50Saves: 15,
  attendeeConfirms: 2,
  cleanEventBonus: 5,
  confirmAttendance: 1,
  reportFakeRemoved: 5,
  eventReportedFake: -15,
  eventRemovedByAdmin: -50,
  accountWarning: -100,
} as const;
