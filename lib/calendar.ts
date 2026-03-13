import { Platform } from "react-native";
import type { Event } from "@/types";
import { APP_URL } from "@/lib/constants";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toICSDate(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = (timeStr ?? "20:00").substring(0, 5).split(":").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  let result = line.substring(0, maxLen);
  let pos = maxLen;
  while (pos < line.length) {
    result += "\r\n " + line.substring(pos, pos + maxLen - 1);
    pos += maxLen - 1;
  }
  return result;
}

export function generateICS(event: Event): string {
  const dtStart = toICSDate(event.event_date, event.time_start);
  const dtEnd = event.time_end
    ? toICSDate(event.event_date, event.time_end)
    : toICSDate(event.event_date, addHours(event.time_start, 2));

  const location = [event.venue?.name, event.venue?.address, event.venue?.city]
    .filter(Boolean)
    .join(", ");

  const url = `${APP_URL}/event/${event.id}`;
  const uid = `${event.id}@lnup.app`;
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LNUP//Event//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Berlin:${dtStart}`,
    `DTEND;TZID=Europe/Berlin:${dtEnd}`,
    foldLine(`SUMMARY:${escapeICS(event.title)}`),
    ...(event.description
      ? [foldLine(`DESCRIPTION:${escapeICS(event.description)}`)]
      : []),
    ...(location ? [foldLine(`LOCATION:${escapeICS(location)}`)] : []),
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

function addHours(timeStr: string, hours: number): string {
  const [h, m] = (timeStr ?? "20:00").substring(0, 5).split(":").map(Number);
  const newH = (h + hours) % 24;
  return `${pad(newH)}:${pad(m)}`;
}

export async function exportToCalendar(event: Event): Promise<void> {
  const icsContent = generateICS(event);
  const filename = `${event.title.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_")}.ics`;

  if (Platform.OS === "web") {
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  try {
    const FileSystem = require("expo-file-system");
    const Sharing = require("expo-sharing");

    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, icsContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/calendar",
        UTI: "com.apple.ical.ics",
      });
    }
  } catch (e) {
    if (__DEV__) console.warn("Calendar export failed:", e);
  }
}
