# Pattern: Filter passend zum Feldtyp

**Plattform-relevant:** ja
**Status:** Konzept aus Mockup.

## Einsatzgebiet

In jeder Listenansicht-Spaltenfilter-Logik. Der UI-Filtertyp wird **aus dem Feldtyp abgeleitet**, nicht manuell pro Spalte konfiguriert.

## Regel

| Feldtyp | UI-Filter |
|---------|-----------|
| Auswahlliste (status, prio, kategorie, …) | **Multi-Select-Filter** (Chips, Suche bei > 6 Optionen) |
| Boolean / Flag (aktiv, ist_default) | **Toggle / Tri-State** (alle / nur ja / nur nein) |
| Text (titel, name, beschreibung) | **Text-Eingabefeld** (Substring-Suche, case-insensitive) |
| Zahl / Count (groesse, anzahl) | **Range-Eingabe** mit ≥ / ≤ |
| Datum (erstellt, faelligkeit) | **Date-Picker** mit Range |
| FK auf Stammdatensatz | **Combobox** mit Search + Auswahl |

## Warum keine Text-Inputs für Auswahllisten

Text-Filter auf eine `kategorie`-Spalte mit 5 Werten ist Anti-Pattern:
- Joachim tippt „kli" und sieht nur Treffer mit „Klima/Lüftung" — verpasst aber Tickets mit Kategorie-ID `klima` ohne Label-Substring
- Multi-Select erlaubt „beides: Klima ODER Heizung"
- Multi-Select zeigt sichtbar, welche Filter aktiv sind

## Wie umsetzen

Pro Spalte in der Spalten-Definition den Feldtyp angeben:

```typescript
type SpaltenDef = {
  id: string;
  label: string;
  default: boolean;
  breite: string;
  sortKey: string | ((row, helpers) => any);
  // ...
  filterTyp?: "text" | "multi" | "toggle" | "range" | "date" | "combobox";
  filterField?: string;            // welches Feld am Datensatz
  filterOptions?: () => Option[];  // bei multi/combobox: woher die Optionen kommen
};
```

Die Listen-Komponente rendert dann automatisch das richtige Filter-UI.

## Stolperfallen

- **Auswahlliste-Filter darf inaktive Werte zeigen**, wenn ein Datensatz noch darauf zeigt — sonst „warum sehe ich diesen Datensatz nicht im Filter?"
- **Range-Filter brauchen Type-Coercion**: `null < 5` ist nicht `false` in JavaScript-Vergleichen
- **Date-Filter muss Timezone-aware sein** (`erstellt_am` in UTC, Filter in Local Time)

## Verwandt

- [power-layout.md](power-layout.md) — Spaltenfilter sind Teil des Power-Layouts
- [auswahllisten-default.md](auswahllisten-default.md) — Auswahllisten als Source-of-Truth für Multi-Select-Optionen
