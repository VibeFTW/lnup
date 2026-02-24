# LNUP — Local Nights, Unique Places

> **LNUP** wird ausgesprochen wie **"Lineup"** — dein Lineup für heute Abend.

**[Live Demo](https://lnup-demo.vercel.app)**

**LNUP** ist eine mobile App, die dir zeigt, was in deiner Stadt los ist — heute Abend, dieses Wochenende oder nächste Woche. Clubs, Restaurants, Konzerte, Festivals, Sport-Events — alles an einem Ort, ohne Algorithmus und ohne dich durch zehn verschiedene Plattformen klicken zu müssen.

## Das Problem

Events sind überall verstreut: Facebook, Instagram, Eventbrite, Webseiten von Locations, Mundpropaganda. Niemand hat eine einzige Anlaufstelle, um zu sehen, was gerade in der eigenen Stadt passiert. Bestehende Plattformen sind entweder überladen, algorithmusgesteuert oder zeigen nur bezahlte Events. Kleine lokale Veranstaltungen gehen komplett unter.

**LNUP löst das**, indem es Events automatisch aus verschiedenen Quellen zusammenführt, durch die Community ergänzt wird und alles in einem sauberen, ehrlichen Feed darstellt — chronologisch, filterbar, ohne versteckte Agenda.

---

## Features

### AI-gestützte Event-Erkennung
Ein KI-Pipeline durchsucht automatisch das Internet, Social Media und Venue-Webseiten nach Events. Die KI extrahiert strukturierte Daten (Titel, Datum, Ort, Beschreibung, Preis) und fügt sie dem Feed hinzu. Ergänzt wird das durch offizielle APIs von Eventbrite und Ticketmaster.

### Community-Events mit Vertrauenssystem
Jeder kann Events erstellen — aber nicht jedes Event ist gleich vertrauenswürdig. Jedes Event zeigt transparent an, woher es kommt:

| Badge | Quelle |
|-------|--------|
| ✦ Eventbrite / Ticketmaster | Automatisch aus offiziellen APIs |
| ✦ LNUP | Vom LNUP-Team verifiziert |
| ✓ Veranstalter | Verifizierte Venue-Betreiber |
| ✓ Verifiziert | Verifizierte Nutzer |
| ○ Community | Nicht-verifizierte Nutzer |

So sieht jeder sofort, wie verlässlich die Info ist.

### Rang- und Punktesystem
Nutzer sammeln Punkte durch aktive Teilnahme — Events posten, Teilnahme bestätigen, hilfreiche Beiträge leisten. Je mehr Punkte, desto höher der Rang:

| Rang | Punkte | Icon |
|------|--------|------|
| Newbie | 0–24 | 🌱 |
| Explorer | 25–74 | 🧭 |
| Regular | 75–149 | ⭐ |
| Insider | 150–299 | 🔥 |
| Party Planner | 300–499 | 🎉 |
| Scene Master | 500–799 | 👑 |
| Big Fish | 800–1499 | 🐋 |
| City Icon | 1500+ | 💎 |

Ränge sind öffentlich sichtbar. Nutzer mit hohem Rang genießen mehr Vertrauen und ihre Events werden prominenter angezeigt. Wer Mist baut, verliert Punkte.

### Event-Fotogalerie
Besucher können Fotos von Events hochladen. Der Veranstalter entscheidet, welche Fotos im öffentlichen Event-Post erscheinen. So entsteht über Zeit ein visuelles Archiv — besonders bei wiederkehrenden Events sieht man, wie es beim letzten Mal aussah.

### Smarte Filter
Events lassen sich nach Datum (Heute, Morgen, Wochenende, Diese Woche) und Kategorie (Nightlife, Food & Drinks, Konzerte, Festivals, Sport, Kunst, Familie) filtern. Kein Algorithmus entscheidet, was du siehst — du filterst selbst.

### Community-Moderation
- Events mit 3+ Reports werden automatisch markiert
- Events mit 5+ Reports werden automatisch entfernt
- "War dabei"-Bestätigungen nach dem Event
- KI-basierte Vorab-Prüfung von Inhalten und Fotos

---

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| **Mobile App** | React Native (Expo SDK 52) |
| **Navigation** | Expo Router (dateibasiert) |
| **Styling** | NativeWind v4 (Tailwind CSS für React Native) |
| **State Management** | Zustand |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **KI** | Google Gemini API |
| **Karten** | Google Maps SDK |
| **Event-APIs** | Eventbrite API, Ticketmaster Discovery API |
| **Sprache** | TypeScript (strict mode) |

### Projektstruktur

```
LNUP/
├── app/                    # Screens (Expo Router)
│   ├── (tabs)/             # Tab-Navigation (Feed, Karte, Erstellen, Gemerkt, Profil)
│   ├── (auth)/             # Login & Registrierung
│   └── event/              # Event-Detailseite
├── components/             # Wiederverwendbare UI-Komponenten
├── lib/                    # Hilfsfunktionen, Konstanten, Supabase-Client
├── stores/                 # Zustand State Management
├── types/                  # TypeScript-Typdefinitionen
├── supabase/               # Datenbank-Migration (SQL)
└── assets/                 # App-Icons, Splash Screen
```

### Datenbank

Die PostgreSQL-Datenbank (via Supabase) umfasst:

- **profiles** — Nutzerprofile mit Rang und Punktestand
- **venues** — Locations mit Adresse, Koordinaten, Verifizierungsstatus
- **events** — Events mit Kategorie, Quelle, Status und KI-Konfidenzwert
- **event_series** — Wiederkehrende Events verknüpft über Serien
- **event_photos** — Fotos mit Moderations-Workflow (pending → approved/rejected)
- **event_saves** — Gespeicherte/gemerkte Events
- **event_confirmations** — "War dabei"-Bestätigungen
- **event_reports** — Meldungen mit Auto-Flag/Remove-Logik
- **scrape_sources** — URLs für die KI-Scraping-Pipeline

Alle Tabellen sind mit Row Level Security (RLS) abgesichert. Punkte werden serverseitig über PostgreSQL-Trigger berechnet — manipulationssicher.

### Lokaler Start

```bash
git clone https://github.com/VibeFTW/LNUP.git
cd LNUP
npm install
npx expo start
```

Für den vollen Funktionsumfang:

1. Supabase-Projekt erstellen und `supabase/migration.sql` ausführen
2. `.env` anlegen (siehe `.env.example`) mit Supabase-URL, Anon-Key, Google Maps Key und Gemini API Key
