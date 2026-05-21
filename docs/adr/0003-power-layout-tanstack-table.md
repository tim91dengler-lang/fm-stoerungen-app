# ADR 0003 — Power-Layout-Modul auf Basis von TanStack Table v8

- **Status:** Akzeptiert
- **Datum:** 2026-05-21
- **plattform-relevant:** ja (Plattform-Kandidat 1, siehe ADR 0001)

## Kontext

Slice 2 baut das Power-Layout-Modul (`core/liste/`) als wiederverwendbaren Plattform-Baustein. Anforderungen aus CLAUDE.md (FM-Projekt) und Mockup:

- Kachel- und Listenansicht umschaltbar (`ViewModeToggle`)
- Gesamt-Suchfeld über alle relevanten Felder + verknüpften Stammdaten
- Spalten-Filter direkt unter den Headern, **typ-passend** (Text / Number ≥ / Multi-Select / Toggle)
- Spalten ein- und ausblendbar (mit `default: true/false` je Spalte)
- Drag-Reorder von Spalten
- Multi-Sort (Shift+Klick), 3-Klick-Reset
- Bulk-Auswahl als erste Spalte
- Gruppierungs-Zeile mit ↑↓-Pills zum Sortieren der Gruppen
- Gespeicherte Ansichten (pro User, in DB)
- Treffer-Zähler `gefiltert / gesamt`

## Optionen

**A — Eigenbau** mit `useState` + custom Hooks.
- ⊕ Volle Kontrolle, kein Bundle-Zuwachs
- ⊖ ~3–4 PT zusätzlich; Edge-Cases (z. B. Multi-Sort-Reset, Drag-Performance bei 1000+ Rows) müssen wir selbst lösen
- ⊖ Premature Reinvention; bekannte Bibliotheken haben das längst durchgekaut

**B — TanStack Table v8** (vormals React-Table).
- ⊕ Headless, ~50 KB minified, modular (man lädt nur, was man nutzt)
- ⊕ Built-in: Sorting, Filtering, Grouping, Column-Visibility, Column-Ordering, Row-Selection, Pagination
- ⊕ Battle-tested, große Community, kontinuierlich gepflegt
- ⊕ Eigene Tailwind-UI darüber → Look-and-feel bleibt unseres
- ⊖ +50 KB Bundle (vertretbar; lazy-loadable falls nötig)

**C — AG-Grid** (Community-Edition).
- ⊕ Sehr feature-reich
- ⊖ Bundle-Größe deutlich höher (~600 KB)
- ⊖ Eigene CSS-Welt, schwerer zu thematisieren
- ⊖ Enterprise-Features (Pivots, Master-Detail) hinter Lizenz

## Entscheidung

**Option B — TanStack Table v8.**

Rule-of-Three-Logik aus ADR 0001 greift bewusst nicht zurück: Power-Layout ist von Anfang an für mehrere Module geplant (Tickets, Objekte, Partner, Adressen, später Mitarbeiter, Fehlercodes, …), das macht es bereits beim ersten Einsatz zum Plattform-Modul.

## Konsequenzen

### Was wir tun

1. **Package:** `@tanstack/react-table` als Dependency in `apps/web/package.json`.
2. **Modul-Struktur:**
   ```
   apps/web/src/core/liste/
     ├── PowerTable.tsx          // Haupt-Komponente
     ├── usePowerLayout.ts       // Hook (column-state, filter-state, view-state)
     ├── ColumnFilter.tsx        // typ-spezifische Filter
     ├── ColumnVisibility.tsx    // Spalten ein/aus
     ├── GroupBar.tsx            // Gruppierungs-Zeile mit ↑↓-Pills
     ├── ViewModeToggle.tsx      // Kachel / Liste
     ├── SavedViewsMenu.tsx      // Ansichten-Menü
     ├── BulkActionsBar.tsx      // Bulk-Aktionen
     └── types.ts                // Spec für Column-Definition mit `default: true/false`, `filterKind`, `groupable`
   ```
3. **Spalten-Definition:** Jedes Modul (Tickets, Objekte, …) liefert eine `ColumnSpec[]` an `PowerTable`. Spec enthält pro Spalte: id, header, accessor, type, filterKind, defaultVisible, groupable.
4. **State-Persistenz:** UI-State (sichtbare Spalten, Reihenfolge, Sort, Filter, Gruppierung) wird via `useState` + Hook gehalten und in `gespeicherte_ansichten` (DB) serialisiert.
5. **Server-Side vs. Client-Side:** Für Slice 2 alles Client-Side (Postgres liefert max. 200 Zeilen pro Request, das reicht). Server-Side-Pagination kommt erst, wenn ein Modul nachweislich > 500 Zeilen ohne Filter braucht.
6. **A11y:** TanStack Table ist headless → wir setzen ARIA-Attribute selbst (Sort-Direction, Filter-Active-Indicator, Group-Expand).
7. **Mobile:** Tabelle horizontal-scrollbar; ColumnVisibility-Menü ist auf Mobile besonders wichtig (User blendet aus, was er nicht braucht).

### Was wir bewusst NICHT tun

- Keine eigene Drag-Engine — wir nutzen `@dnd-kit/sortable` für Column-Reorder (kleine zusätzliche Lib, aber tausendmal besser als react-dnd).
- Keine Virtualisierung in Slice 2 (TanStack Virtual könnte später ergänzt werden, wenn Listen > 1000 Zeilen werden).
- Keine Spalten-Resize in Slice 2 (Slice 3+, wenn echte Nutzerdaten zeigen, dass es nötig ist).

### Trigger für Wechsel zu AG-Grid o. ä.

- Excel-Export mit komplexen Formatierungen nötig (Grouping mit Subtotals)
- Pivot-Tabellen für Reporting
- Tree-Tables mit > 10.000 Zeilen + Inline-Edit + Master-Detail

Bis dahin: TanStack reicht.

## Aufwand

- Power-Layout-Modul gesamt: ~5 PT (siehe Konzept Slice 2 Abschnitt 7)
- Folgemodule (Objekte, Partner, …): jeweils ~0,5 PT für die Liste, weil das Modul nur die ColumnSpec liefert

## Bezug

- [Konzept Slice 2](../../01_plan/Konzept_Slice2_UX-Sprung_2026-05-21.md) Abschnitt 2 + 3
- [ADR 0001 — Plattform-Anker-Strategie](0001-plattform-anker-strategie.md) Kandidat-Liste
- [Pattern: Power-Layout in Listen](../patterns/power-layout.md)
- [Pattern: Filter passend zum Feldtyp](../patterns/filter-passend-zum-feldtyp.md)
