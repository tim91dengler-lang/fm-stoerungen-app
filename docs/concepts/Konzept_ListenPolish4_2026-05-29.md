# Konzept: Listen-Polish-4 — Bedienspalten-Position & Sticky Header

> **Status:** Umgesetzt (Branch `feat/listen-polish-4`). Freigabe Tim 2026-05-29 (Variante A
> bestätigt). PWA-Session (M2/M4/M5) inzwischen gemerged → Kollision aufgelöst. Verifiziert per
> Typecheck/ESLint + Playwright-E2E (`e2e/listen-polish-4.spec.ts`, beide grün).
> **Datum:** 2026-05-29
> **Autor:** Claude (Senior-Dev-Modus)
> **Bezug:** CLAUDE.md §4 (Listen-Konvention), Memory `power-layout-listen`; baut auf
> Commit #89 (`feat(listen-polish-3)`) auf.

---

## 1. Ziel & Auslöser

Zwei von Tim am realen Ticket-Pool gefundene Usability-Bugs in der Power-Liste
(`core/liste/PowerListenView.tsx`). Beide betreffen die **Orientierung** in langen,
gruppierten Listen — also genau den Feld-/Leitstand-Alltag.

---

## 2. Befund (Code-Analyse 2026-05-29)

### Bug #1 — Bedienspalten wandern bei Gruppierung nach rechts

**Symptom (Tim):** Gruppiert man 2-stufig (erst *Objekt*, dann *Priorität*) und klappt die
Gruppen auf, erscheinen in der Zeile **zuerst** die Spalten *Objekt* + *Priorität* und **erst
danach** die Checkbox-/Aktions-Spalten. Die Bedienleiste springt also je nach Gruppierungstiefe.

**Soll:** Bulk-Auswahl (`__select__`) und Zeilenaktionen (`__actions__`) stehen **immer ganz
links**, unabhängig von der Gruppierung. Verlässliche, vorhersehbare Position.

**Ursache:** TanStack-Table läuft mit dem **Default `groupedColumnMode: 'reorder'`**. Dieser
Modus zieht alle gruppierten Spalten an den **Anfang** der Spalten-Reihenfolge — und zwar *vor*
unsere fest links gesetzten Spezial-Spalten. Unsere `effectiveColumnOrder`-Logik
([PowerListenView.tsx:707-717](../../apps/web/src/core/liste/PowerListenView.tsx)) prepended
`__select__`/`__actions__` zwar korrekt, wird aber von TanStacks interner Reorder-Stufe
überstimmt. Eingeführt faktisch mit #89 („Gruppierung linksbündig").

### Bug #2 — Sticky Header verschwindet beim Scrollen

**Symptom (Tim):** Beim Scrollen langer Listen verschwinden die Spaltenüberschriften.

**Soll:** Spalten-Header bleiben oben fixiert, damit die Spaltenzuordnung immer sichtbar ist.

**Ursache:** Der `thead` ist bereits korrekt `sticky top-0 z-20`
([PowerListenView.tsx:1360-1366](../../apps/web/src/core/liste/PowerListenView.tsx)) — er sitzt
aber in einem `<div className="overflow-x-auto">`
([:1358](../../apps/web/src/core/liste/PowerListenView.tsx)). CSS-Regel: sobald `overflow-x`
auf `auto` steht, wird `overflow-y` von `visible` auf `auto` hochgestuft → dieser Div ist damit
ein **Scroll-Container in beiden Achsen**. Er hat aber keine Höhenbegrenzung, scrollt also selbst
nie vertikal — die **Seite** (Window) scrollt. `position: sticky` bezieht sich auf den nächsten
Scroll-Container (= dieser Div); da der mit der Seite wegscrollt, scrollt der „sticky" Header mit
weg. Klassische `overflow`-Sticky-Falle. (Der `stickyHeader`-Flag aus #89 ist also korrekt
gesetzt, greift aber wegen des Wrapper-Kontexts nicht.)

---

## 3. Lösungsansatz

### Fix #1 — Spezial-Spalten immer links (klar, kontained)

`groupedColumnMode: false` setzen (TanStacks Auto-Reorder abschalten) und die linksbündige
Gruppierung **selbst** in `effectiveColumnOrder` herstellen:

```
[ __select__, __actions__, …gruppierte Spalten (in Gruppierungs-Reihenfolge), …restliche Spalten ]
```

So bleibt der von #89 gewünschte „Gruppen-Spalten links"-Effekt erhalten, aber **nach** den
Bedienspalten. Änderung lokal in `PowerListenView.tsx`, keine API-Änderung für die Pages.

### Fix #2 — Sticky Header verlässlich machen (Variante zur Freigabe)

Der Wrapper muss aufhören, ein „toter" y-Scroll-Container zu sein. Zwei Wege:

**Variante A (empfohlen) — Tabelle scrollt in sich (Inner-Scroll-Container):**
Wrapper bekommt eine begrenzte Höhe (`max-h-[calc(100vh − Toolbar/Header-Offset)] overflow-auto`).
Dann scrollt die Tabelle *innerhalb* des Containers, und `thead sticky top-0` klebt verlässlich
am Oberrand. Industrie-Standard für Daten-Tabellen (Airtable/Linear-Muster). Horizontaler Scroll
funktioniert sauber mit. *Nachteil:* zwei Scroll-Ebenen (innere Tabelle + Seite), Liste belegt
eine definierte Höhe.

**Variante B — Seiten-Scroll beibehalten:**
Den `overflow-x-auto`-Wrapper so umbauen, dass er **kein** y-Scroll-Container wird (horizontalen
Scroll separat lösen), Header sticky relativ zum Viewport mit korrektem `top`-Offset unter einer
evtl. fixierten App-Toolbar. *Nachteil:* CSS-Edge-Cases (Offset-Pflege, Zusammenspiel mit der
mobilen Karten-Ansicht), fragiler.

**Empfehlung: Variante A.** Robust, ein klares Scroll-Verhalten, löst Sticky-Header **und**
horizontalen Scroll in einem. Konkrete Höhe und ob global oder pro Page wird beim Umsetzen
festgelegt (vermutlich global im PowerListenView, abschaltbar per Flag).

### Umsetzung (Ist-Stand) — Abweichungen zum Entwurf

- **L1:** Statt `groupedColumnMode: false` + manuellem Order-Bau die idiomatischere TanStack-Lösung:
  `__select__`/`__actions__` werden per **`columnPinning: { left: […] }`** gepinnt. Gepinnte Spalten
  bilden eine eigene linke Gruppe, die von der Grouping-Umsortierung unberührt bleibt — kleiner und
  robuster, kein Render-Eingriff.
- **L2:** Variante A **scoped** statt globaler App-Shell-Umbau: nur der Tabellen-Wrapper wird bei
  aktivem `stickyHeader` zum höhenbegrenzten `overflow-auto`-Container
  (`maxHeight` = `polish.stickyMaxHeight`, Default `calc(100vh - 12rem)`). Bewusst **kein**
  `flex-1 min-h-0`-Umbau von AppLayout → Page → Card, weil das jede Seite + die frische Mobile-Arbeit
  beträfe (hoher Blast-Radius). Null Blast-Radius außerhalb der Komponente, degradiert sanft.

---

## 4. Arbeitspakete

| # | Paket | Inhalt | Aufwand |
|:--:|---|---|:--:|
| **L1** | **Bedienspalten links fixieren** | `groupedColumnMode: false` + linksbündige Gruppierung in `effectiveColumnOrder` selbst bauen. Test mit 0/1/2 Gruppierungs-Ebenen. | 🟢 ~0,25 Tag |
| **L2** | **Sticky Header reparieren** | Variante A umsetzen (Inner-Scroll-Container mit begrenzter Höhe), Group-Header-`stickyTop`-Offset gegenprüfen. Test: lange Liste, scrollen, Header bleibt — auch beim Gruppieren. | 🟢 ~0,25–0,5 Tag |

**Gesamt: ~0,5–0,75 Tag.** Ein PR (`feat(listen-polish-4)`), Staging-Acceptance durch Tim.

---

## 5. Kollision mit der parallelen PWA-Session ⚠️

**Beide Fixes leben in `core/liste/PowerListenView.tsx`** — exakt die Datei, die die parallele
PWA-Session (M2 Mobile-Listen-Karten) aktuell **uncommitted** in Arbeit hat (zusammen mit
`TicketsListePage.tsx`, `KanbanPage.tsx`, neuer `TicketCard.tsx`).

**Regel: Nur eine Session editiert diese Datei gleichzeitig.** Daher:

1. Konzept jetzt freigeben (kollisionsfrei, reine Doku).
2. **Umsetzung erst starten, wenn die PWA-Session ihre `PowerListenView.tsx`-Änderungen
   committet/gemerged hat.** Danach übernimmt diese Arbeit die Datei exklusiv und rebased auf den
   neuen `main`-Stand.

---

## 6. Test & Acceptance

- **L1:** Ticket-Pool gruppieren nach Objekt → dann zusätzlich nach Priorität → aufklappen.
  Checkbox + Aktionen müssen in jeder Tiefe ganz links stehen. Auch der Drag-Reorder der
  normalen Spalten darf die Spezial-Spalten nicht verschieben.
- **L2:** Lange Liste (≥ 50 Zeilen) nach unten scrollen → Spalten-Header bleibt sichtbar.
  Gegenprobe mit aktiver Gruppierung (Group-Header klebt unter dem Spalten-Header, nicht darüber).
- Playwright-Screenshot-Check Desktop; kurzer Blick auf 1024px-Grenze (mobile Karten-Ansicht
  ist von beiden Fixes nicht betroffen — sie rendert keine Tabelle).
- Tim: Staging-Klick-Test, Prod-Promote wie gehabt.
