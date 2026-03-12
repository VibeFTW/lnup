import { format, isToday, isTomorrow, isThisWeek, isWeekend, parseISO, differenceInDays, addWeeks, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { DateFilter, EventSourceType } from "@/types";

export function formatEventDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    if (isToday(date)) return "Heute";
    if (isTomorrow(date)) return "Morgen";
    const daysAway = differenceInDays(date, new Date());
    if (daysAway >= 2 && daysAway <= 6) return `in ${daysAway} Tagen`;
    return format(date, "EEE, d. MMM", { locale: de });
  } catch {
    return dateStr;
  }
}

export function getCountdownLabel(dateStr: string, timeStart?: string): string | null {
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const days = differenceInDays(date, now);
    if (days < 0) return null;
    if (days === 0) {
      if (timeStart && timeStart.length >= 5) {
        const [h, m] = timeStart.split(":").map(Number);
        const eventTime = new Date(date);
        eventTime.setHours(h, m, 0, 0);
        const hoursLeft = Math.floor((eventTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        if (hoursLeft > 0) return `Heute in ${hoursLeft} Std`;
        if (hoursLeft === 0) return "Jetzt!";
      }
      return "Heute";
    }
    if (days === 1) return "Morgen";
    if (days <= 7) return `In ${days} Tagen`;
    return null;
  } catch {
    return null;
  }
}

export function formatTime(timeStr: string): string {
  if (!timeStr || timeStr.length < 5) return timeStr ?? "";
  return timeStr.substring(0, 5);
}

export function matchesDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === "alle") return true;
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return true;
    switch (filter) {
      case "heute":
        return isToday(date);
      case "morgen":
        return isTomorrow(date);
      case "wochenende":
        return isWeekend(date) && isThisWeek(date);
      case "woche":
        return isThisWeek(date);
      case "naechste_woche": {
        const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { locale: de });
        const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { locale: de });
        return date >= nextWeekStart && date <= nextWeekEnd;
      }
      default:
        return true;
    }
  } catch {
    return true;
  }
}

export function getSourceLabel(source: EventSourceType): string {
  const labels: Record<string, string> = {
    api_ticketmaster: "Ticketmaster",
    ai_discovered: "KI-erkannt",
    ai_scraped: "KI-erkannt",
    platform: "LNUP",
    verified_organizer: "Veranstalter",
    verified_user: "Verifiziert",
    community: "Community",
  };
  return labels[source] ?? source;
}

export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str ?? "";
  return str.substring(0, maxLength - 3) + "...";
}

export function isPastEvent(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return false;
    const eventDay = new Date(y, m - 1, d);
    return eventDay < today;
  } catch {
    return false;
  }
}

export function validateEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
