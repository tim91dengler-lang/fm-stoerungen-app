# Pattern: Power-Layout für Listen

**Plattform-relevant:** ja
**Status:** Im Mockup vollständig umgesetzt (alle 7 Listenansichten), wandert in `core/liste` als Plattform-Modul.

## Einsatzgebiet

Jede tabellarische Liste in einer Business-Anwendung mit > 10 Datensätzen und Power-User-Anteil. Pflicht in allen FM-Listenansichten (Tickets, Partner, Objekte, Adressen, Benutzer, Vorlagen, Fehlercodes, Dokumente).

## Wann anwenden

Immer wenn alle folgenden Bedingungen gelten:

- Liste mit > 10 Datensätzen erwartet
- Anwender ist Power-User (Joachim, Frau Zwittich) — nicht Endkunde
- Mehrere Sortierschlüssel sinnvoll
- Datensätze müssen sich gruppieren oder bulk-bearbeiten lassen

## Eigenschaften

1. **Spalten-Drag-Reorder** im Header (`GripVertical`-Symbol links neben jedem Label, Drop-Indikator als grüner Strich beim Drag-Over)
2. **Kompakte Gruppierungs-Zeile** direkt über dem Tabellen-Header — Drop-Target für Spalten-Header zur Gruppierung
3. **Pro Gruppierungs-Pill:** Drei-Klick-Sortierzyklus `asc` → `desc` → `null` (Default), per X aus Gruppierung entfernen, per Drag innerhalb der Zeile umordnen
4. **Spalten-Sortierung direkt im Header** mit Drei-Klick-Zyklus pro Spalte
5. **Mehrstufige Sortierung per Shift+Klick** mit Positions-Indikator (1, 2, 3 …)
6. **Bulk-Auswahl als feste linke Spalte** (Master-Checkbox + Zeilen-Checkbox), nicht abschaltbar
7. **Bulk-Edit pro editierbarer Spalte** über Pencil-Icon im Spalten-Header bei Auswahl > 0; Sicherheitsabfrage ab 2 Datensätzen via Modal (kein `window.confirm`)
8. **Gruppen-Massenbedienung** „Alle auf" / „Alle zu" links in der Gruppierungs-Zeile
9. **Gespeicherte Ansichten** (Filter + Layout) als Sets pro Liste, LocalStorage-Key `fm-<liste>-ansichten`
10. **Layout-Persistenz** pro Liste in LocalStorage unter `fm-<liste>-layout`, Reset-Button bei Abweichung vom Default
11. **Migration** alter Formate transparent (z. B. `gruppierungen: string[]` → `{id, dir}[]`)

## Wie umsetzen

Pro Liste:

```typescript
// apps/web/src/core/liste/usePowerLayout.ts
const power = usePowerLayout({
  listeId: "tickets",
  spaltenDef: TICKET_SPALTEN,
  defaultSpalten: TICKET_SPALTEN.filter((s) => s.default).map((s) => s.id),
  defaultSortierungen: [{ id: "erstellt", dir: "desc" }],
  aktionenBreite: "80px",
});
const { layout, sichtbarSpalten, gridTemplate, sortierungen, gruppierungen,
        selected, toggleSelected, alleAuswaehlen, auswahlLeeren,
        bulkPending, bulkSetzeFeld, bulkBestaetigen, bulkAbbrechen,
        toggleSpalte } = power;
```

Spalten-Definition pro Liste:

```typescript
const TICKET_SPALTEN: SpaltenDef[] = [
  { id: "id",       label: "ID",       default: true, breite: "100px",            sortKey: "id" },
  { id: "titel",    label: "Titel",    default: true, breite: "minmax(220px, 2fr)", sortKey: "titel" },
  { id: "status",   label: "Status",   default: true, breite: "120px",            sortKey: (t, h) => h.statusReihenfolge(t.statusId) },
  // ...
];
```

Wiederverwendbare Komponenten:
- `usePowerLayout()` — State + DnD-Handler + Persistenz + Bulk-Logik
- `<PowerGruppierungsZeile>` — Drag-Target-Zeile mit Pills
- `<PowerHeaderZelle>` — Header-Cell mit Grip, Sort-Klick, Bulk-Edit-Icon
- `<BulkEditDropdown>` — Pencil-Popover (Select/Text/Date-Editor)
- `<BulkConfirmDialog>` — Sicherheitsabfrage (statt window.confirm)
- `<DropGap>` — visueller Drop-Indikator zwischen Pills

## Stolperfallen

- **Drag-Source: Grip-Icon, nicht Container.** Das Wrapping des gesamten Headers in `<button draggable>` führte zu Konflikten mit Browser-Klick-Heuristik (Drag-vs-Klick). Lösung: Grip-Icon als `<span draggable>` mit `stopPropagation()`, Container nur klick-sensitiv.
- **Flexible Spalten brauchen `minmax(min, 1fr)`.** Reines `1fr` führt zu 0-Pixel-Breite, wenn fixe Spalten + Master + Aktionen den Container überschreiten. Beispiel: `minmax(280px, 1fr)`.
- **`overflow-hidden` am Container ist tödlich.** Liste muss `overflow-x-auto` haben, sonst werden flexible Spalten beschnitten.
- **Auswahl-Spalte ist NICHT konfigurierbar.** Sie ist hart fixiert ganz links, 32px breit, nicht sortierbar, nicht gruppierbar, nicht im Spalten-Menü.

## Beispiel-Implementierung

Im Mockup `02_draft/fm-stoerungen/src/App.jsx` (FM-Repo) implementiert für 8 Listen — beim Bau in `apps/web/src/core/liste/` als wiederverwendbares Modul extrahiert.

## Verwandt

- [auswahllisten-default.md](auswahllisten-default.md) — Spaltenfilter nach Feldtyp
- [filter-passend-zum-feldtyp.md](filter-passend-zum-feldtyp.md) — Multi-Select bei Auswahllisten-Spalten
