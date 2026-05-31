# Konzept: UI/UX-Überarbeitung des Ticket-Details

> **Projekt:** fm-stoerungen-app (08_FM_ERP_app)
> **Stand:** 2026-05-31
> **Status:** **Freigegeben** (Tim, 2026-05-31, „los"). Layout-Richtung von Tim an Claude delegiert
> („was würde ein UI/UX-Spezialist machen?").
> **Auslöser:** Tim-Feedback — „im Browser nutzen wir den Platz nicht aus, Anordnung der Felder
> nicht logisch."
> **Bezug:** [Konzept_TicketPool_2026-05-31.md](Konzept_TicketPool_2026-05-31.md) §8 (Detail-Panel),
> CLAUDE.md §4 (Listen-Konvention) · baut auf #105 (zentriertes Modal) auf.

---

## 1. Diagnose (Ist-Zustand)

Das Ticket-Detail ist ein **zentriertes Modal (~670 px, `max-w-2xl`) mit einer langen Scroll-Spalte**.

1. **Platzverschwendung:** Auf Breitbild bleibt links/rechts ~60 % leer.
2. **Eine Endlos-Spalte:** Fakten (Status, Ort, Termine) und Aktivität (Chat, Fotos, Dokumente)
   stapeln durcheinander — man scrollt zu den wichtigen Dingen.
3. **Flache Hierarchie:** viele kleine graue Felder, schwache visuelle Priorität; die häufigsten
   Aktionen (Status, Zuweisen) sind nicht fixiert.

## 2. Leitidee: „Record + Activity", zweispaltig

Ein Ticket ist **Datensatz + Verlauf**. Etablierter Standard (Linear, Jira, Zendesk, GitHub Issues)
ist ein **breites, zweispaltiges Detail**:

```
┌───────────────── #T-1042 · Heizung fällt aus ──────────── [✕] ┐  ← STICKY Kopf
│ [Status ▼ In Bearb.]  [● Hoch]  [Zugewiesen ▼ M. Krause]  ⏰  │
├───────────────────────────────────┬───────────────────────────┤
│  TICKET (Fakten / Bearbeitung)    │  AKTIVITÄT & BELEGE       │
│  ▸ Wartet-auf-Bar (wenn aktiv)    │  ┌─────────────────────┐  │
│  ▸ Klassifizierung & Zuordnung    │  │  CHAT (füllt Höhe)  │  │
│     Vorlage·Kategorie·Quelle·Proj │  │   …Nachrichten…     │  │
│  ▸ Ort  Objekt▸Haus▸Stockwerk     │  └─────────────────────┘  │
│     [ Grundriss + mehrere Pins ]  │  [ schreiben … ]          │
│  ▸ Termine  Fälligkeit·Wdh.       │  FOTOS    [▣][▣][＋]       │
│  ▸ Beschreibung                   │  DOKUMENTE • Angebot.pdf  │
└───────────────────────────────────┴───────────────────────────┘
   Desktop ~60 % / 40 %    ·    Handy/Tablet: alles einspaltig (Chat unten)
```

**Hebel:**
- **Breit statt schmal:** großes Panel (≈ `max-w-5xl`/`6xl`), **responsiv** → Mobile/Tablet eine Spalte.
- **Sticky Kopfleiste:** Nummer, Titel, **Status/Priorität/Zuweisung** immer sichtbar.
- **Logische Gruppen:** links Fakten (kompakte Label-Wert-Paare), rechts Kommunikation & Belege;
  selten Geändertes einklappbar.
- **Visuelle Anker:** Status als Farbleiste, Prio-Punkt, Sektions-Header mit Icon, mehr Dichte.

## 3. Mehrere Pins (Grundriss)

Statt einzelnem `pin_x/pin_y` eine **Pin-Liste am Ticket**: Stufe 1 als **JSONB-Array**
`pins: [{x, y, label?}]` (kleine Migration, kein Join; bestehende Einzel-Pins werden mitmigriert).
UI: Klick setzt weiteren Pin, Pins einzeln entfernbar, optional durchnummeriert.

## 4. Stufe-1-Schnitt & Umsetzung (3 PRs)

1. **Layout-Gerüst** — breit, zweispaltig, sticky Action-Header, responsiv (gleiche Optik fürs
   Erfassen-Modal, damit's konsistent bleibt). Reine Umstrukturierung, keine Funktionsänderung.
2. **Feld-Gruppierung & Polish** — Sektionen, Dichte, Hierarchie.
3. **Mehrere Pins** — Datenmodell (JSONB + Migration) + UI.

**Nordstern (bewusst später):** Tabs, echte Verlauf-/Audit-View, Sektionen per Drag sortieren.

---

*Konzept zuerst. Freigegeben 2026-05-31 — Umsetzung in den drei genannten PRs, Layout-Gerüst zuerst.*
