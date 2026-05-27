# Pattern: Listen-Power 2.0 — UX-Polish, Schaltflächen-Diät & Skalierungs-Fundament

**Plattform-relevant:** ja
**Status:** Konzept — Pilot auf [TicketsListePage](../../apps/web/src/pages/TicketsListePage.tsx) (W1), Rollout in W2.
**Vorgänger:** [power-layout.md](power-layout.md) — die mechanischen Listen-Features (Drag-Reorder, Multi-Sort, Bulk, Gruppierung, gespeicherte Ansichten). Dieses Pattern baut darauf auf und ergänzt visuelle Hierarchie, Interaktions-Reduktion und Skalierungs-Verhalten.

## Einsatzgebiet

Alle Listen-Pages, die heute `PowerListenView` nutzen (9 Stück: Tickets, Partner, Objekte, Adressen, Anlagen, Fehlercodes, Projekte, Users, Dokumente). Zukünftige Listen ebenfalls.

## Design-Prinzipien

1. **Information vor Interaktion** — was häufig gesehen wird, soll ruhig sein; was selten gebraucht wird, erscheint on demand (Hover, Long-Press, Kontext-Menü).
2. **Skalierung als Default** — jede Stammdaten-Eingabe muss bei 5 und bei 500 Optionen gleich gut funktionieren. Kein UI-Element darf bei wachsender Datenmenge degradieren.
3. **Gruppierung als Fokus-Werkzeug** — nicht nur visuell trennen, sondern aktiv beim Navigieren helfen (sticky Headers, Aggregate, Kollabieren).

## Block 1 — Visuelle Ruhe & Hierarchie

| Heute | Soll | Wirkung |
|---|---|---|
| Action-Icons immer sichtbar links pro Zeile | **Hover-Aktionen:** Edit/Delete-Icons erscheinen erst bei Maus über Zeile. Mobile: Long-Press öffnet Kontext-Menü. | Listen wirken aufgeräumt, kein visueller Lärm |
| Gleiche Schriftgröße für alle Zellen | **Typografie-Hierarchie:** Primärwert kräftig (z.B. Titel), Sekundärinfo (z.B. Erstellt-Datum, Untertyp) eine Stufe kleiner & grau in zweiter Zeile darunter. | Verdichtung — weniger Spalten nötig |
| Group-Header scrollt mit weg | **Sticky Group-Headers:** beim Scrollen klebt der aktuelle Header oben. | Orientierung in langen Listen |
| Gruppen optisch flach | **Einrückung & Trenner:** Gruppen-Inhalt visuell eingerückt, dezente Hintergrund-Schattierung pro Gruppe, dicker Trenner zwischen Gruppen. | „Buch-artige" Struktur statt Excel-Wüste |
| Keine Aggregate in Gruppen | **Gruppen-Aggregate:** Header zeigt Count + ggf. Summe/Durchschnitt der Gruppe dezent. | Übersicht beim Scrollen |
| Eine Density für alle | **Density-Toggle:** Compact / Comfortable / Spacious — pro User in LocalStorage. | Anpassung an Bildschirm + Zweck (Power-User vs. Joachim) |

**Referenz:** Linear (sticky group headers, hover-actions), Notion (collapsible groups, density-toggle), Attio (cleane Typografie-Hierarchie).

## Block 2 — Skalierungs-Fundament

**Heutiges Problem:** Mehrere Modals nutzen native HTML-`<select>`-Felder mit `limit: 500` (siehe [ObjektePage L455](../../apps/web/src/pages/ObjektePage.tsx), [AnlagenPage](../../apps/web/src/pages/AnlagenPage.tsx), [FehlercodesPage](../../apps/web/src/pages/FehlercodesPage.tsx)). Native Selects mit >100 Optionen sind unbrauchbar (Scrollbar winzig, kein Filtern). Zusätzlich schneidet die MassEdit-Combobox bei `.slice(0, 100)` ab.

**Eine Combobox überall — und richtig gebaut:**

| Eigenschaft | Verhalten |
|---|---|
| **Tippen filtert sofort** | Inline-Search im Dropdown — bei 200 Partnern findet man „Müller" in 2 Tastendrücken |
| **Server-side Search ab N>50** | Lädt nicht alle Einträge in den Browser, sondern fragt API mit dem Suchbegriff (`?search=...`) |
| **Most-Recently-Used oben** | LocalStorage merkt sich letzte ~5 Auswahlen pro Combobox-Kontext |
| **Gruppierte Optionen** | Bei Partnern: nach Typ (Eigentümer / Mieter / Nachunternehmer) gruppiert |
| **Sticky Selected Tags** | Ausgewählte Chips bleiben oben sichtbar, Optionsliste scrollbar |
| **Kein Limit-Cut** | `.slice(0, 100)` wird entfernt — entweder Server-Search oder echte Pagination |

→ Ersetzt **alle** native `<select>`-Felder in Modals systematisch. Ein Komponenten-Refactor, dauerhaft skalierungs-fest.

**Filter-Skalierung in der Tabellen-Toolbar:**

- Aktive Filter werden **als Pills** über der Tabelle angezeigt (mit X zum Entfernen) — Status auf einen Blick erkennbar
- **Inline-Search in Filter-Dropdowns** (gleiche Combobox-Logik)
- **Smart Defaults pro User-Rolle** (Techniker = „nur meine Tickets", Admin = „nur offene") — über gespeicherte Ansichten

## Block 3 — Schaltflächen-Diät

**Heutiger Zustand:** Pro Liste 6+ permanent sichtbare Buttons (Edit-Stift, Delete/Sperren, Mass-Edit, Spalten-Picker, Gruppierungs-Picker, Ansichten-Menü, Suche, „Neu anlegen").

**Reduktions-Strategie:**

| Element heute | Element morgen |
|---|---|
| Edit + Delete in jeder Zeile sichtbar | **Hover-only.** Mobile: Long-Press öffnet Kontext-Menü |
| Mass-Edit-Button permanent | **Kontextuell.** Mass-Edit-Bar erscheint nur bei Selection ≥1 |
| 3 separate Menüs (Spalten / Gruppierung / Ansichten) | **Ein Zahnrad-Menü** mit Tabs für Spalten / Gruppen / Ansichten |
| Edit-Stift dominant | **Doppelklick auf Zelle** = Inline-Edit. Edit-Stift sekundär (oder weg) |
| Suchfeld immer sichtbar | **Bleibt** — aber zusätzlich `/` als Keyboard-Shortcut für Power-User |

**Nach der Diät:** 1 sichtbarer Toolbar-Button („Neu anlegen") + 1 dezentes Zahnrad + Suchfeld. Pro Zeile: nichts sichtbar. Mass-Edit-Bar nur kontextuell.

## Block 4 — Sperren-vs-Löschen-Konsolidierung

**Heutiger Zustand inkonsistent:**
- Soft-Sperren (Pause/Play-Icons): Partner, Objekte
- Hard-Delete (Trash-Icon): Adressen, Anlagen, Fehlercodes, Tickets, Users, Dokumente

**Entscheidung: Variante A — Soft-Sperren überall.**

| Begründung | Konsequenz |
|---|---|
| DSGVO/Audit-tauglich (nichts geht verloren) | Alle Entitäten bekommen `aktiv: bool` (wo nicht vorhanden) |
| Konsistente Metapher für User | Action-Icon einheitlich Play/Pause statt mal Trash mal Pause |
| Bauindustrie-Reflex (nichts wegwerfen) | Default-Filter „nur aktive" in jeder Liste |
| Korrektur von Tippfehlern weiterhin möglich | Echtes Hard-Delete nur über Admin-Sondermenu (selten) |

**Migrations-Aufwand:** Alembic-Migration für Entitäten ohne `aktiv`-Spalte, Backend-Routen ergänzen, Frontend-Aktion einheitlich. Eigene Welle (W4).

## Block 5 — Erweiterte Patterns (später)

Nicht Teil der ersten Rollout-Wellen — erst nach Pilot-Validierung:

- **Keyboard-Navigation** (j/k Zeile auf/ab, e=edit, /=suche, x=select, g=group)
- **View-Switcher** wo sinnvoll (Tickets: Tabelle / Kanban / Kalender)
- **Smart Empty States** („Keine Treffer — willst du den Status-Filter zurücksetzen?")
- **Druckansicht** für Listen (Joachim-Wunsch potenziell)

## Rollout-Wellen

| Welle | Inhalt | Aufwand | Zielzustand |
|---|---|---|---|
| **W1** | Block 1 + Block 3 auf [TicketsListePage](../../apps/web/src/pages/TicketsListePage.tsx) als Pilot anwenden | ~1 Session | Visueller „Wow"-Effekt, Pattern-Validierung |
| **W2** | Rollout der Polish-Patterns auf alle 9 Listen | ~2 Sessions | Konsistenz |
| **W3** | Skalierungs-Combobox-Refactor (Block 2) — neue Combobox-Komponente + Ersatz der nativen Selects | ~2 Sessions | Stammdaten skalieren beliebig |
| **W4** | Sperren-vs-Delete-Konsolidierung (Block 4) — Migration + Backend + UI | ~1 Session + Migration | Konsistenz auf Konzept-Ebene |
| **W5** | Mass-Edit-Rollout auf Objekte, Projekte, Dokumente | ~1 Session | Feature-Parität |

Block 5: erst nach W1–W5 stabil.

## Stolperfallen

- **Hover-Aktionen + Touch:** Reines `:hover` reicht nicht für Tablet/Mobile. Long-Press-Detect oder Kontext-Menü zusätzlich nötig.
- **Sticky Group-Headers + virtuelles Scrolling:** Bei großen Listen mit TanStack-Virtualizer ist Sticky-Positioning schwierig. Falls Virtualisierung kommt → Pattern anpassen.
- **Density-Toggle vs. Spalten-Inhalt:** Compact-Modus muss prüfen, ob Zwei-Zeilen-Typografie noch lesbar ist. Default = Comfortable.
- **Server-Side-Search-Combobox:** Debounce 250-300ms, sonst Backend-Hammer bei Tipp-Geschwindigkeit.
- **MRU (Most-Recently-Used) pro Kontext:** Storage-Key muss eindeutig sein (z.B. `combobox-mru-{listeId}-{feldId}`), sonst verwirrte Sortierung.

## Verwandt

- [power-layout.md](power-layout.md) — Vorgänger, mechanische Listen-Features
- [filter-passend-zum-feldtyp.md](filter-passend-zum-feldtyp.md) — Multi-Select bei Auswahllisten
- [combobox-mit-inline-anlegen.md](combobox-mit-inline-anlegen.md) — Inline-Anlegen-Pattern, ergänzt sich mit Block 2
- [auswahllisten-default.md](auswahllisten-default.md) — Stammdaten als Tabellen
