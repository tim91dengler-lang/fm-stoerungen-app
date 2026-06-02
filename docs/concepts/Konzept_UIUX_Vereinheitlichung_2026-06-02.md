# Konzept: UI/UX-Vereinheitlichung — Master-Layout + wiederverwendbare Bausteine für alle Module/Listen

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-02 — **Entwurf zur Abstimmung**
> **Status:** Konzept. **Bis zur Freigabe durch Tim: kein Produktiv-Code.**
> **Methodik:** Ist-Zustand mehrgleisig im Code recherchiert (Datei:Zeile-Belege), dann strukturierter Entwurf.
> **Bezug:** `docs/plan.md` (Roadmap), `docs/tech-spec.md` (Pflichtenheft), CLAUDE.md §4 (Listen-/UX-Konvention).
> **Aufwand (grob):** XL

---

## 1. Ziel

Ein konsistentes Master-Layout (Seiten-Shell, Header, Listen-Engine, Modal/Detail-Muster, Stammdaten-CRUD-Gerüst) für alle Modul- und Stammdatenseiten. Heute baut jede Seite ihr Gerüst selbst — Ergebnis: unterschiedliche Überschriftengrößen, mal zentriert/mal volle Breite, 7 Seiten ignorieren die vorhandene Power-Listen-Engine ganz, kein einheitlicher Kachel/Liste-Umschalter. Zielgruppe sind Joachims Sachbearbeiter (Wiedererkennbarkeit über Module) und Tim (schnelleres Bauen neuer Module). Das ist das Fundament, auf das die übrigen Themen aufsetzen.

## 2. Ist-Zustand (heute im Code)

Es gibt bereits eine starke, zentrale Listen-Engine `PowerListenView` (apps/web/src/core/liste/PowerListenView.tsx) mit Drag-Reorder, Gruppierung, Multi-Sort, Bulk-Select, Spaltenfilter, Spalten ein/aus, Mass-Edit, gespeicherten Ansichten (via SavedViewsMenu, Z.336-440 Props-Interface). Sie wird von 9 Listen-Seiten genutzt: Projekte, Objekte, Partner, Adressen, Anlagen, Fehlercodes, Benutzer, Tickets, Dokumente (Grep-Beleg). ABER: (1) 7 Seiten umgehen sie komplett mit handgebautem Layout — AuswahllistenPage (eigenes Master-Detail-Grid, AuswahllistenPage.tsx:101/118), StatusWorkflowPage (rohe <table>, StatusWorkflowPage.tsx:90), WartungenPage (eigenes grid-cols-7, WartungenPage.tsx:191), VorlagenPage (eigenes Kachel-Grid, VorlagenPage.tsx:99), DashboardPage, KanbanPage, MeineTicketsPage. (2) KEINE ViewModeToggle-Komponente existiert, obwohl CLAUDE.md §4 Kachel+Liste verbindlich fordert — Grep auf 'ViewModeToggle'/'viewMode' liefert nichts; nur TicketsListePage hat `renderMobileCard`, und das greift nur unter lg-Breakpoint (PowerListenView.tsx:433-437), d.h. einen Desktop-Kachel-Modus gibt es nirgends. (3) Kein gemeinsames Page-Shell/PageHeader: Überschriften gespalten text-xl (8 Seiten) vs text-2xl (6 Seiten); Seiten-Wrapper gespalten zwischen `space-y-4/6 px-4 py-6 lg:px-8` (volle Breite) und `mx-auto max-w-7xl/5xl/4xl px-4 py-6` (zentriert: Anlagen, Fehlercodes, Auswahllisten, StatusWorkflow, Dashboard, MeineTickets). (4) Boilerplate-Duplikat: 9 Seiten definieren je eigenes `ViewConfig` + `DEFAULT_CONFIG` und verdrahten ~9 identische onXChange-Handler + SavedViewsMenu von Hand (ProjektePage.tsx:27-50, identisch in allen 9). (5) 20 handgerollte `fixed inset-0`-Modals, KEIN gemeinsames Modal/Dialog-Primitive (Grep: 20 Treffer, components hat nur themenspezifische *Modal.tsx). (6) Detail-Muster gespalten: Objekt/Projekt/Partner = eigene Voll-Detail-Pages (Navigate via Link, ObjektePage.tsx:208), Ticket = Detail-PANEL (TicketDetailPanel.tsx), Auswahllisten = Inline-Master-Detail. (7) Die `polish`-Flags (stickyHeader, densityToggle, consolidatedSettingsMenu …) sind NUR auf TicketsListePage aktiv (TicketsListePage.tsx:672-680); der Code-Kommentar dort sagt 'in W2 ziehen die Defaults auf alle Listen um' — dieser Roll-out ist nie passiert. Warum es nicht reicht: Die Engine ist gut, aber es fehlt die SCHALE drumherum (Shell/Header/Toolbar-Konvention) und der verbindliche Roll-out — dadurch sieht jede Seite anders aus und neue Module starten wieder bei null.

## 3. Scope — erste Ausbaustufe (Pilot)

- Neue Bausteine in core/: PageShell (einheitlicher Wrapper, entscheidet volle-Breite vs. zentriert), PageHeader (Titel/Untertitel/Aktionen-Slot, ein Größen-Standard), ViewModeToggle (Kachel/Liste, oben rechts neben Aktionen — schließt die CLAUDE.md-§4-Lücke), Modal/Dialog-Primitive (ersetzt die 20 fixed-inset-0-Eigenbauten schrittweise)
- useListenState-Hook in core/liste/: kapselt ViewConfig/DEFAULT_CONFIG + die 9 onXChange-Handler + Persistenz, damit Listen-Seiten nur noch columns + Daten + Defaults liefern (entfernt das 9-fach-Duplikat)
- PowerListenView um optionalen Desktop-Kachel-Modus erweitern: `renderCard` (statt nur mobil); ViewModeToggle steuert Tabelle vs. Kachelraster; Suche/Filter/Sortierung greifen in beiden Modi gleich
- Polish-Defaults zentral aktivieren (stickyHeader, densityToggle, consolidatedSettingsMenu, searchShortcut, kebab-Actions) als Standard für ALLE PowerListenView-Seiten — der nie vollzogene W2-Roll-out
- Migration der 9 bestehenden PowerListenView-Seiten auf PageShell + PageHeader + useListenState (rein mechanisch, gleiches Verhalten)
- Migration der einfachen Eigenbau-Seiten auf die Engine, wo sinnvoll: Vorlagen (Kachel→Kachel-Modus der Engine), Wartungen-Liste, MeineTickets
- Verbindliche Konvention im Repo dokumentieren (docs/patterns/): wie eine neue Modul-/Stammdatenseite gebaut wird (Shell→Header→Liste→Detail/Modal)

**Bewusst NICHT jetzt (später / Nordstern):**

- Backend-/DB-Änderungen (rein Frontend-Vereinheitlichung).
- Neues visuelles Theme/Rebranding (Farben, Typo-System) — hier nur Struktur-/Layout-Konsistenz, kein Redesign.
- Mieter-Portal/externe Login-UI (Stufe 3).
- Vollständiges Komponenten-Designsystem mit Storybook-Katalog für alle Primitives (Nordstern) — Stufe 1 nur die für Listen/Module nötigen Bausteine.
- Kanban/Dashboard auf die Listen-Engine zwingen — die sind bewusst eigene Visualisierungen, bekommen nur PageShell+PageHeader.

## 4. Architektur-Skizze

Frontend-only, kein Backend/DB-Schema betroffen (gespeicherte Ansichten laufen schon über ansichtenApi/SavedViewsMenu). Neue Komponenten unter apps/web/src/core/ (FM-frei, Plattform-Anker-konform): core/shell/PageShell.tsx, core/shell/PageHeader.tsx, core/ui/Modal.tsx, core/liste/ViewModeToggle.tsx, core/liste/useListenState.ts. PowerListenView bekommt zwei zusätzliche optionale Props: `renderCard?: (row)=>ReactNode` (Desktop-Kachel) und `viewMode?/onViewModeChange?` ODER intern via useListenState gesteuert; Default bleibt Tabelle, sodass bestehende Seiten ohne Änderung weiterlaufen (additive, rückwärtskompatible Erweiterung wie schon bei `polish`/`renderMobileCard`). useListenState liefert {search,visibility,sorting,columnFilters,columnOrder,grouping,viewMode} + Setter und persistiert pro viewKey (gleicher Key wie SavedViewsMenu). Migrationsstrategie: nicht-brechend, Seite-für-Seite — alte und neue Schale koexistieren während des Roll-outs. Bezug zum Stack: nutzt vorhandenes @tanstack/react-table, dnd-kit, Tailwind, react-router; keine neuen Dependencies. Detail-Muster: als Konvention festlegen (Empfehlung: Listen→Slide-over-Panel als Default wie Ticket, Voll-Detail-Page nur für komplexe Aggregate wie Objekt) — siehe offene Frage.

## 5. Offene Fragen — von Tim zu entscheiden

1. Detail-Muster vereinheitlichen: Slide-over-Panel als Default (wie Ticket) ODER Voll-Detail-Page (wie Objekt/Projekt/Partner)? Empfehlung: Panel als Default, Voll-Page nur für Objekt (Hierarchie Haus/Stockwerk/Einheit). Soll Projekt/Partner langfristig auf Panel umgestellt werden oder bleiben sie Voll-Pages?
2. Seitenbreite: durchgängig volle Breite (px-4 lg:px-8) ODER zentriert mit max-w? Empfehlung: Listen volle Breite, Formular-/Konfig-Seiten (StatusWorkflow, Auswahllisten) zentriert max-w-5xl — als zwei dokumentierte Shell-Varianten.
3. Kachel/Liste-Default je Seite: Stammdaten-Listen default Liste, was bekommt Kachel-Default (Vorlagen ja, sonst?)? Soll der ViewModeToggle überall erscheinen oder nur wo ein sinnvoller Kachel-Modus existiert?
4. Polish-Defaults (Density, sticky, kebab-Actions) sofort für ALLE Listen scharf schalten, oder pro Seite während der Migration? Empfehlung: zentral default-on, da auf Tickets bereits bewährt.
5. Umfang Stufe 1: nur die 9 Engine-Seiten harmonisieren (kleiner Schnitt) ODER auch die 7 Eigenbau-Seiten gleich mitziehen (größer)? Empfehlung: Shell+Header+useListenState für alle 16, Engine-Migration der Eigenbauten nur wo klar gewinnbringend (Vorlagen, Wartungen, MeineTickets).

## 6. Umsetzungsschnitt (Reihenfolge / PR-Pakete)

1. PR1 — Bausteine ohne Migration: PageShell, PageHeader, ViewModeToggle, Modal-Primitive in core/ anlegen (+ Stories/Tests); noch keine Seite umgestellt. Liefert die Bibliothek.
2. PR2 — useListenState-Hook + PowerListenView `renderCard`/viewMode additiv; eine Pilot-Seite (Projekte) komplett auf Shell+Header+useListenState+Kachelmodus umstellen als Referenz.
3. PR3 — Polish-Defaults zentral (Density/sticky/kebab/consolidated-Settings) als Engine-Default aktivieren; auf der Pilot-Seite und Tickets verifizieren (Verhalten unverändert außer gewollten Defaults).
4. PR4 — Restliche 8 Engine-Seiten auf Shell+Header+useListenState migrieren (Objekte, Partner, Adressen, Anlagen, Fehlercodes, Benutzer, Dokumente, Tickets) — rein mechanisch, je Seite ein kleiner Commit.
5. PR5 — Eigenbau-Seiten harmonisieren: Vorlagen/Wartungen/MeineTickets auf Engine bzw. Shell; Auswahllisten/StatusWorkflow/Dashboard/Kanban auf PageShell+PageHeader (Listen-Engine dort nicht erzwingen).
6. PR6 — 20 handgerollte Modals schrittweise auf Modal-Primitive umstellen (kann parallel/nachgelagert laufen).
7. PR7 — Konvention in docs/patterns/ dokumentieren + CLAUDE.md §4 als erfüllt markieren (ViewModeToggle existiert jetzt wirklich).

## 7. Risiken

- Regressionsgefahr bei 16 Seiten-Migrationen — gespeicherte Ansichten/Spalten-State pro viewKey darf nicht brechen; je Seite Smoke-Test nötig (Memory selbst-testen-vor-tim).
- PowerListenView ist groß und sensibel (Re-Render-Loops, vgl. Kommentar Z.702 + Memory tanstack-grouping-loop) — additive Props statt Umbau halten, sonst Endlos-Render.
- Desktop-Kachelmodus muss Suche/Filter/Sortierung 1:1 wie die Tabelle anwenden, sonst divergiert Verhalten zwischen den Ansichten.
- Scope-Creep: XL kann zerfasern — strikt nach PR-Schnitt arbeiten, Shell/Header zuerst, Modal-Umbau (20 Stück) bewusst nachgelagert.
- Detail-Muster-Entscheidung (Panel vs. Page) ist eine kleine Architektur-Weggabelung — vor PR4/5 von Tim entscheiden lassen, sonst Doppelarbeit.
- Touch/Mobile: bestehender renderMobileCard-Pfad + BottomTabBar dürfen durch den neuen Desktop-Kachelmodus nicht verschoben werden.

---

*Konzept zuerst. Bis zur Freigabe durch Tim: kein Code.*
