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
- **Verknüpfungen:** `RelationList` — Vorschau + „in Listenansicht öffnen" → `PowerListenView` vorgefiltert.

## Pflicht-Regeln
1. **Liste** = `PowerListenView` mit ALLEM: Volltextsuche · Spaltenfilter (Typ passend) · Multi-Sort
   (Shift, 3-Klick-Reset) · Gruppierung · gespeicherte Ansichten · Bulk-Spalte · Spalten ein/aus ·
   Treffer-Zähler · Power-Layout (Drag-Reorder). **Ausschließlich Listen — keine Kachel-/Karten-Ansicht.**
2. **Detail** = zentriertes Overlay über der sichtbaren Liste; Kopf (Identität + Status-Badges) +
   Sprung-Chips + zwei Regionen (links primär 3/5, rechts Kontext 2/5) + Block-Accordions mit
   progressiver Offenlegung (häufig offen, selten/Historie zu). Mobil: einspaltig.
3. **Panel vs. Seite** = Overlay-Breite: flacher Datensatz → Panel (max-w-3xl); eigene Hierarchie/
   Beziehungs-Welt → Seite (max-w-6xl, ggf. Tree-Slot links). Beide rendern denselben Block-Inhalt.
4. **Tabs nie** zum Zerschneiden eines Formulars. Verknüpfungen = Ebene-3-Liste, nicht Tab-Mini-Liste.
5. **„Historie"-Block** (rechts, zu) an JEDEM Datensatz: Angelegt am · Zuletzt geändert am · Interne ID.
6. **Keine erfundenen Felder** — nur Reales aus dem Datenmodell. Vorschläge als „(Vorschlag)" markieren
   und mit Tim klären, NICHT einfach bauen.

## Abnahme-Checkliste (vor „fertig")
- [ ] Liste = `PowerListenView` mit allen Funktionen (Regel 1).
- [ ] `PageShell` (richtige Variante) + `PageHeader` (Standard-Größe).
- [ ] Detail = zentriertes Overlay über sichtbarer Liste; Esc/✕ → Liste.
- [ ] Block-Engine: Regionen links/rechts, progressive Offenlegung.
- [ ] Sprung-Chips (Feld → scroll, Verknüpfung → Liste).
- [ ] Verknüpfungen → Ebene-3-`PowerListenView` vorgefiltert (keine Eigenbau-Liste).
- [ ] „Historie"-Block vorhanden, zugeklappt.
- [ ] Mobil einspaltig, große Touch-Ziele.
- [ ] Block-Layout entspricht der Modul-Skizze im Konzept §6 (oder mit Tim abgestimmt + dort nachgezogen).
- [ ] Smoke-Test: gespeicherte Ansichten/Spalten-State bricht nicht (Memory `tanstack-grouping-loop`).
- [ ] Keine neuen Felder ohne Freigabe.

## Vorgehen für ein neues/geändertes Modul
1. Soll-Block-Layout aus Konzept §6 nehmen (oder mit Tim festlegen + dort eintragen).
2. Spalten-Definition + Feld-Katalog + Default-Block-Layout des Moduls liefern — Engine macht den Rest.
3. Gegen die Abnahme-Checkliste prüfen, dann Tim zur Acceptance geben.
