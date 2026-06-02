---
name: reuse-first
description: >-
  Komponenten-Inventar für fm-stoerungen-app. IMMER nutzen, sobald ein UI-Eingabe-,
  Auswahl-, Datums-, Listen-, Tabellen- oder Picker-Element gebaut oder geändert wird —
  auch in kleinen Form-Widgets und Field-Renderern, nicht nur in ganzen Modulen. Sagt,
  welche vorhandene gestylte Komponente statt eines nativen Controls zu verwenden ist.
  Verhindert die Fehlerklasse „nacktes <input>/<select>/<table> selbst gebaut".
---

# Reuse-First — vorhandene Komponenten statt nativer Controls

**Regel:** Brauchst du ein Eingabe-/Auswahl-/Listen-Element, **suche zuerst hier**. Native
HTML-Controls (`<input type=date>`, `<select>`, `<select multiple>`, eigene `<table>`) sind
verboten — sie sehen je Browser anders aus, brechen das Dark-Theme und ignorieren die
Listen-/Detail-Konventionen. Diese Regel ist Punkt 3 der Definition of Done (CLAUDE.md §0)
und wird per ESLint hart erzwungen (`apps/web/eslint.config.js`).

Verwandt: Skill `modul-standard` (Aufbau ganzer Module: Liste + Detail).

## Inventar (alle Pfade real, Stand 2026-06-02)

| Brauchst du … | Nutze | Pfad | NIEMALS |
|---|---|---|---|
| Datumsauswahl | `DatePicker` | `apps/web/src/components/DatePicker.tsx` | `<input type=date>` |
| Datum im Detail-Inline-Edit | `InlineEditDate` | `apps/web/src/core/detail/InlineEdit.tsx` | eigener Kalender |
| Einzel-Auswahl großer Mengen (Objekt, Projekt, Fehlercode …) | `EntitySearchSelect` | `apps/web/src/components/EntitySearchSelect.tsx` | `<select>` mit vielen `<option>` |
| Mehrfach-Auswahl | `MultiSelectCombobox` | `apps/web/src/components/MultiSelectCombobox.tsx` | `<select multiple>` / Checkbox-Liste |
| Partner-Auswahl (fachlich) | `PartnerSearchSelect` | `apps/web/src/components/PartnerSearchSelect.tsx` | eigenes Suchfeld |
| Adress-Auswahl (fachlich) | `AdresseSearchSelect` | `apps/web/src/components/AdresseSearchSelect.tsx` | eigenes Suchfeld |
| Farb-/Symbol-Auswahl | `FarbPicker` / `SymbolPicker` | `apps/web/src/components/` | native color input |
| Liste / Übersicht (jede!) | `PowerListenView` | `apps/web/src/core/liste/PowerListenView.tsx` | eigene `<table>`, Kachel-/Karten-Ansicht |
| Gespeicherte Ansichten (Liste) | `SavedViewsMenu` | `apps/web/src/core/liste/SavedViewsMenu.tsx` | — |
| Detail-Overlay | `DetailOverlay` | `apps/web/src/core/detail/DetailOverlay.tsx` | eigenes Modal |
| Detail-Reiter | `DetailTabs` | `apps/web/src/core/detail/DetailTabs.tsx` | eigene Tab-Leiste |
| Verknüpfte Liste im Detail | `RelationListView` | `apps/web/src/core/detail/RelationListView.tsx` | gestapeltes Fenster |
| Bestätigungs-/Löschdialog | `ConfirmDialog` | `apps/web/src/core/liste/ConfirmDialog.tsx` | `window.confirm` |

## Vorgehen

1. Element gebraucht? Zeile in der Tabelle suchen, vorhandene Komponente importieren.
2. Komponente fehlt eine Variante? **Komponente erweitern**, nicht daneben ein natives Control bauen.
3. Wirklich neuer Typ? Mit Tim klären — und nach Phase 2 in die zentrale Feldtyp-Registry
   eintragen (dann gilt der Standard automatisch überall), nicht erneut pro Stelle kopieren.

> Hinweis: `DatePicker` erwartet `value?: string|null` (ISO `YYYY-MM-DD`) + `onChange:(iso:string|null)=>void`,
> optional `placeholder`, `allowClear`, `disabled`, `className`.
