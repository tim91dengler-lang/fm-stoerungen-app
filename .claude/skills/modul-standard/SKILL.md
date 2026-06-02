---
name: modul-standard
description: >-
  Verbindlicher UI/UX-Modul-Standard für fm-stoerungen-app (Master-Layout). IMMER
  nutzen, wenn ein Modul / eine Stammdaten- oder Listen-Seite / ein Detail-Panel /
  ein CRUD-Bereich neu gebaut oder geändert wird (Tickets, Objekte, Geschäftspartner,
  Projekte, Adressen, Anlagen, Fehlercodes, …). Liefert die Bau-Vorlage + die
  Abnahme-Checkliste, damit Liste UND Detail überall gleich aufgebaut sind.
---

# Modul-Standard (verbindlich)

**Volle Referenz:** `docs/concepts/Konzept_UIUX_MasterLayout_FINAL_2026-06-02.md` — bei Unklarheit
dort nachlesen. Abweichungen brauchen Tims Freigabe + ein Update des Konzepts.

**Gilt für** alle Daten-Module. **Nicht für** Konfig-Editoren (Vorlagen-Designer, Auswahllisten,
Status-Workflow) und eigene Visualisierungen (Dashboard, Kanban) — die bekommen nur `PageShell`+`PageHeader`.

## Das Schichten-Modell (Pflicht)
```
Liste (Basis) → Detail (zentriertes Overlay über der Liste) → Verknüpfte Liste (Ebene 3) → …
✕/Esc/zurück schließt je eine Ebene.
```

## Bausteine (alle aus `apps/web/src/core/`)
- **Liste:** `PowerListenView` (die EINZIGE Listen-Engine) + `useListenState` + `PageShell`/`PageHeader`.
- **Detail:** `DetailOverlay` (zentriert) + generische **Block-Engine** (generalisiert aus der Stufe-C
  `TicketFormEngine`): Regionen → Blöcke → Felder aus Katalog + Default-Layout, Renderer-Registry je Feld,
  Auffang-Block „Weitere".
- **Detail-Navigation = Reiter:** `DetailTabs` (aus `core/detail`) — Reiter-Leiste oben (immer sichtbar) +
  Panel; rendert nur den **aktiven** Reiter (leichtes DOM). „Übersicht" + eigene Reiter nur für große
  Feld-Kategorien + Verknüpfungs-/Chat-Reiter.
- **Verknüpfungen = Inline-Reiter:** `RelationListView` — volle, vorgefilterte Liste + Suche **inline**,
  **lazy** (Daten erst beim Öffnen; Zähler aus dem Datensatz). Zeilen via `onItemClick` → Ziel-Detail.
  Kein gestapeltes Fenster, kein „zurück".
- **Optional** für einen einzelnen sehr langen Reiter: `DetailNavProvider` + `DetailScroll` (In-Reiter-Sprung
  mit Flash + Scroll-Spy). Nicht die Top-Navigation.

## Pflicht-Regeln
1. **Liste** = `PowerListenView` mit ALLEM: Volltextsuche · Spaltenfilter (Typ passend) · Multi-Sort
   (Shift, 3-Klick-Reset) · Gruppierung · gespeicherte Ansichten · Bulk-Spalte · Spalten ein/aus ·
   Treffer-Zähler · Power-Layout (Drag-Reorder). **Ausschließlich Listen — keine Kachel-/Karten-Ansicht.**
2. **Detail** = zentriertes Overlay über der sichtbaren Liste; Kopf (Identität + Status-Badges) +
   **Reiter-Leiste** (`DetailTabs`, immer sichtbar). Reiter „Übersicht" = zwei Regionen (links primär 3/5,
   rechts Kontext 2/5) + Block-Accordions mit progressiver Offenlegung (häufig offen, selten/Historie zu).
   Mobil: Reiter horizontal scrollbar, „Übersicht" einspaltig.
3. **Panel vs. Seite** = Overlay-Breite: flacher Datensatz → Panel (max-w-3xl); eigene Hierarchie/
   Beziehungs-Welt → Seite (max-w-6xl, ggf. Tree-Slot links). Beide rendern denselben Reiter-/Block-Inhalt.
4. **Reiter (Tabs) sind die Top-Navigation** (Tim 2026-06-02). Formular NICHT in viele Mini-Reiter
   zerschneiden — eine Feld-Kategorie wird erst ein eigener Reiter, wenn sie groß genug ist; sonst bleibt
   sie in „Übersicht". Verknüpfungen = Inline-Reiter mit voller Liste (nicht Tab-Mini-Liste, nicht gestapeltes Fenster).
5. **„Historie"-Block** (rechts, zu) an JEDEM Datensatz: Angelegt am · Zuletzt geändert am · Interne ID.
6. **Keine erfundenen Felder** — nur Reales aus dem Datenmodell. Vorschläge als „(Vorschlag)" markieren
   und mit Tim klären, NICHT einfach bauen.

## Abnahme-Checkliste (vor „fertig")
- [ ] Liste = `PowerListenView` mit allen Funktionen (Regel 1).
- [ ] `PageShell` (richtige Variante) + `PageHeader` (Standard-Größe).
- [ ] Detail = zentriertes Overlay über sichtbarer Liste; Esc/✕ → Liste.
- [ ] `DetailTabs`-Reiter oben: „Übersicht" + eigene Reiter nur für große Kategorien + Verknüpfungs-Reiter; aktiver Reiter markiert, Klick schaltet um; nur aktiver Reiter gemountet.
- [ ] „Übersicht" = Block-Engine: Regionen links/rechts, progressive Offenlegung, inkl. zugeklapptem „Historie"-Block (Angelegt/Geändert/ID).
- [ ] Verknüpfungen = Inline-Reiter (`RelationListView`): volle vorgefilterte Liste + Suche, lazy (Daten erst beim Öffnen, Zähler aus Datensatz), Zeilen klickbar (`onItemClick`). Kein „zurück", kein gestapeltes Fenster.
- [ ] Mobil: Reiter-Leiste scrollbar, „Übersicht" einspaltig, große Touch-Ziele.
- [ ] Block-Layout entspricht der Modul-Skizze im Konzept §6 (oder mit Tim abgestimmt + dort nachgezogen).
- [ ] Smoke-Test: gespeicherte Ansichten/Spalten-State bricht nicht (Memory `tanstack-grouping-loop`).
- [ ] Keine neuen Felder ohne Freigabe.

## Vorgehen für ein neues/geändertes Modul
1. Soll-Block-Layout aus Konzept §6 nehmen (oder mit Tim festlegen + dort eintragen).
2. Spalten-Definition + Feld-Katalog + Default-Block-Layout des Moduls liefern — Engine macht den Rest.
3. Gegen die Abnahme-Checkliste prüfen, dann Tim zur Acceptance geben.
