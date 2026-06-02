# Konzept: Globale Volltextsuche (Quick-Search / Command-Palette via Topbar + ⌘K) — ein /search-Endpoint mit gruppierten, mandantengebundenen Treffern und Deep-Links

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-02 — **Entwurf zur Abstimmung**
> **Status:** Konzept. **Bis zur Freigabe durch Tim: kein Produktiv-Code.**
> **Methodik:** Ist-Zustand mehrgleisig im Code recherchiert (Datei:Zeile-Belege), dann strukturierter Entwurf.
> **Bezug:** `docs/plan.md` (Roadmap), `docs/tech-spec.md` (Pflichtenheft), CLAUDE.md §4 (Listen-/UX-Konvention).
> **Aufwand (grob):** M

---

## 1. Ziel

Eine zentrale Quick-Search, mit der Joachims Büro/Admin und Techniker von überall in der App per ⌘K (bzw. Klick in der Topbar) tippen und in einem Overlay gruppierte Treffer über alle Kern-Entitäten sehen (Tickets, Objekte, Geschäftspartner, Adressen, Anlagen, Fehlercodes, Vorlagen, Projekte) — mit Tastatur-Navigation und direktem Sprung zum Detail. Ersetzt das heutige „erst zur richtigen Liste navigieren, dann dort suchen" durch einen einzigen Einstiegspunkt. Stufe-1-pragmatisch: ILIKE/pg_trgm reicht, kein KI-Embedding (das ist der bereits geplante Stufe-2-NL-Search-Hook).

## 2. Ist-Zustand (heute im Code)

SUCHE existiert heute nur PRO LISTE, nicht global. Jedes List-Service hat denselben ILIKE-Pattern, aber je Entität auf andere Felder begrenzt: ticket_service.py:416-420 (titel + beschreibung, NICHT die ticket.nummer aus models/ticket.py:61), partner_service.py:95-103 (name/nachname/vorname/email), objekt_service.py:44-45 (nur name), adresse_service.py:23-31 (strasse/ort/plz), projekt_service.py:103-104 (nur name), fehlercode_service.py:41-48 (code + titel), anlage_service.py:40-41 (nur bezeichnung), dokument_service.py:58-59. Es gibt KEINEN /search-Endpoint: der API-Router (api/v1/router.py) registriert tickets, partner, objekte, adressen, anlagen, fehlercodes, projekte, dokumente — aber kein search-Modul. Im Frontend (components/AppLayout.tsx:112-153) hat die Topbar nur Greeting links + Notifications/Logout rechts, KEIN Suchfeld; es gibt KEIN ⌘K / keinen keydown-Listener und KEINE cmdk-Dependency in package.json. Warum es nicht reicht: (1) Joachims Büro arbeitet entitätsübergreifend (Anruf „Mieter Müller, Objekt Hauptstr. 5, Heizung" → heute 3 Seiten abklappern); (2) tech-spec.md:936 listet GET /api/v1/search?q=... explizit als Stufe-1-Endpoint, Executive-Summary tech-spec.md:37 nennt „Globale Quick-Search (Volltext)" als Stufe-1-Feature mit NL-Search-Hook (503) für Stufe 2; (3) die ticket.nummer (fortlaufende, mandant-eindeutige Nummer, models/ticket.py:52,61) ist heute nicht suchbar — der häufigste Sucheinstieg fehlt. Infrastruktur vorhanden: CurrentUser mit mandant_id + roles + has_role() (core/deps.py:15-27), Deps CurrentUserDep + AuditedDbSession, Envelope PaginatedResponse (schemas/common). Im FE: React Router 7 (router.tsx) mit allen Detail-Routen (/tickets/:id, /stammdaten/partner/:id, /stammdaten/objekte/:id, /projekte/:id, /stammdaten/vorlagen/:id/bearbeiten), TanStack Query, sauberer api-client (api/endpoints.ts). pg_trgm-Extension existiert NOCH NICHT (letzte Migration 0028, kein CREATE EXTENSION / GIN-Index im Repo).

## 3. Scope — erste Ausbaustufe (Pilot)

- Backend: neuer GET /api/v1/search?q=...&limit_pro_typ=5&typen=... — ein Endpoint, der parallel die Kern-Entitäten durchsucht und gruppiert zurückgibt (data: { tickets: [...], objekte: [...], partner: [...], adressen: [...], anlagen: [...], fehlercodes: [...], vorlagen: [...], projekte: [...] }, je Gruppe top-N + has_more-Flag).
- Mandantenbindung HART je Query (current.mandant_id), Soft-Delete-Filter (deleted_at IS NULL) wie in den Listen — kein Cross-Mandant-Leak, analog Memory fk-mandant-validierung.
- Pro Treffer ein einheitliches SearchHit-Schema: typ, id, titel (Anzeigename), subtitel (Kontext, z.B. Objektname beim Ticket), badge (z.B. Status/Prio bei Tickets), deep_link-Pfad (z.B. /tickets/{id}).
- Suchfelder ERWEITERN ggü. heute, v.a. Ticket: titel + beschreibung + ticket.nummer (als String) — Nummer ist der häufigste Sucheinstieg; übrige Entitäten mit den bereits in den Listen vorhandenen Feldern (Wiederverwendung der Field-Sets aus den Services).
- DB: ILIKE (lower(...) LIKE %q%) als Basis; pg_trgm-Extension + GIN-Index nur auf die heißesten Felder (ticket.titel, partner.name) als optionale Migration, wenn das Trefferverhalten/Performance es verlangt — sonst reicht ILIKE auf Pilot-Datenmengen.
- Topbar-Trigger in AppLayout.tsx: Such-Button/Feld zentral in der Header-Zeile (Slot zwischen Greeting und Notifications), Shortcut ⌘K / Strg+K + '/' öffnet ein modales Overlay (globaler keydown-Listener im AppLayout).
- Such-Overlay (eigene Komponente, dnd-frei): Eingabefeld mit Debounce (~200ms, min. 2 Zeichen), TanStack-Query gegen /search, Treffer gruppiert nach Entität mit Gruppen-Überschrift + has_more-Hinweis ('Alle anzeigen' → Sprung in die jeweilige Liste mit vorbelegtem search-Param).
- Tastatur-Navigation: ↑/↓ über alle Gruppen hinweg, Enter = Deep-Link + Overlay schließen, Esc schließt, aktiver Treffer hervorgehoben; klick- und touch-tauglich (mobil über Lupe in der Topbar/BottomBar erreichbar).
- Frau-Zwittich-Schichtung respektieren: Suche selbst ist für beide Rollen ok (Stammdaten-Lookup), aber KEINE KI-/Ähnlichkeits-Spalte hier — das bleibt das Admin-Side-Panel; Rollen-Gating nur falls einzelne Entitäten technikerseitig nicht sichtbar sein sollen (offene Frage).
- Empty-/Loading-/No-Result-States + Mindest-Zeichen-Hinweis; Ergebnis-Limit je Gruppe klein halten (5) für schnelle Antwort.

**Bewusst NICHT jetzt (später / Nordstern):**

- KI-/NL-Search (natürlichsprachige Queries, Aggregationen, Embeddings) — bleibt Stufe-2-Hook (tech-spec.md:37,1232), Endpoint antwortet dort 503.
- Ähnliche-Tickets-/Lösungsvorschlag-Suche — separates Admin-Side-Panel mit Frau-Zwittich-Schichtung, nicht Teil der Quick-Search.
- Dokument-Volltext im Dateiinhalt (PDF-OCR, Embedding-Suche) — explizit Stufe 2 (plan.md:59). Stufe-1-Quick-Search durchsucht nur Dokument-Metadaten (Name), keine Dateiinhalte.
- Server-seitiges Relevanz-Ranking/Scoring über Entitätsgrenzen hinweg — Stufe 1 gruppiert nur, sortiert innerhalb der Gruppe simpel (z.B. Name/Recency).
- Gespeicherte Suchen / Such-Historie über localStorage hinaus, Suche-als-Filter-in-jeder-Liste-Power-Layout-Integration — kann später.
- Schartec-Import-/EBO-Fehlercode-Cluster-Suche — getrennte Roadmap.

## 4. Architektur-Skizze

Backend: Neues Modul api/v1/search.py (Router, prefix /search, in router.py registrieren) + services/search_service.py. search_service führt pro Entität eine schlanke SELECT … WHERE mandant_id = :m AND deleted_at IS NULL AND lower(feld) LIKE :q-Query mit LIMIT N+1 aus (N+1 → has_more). Bevorzugt asyncio.gather über die Einzel-Queries für Parallelität, alternativ ein UNION-ALL-Statement; für Stufe-1-Datenmengen ist die gather-Variante simpler und wartbar. Wiederverwendung der bereits existierenden Field-Sets aus den List-Services (keine Logik-Duplizierung — die Suchfelder zentral definieren, z.B. ein Mapping {Entität: [Spalten]}). Response folgt einem neuen Schema SearchResponse mit groups: list[SearchGroup{typ, label, hits: list[SearchHit], has_more}] (kein PaginatedResponse, da gruppiert). Auth/Scoping via CurrentUserDep, DB via DbSession (read-only; AuditedDbSession nicht nötig, Suche ist kein schreibender Audit-Event — aber konsistent zur restlichen API prüfen). Optionale Migration 0029_pg_trgm: CREATE EXTENSION IF NOT EXISTS pg_trgm + GIN-Index gin_trgm_ops auf ticket.titel/partner.name (idempotent, IF NOT EXISTS — Repo-Konvention CLAUDE.md §3). Frontend: (1) api/endpoints.ts → searchApi.query(q, opts); types.ts → SearchHit/SearchGroup/SearchResponse. (2) Neue Komponente components/GlobalSearch.tsx (Overlay) + Hook useGlobalSearch (TanStack Query, enabled wenn q.length>=2, keepPreviousData für flüssiges Tippen). (3) AppLayout.tsx: Such-Trigger im Header + globaler ⌘K/Strg+K/'/'-keydown-Listener (offen lassen, dass '/' nur außerhalb von Eingabefeldern feuert). (4) Deep-Link-Mapping typ→Route nutzt bestehende router.tsx-Pfade; 'Alle anzeigen' navigiert in die Liste mit ?search= bzw. setzt den vorhandenen List-Such-State. Mobil: Lupe in Topbar (lg:hidden) öffnet dasselbe Overlay. Kein neues Frontend-Package zwingend nötig (cmdk wäre Komfort, aber Eigenbau mit den vorhandenen Bordmitteln hält die Bundle-Size klein und vermeidet eine neue Dependency — Empfehlung: Eigenbau).

## 5. Offene Fragen — von Tim zu entscheiden

1. Entitäten-Umfang Stufe 1: alle 8 (Tickets, Objekte, Partner, Adressen, Anlagen, Fehlercodes, Vorlagen, Projekte) — oder zum Start auf die Top-4 (Tickets, Partner, Objekte, Projekte) begrenzen und Rest nachziehen? Empfehlung: mit Tickets+Partner+Objekte+Projekte+Adressen starten, Anlagen/Fehlercodes/Vorlagen direkt mitnehmen, da gleicher Mechanismus (geringer Mehraufwand).
2. Rollen-Sichtbarkeit: Soll der Techniker ALLE Entitäten in der Quick-Search sehen (inkl. Geschäftspartner/Adressen/Vorlagen) oder nur Tickets/Objekte? (Frau-Zwittich betrifft bisher nur die KI-Ähnlichkeitssuche, nicht reine Stammdaten-Lookups — daher Default: alles sichtbar, sofern du nicht widersprichst.)
3. Such-Algorithmus: schlichtes ILIKE-substring (findet 'müller' in 'Müllermann') reicht für den Pilot — oder direkt pg_trgm mit Tippfehler-Toleranz/Ranking (mehr Initialaufwand, ein Migrations-PR)? Empfehlung: ILIKE zuerst, pg_trgm als separater Folge-PR nur falls nötig.
4. ⌘K-Tastenbelegung: ⌘K/Strg+K plus '/' als Schnell-Fokus (wie GitHub) — oder nur der Button? Soll '/' wirklich global greifen (Risiko: stört Tippen in Textfeldern → wir würden es nur außerhalb von Inputs aktivieren)?
5. Treffer-Limit je Gruppe: 5 mit 'Alle anzeigen' (Empfehlung) — oder mehr direkt im Overlay?
6. Ticket-Anzeige im Treffer: Format der Nummer (z.B. '#1042' mandant-fortlaufend) — gibt es eine gewünschte Darstellung/Präfix?

## 6. Umsetzungsschnitt (Reihenfolge / PR-Pakete)

1. PR1 (Backend Kern): search_service.py mit zentralem Suchfeld-Mapping + gather-Queries je Entität (Tickets inkl. nummer), Schema SearchResponse/SearchGroup/SearchHit, api/v1/search.py + Router-Registrierung. Mandant- + Soft-Delete-Scoping. Integrationstests (Treffer je Typ, Cross-Mandant-Leak-Test, leere/zu-kurze Query).
2. PR2 (Frontend Overlay): searchApi + Typen, useGlobalSearch-Hook, GlobalSearch.tsx (Eingabe, Debounce, gruppierte Treffer, States), Tastatur-Navigation ↑/↓/Enter/Esc, Deep-Link-Mapping. Verdrahtung in AppLayout (Topbar-Button + ⌘K/Strg+K, Mobil-Lupe). Vitest/Playwright-Smoke für Öffnen→Tippen→Enter→Navigation.
3. PR3 (Feinschliff, optional): 'Alle anzeigen' → Liste mit vorbelegtem Suchfilter; Highlight des Suchbegriffs in Treffern; Recent-Searches (localStorage); ggf. Migration 0029_pg_trgm + GIN-Indizes, falls Performance/Tippfehler-Toleranz im Pilot Thema werden.
4. Vor Acceptance-Bitte: selbst E2E smoke-testen (curl /search?q=… mit Login-Token, Overlay-Klickflow) gemäß Memory selbst-testen-vor-tim.

## 7. Risiken

- Mandant-/Rollen-Leak: zentrale Suche fasst viele Entitäten an — jede Einzel-Query MUSS mandant_id-gebunden + soft-delete-gefiltert sein, sonst Cross-Mandant-Treffer (vgl. Memory fk-mandant-validierung). Dedizierter Leak-Test Pflicht.
- Performance/N+1: 8 parallele LIKE-Queries pro Tastendruck — Debounce + min. 2 Zeichen + kleines Per-Typ-Limit nötig; ohne pg_trgm-Index sind LIKE '%q%' nicht index-gestützt (Seq-Scan), bei Pilot-Datenmengen unkritisch, bei Wachstum GIN/pg_trgm nachrüsten.
- Globaler '/'-Shortcut kann Tippen in Formularen stören → nur außerhalb von Eingabefeldern aktivieren; ⌘K/Strg+K ist die sichere Variante.
- Deep-Link-Konsistenz: Routen-Mapping muss mit router.tsx synchron bleiben (z.B. Vorlagen → /stammdaten/vorlagen/:id/bearbeiten, nicht /:id) — bei Routen-Änderungen nachziehen (Memory konsistente-migration).
- Scope-Creep Richtung KI: Quick-Search NICHT mit Ähnlichkeits-/NL-Suche vermischen (Frau-Zwittich + Stufe-2-Hook), sonst Verstoß gegen Stufe-1-Schnitt.
- Doppelte Suchfeld-Definitionen: Felder zentral halten, damit Quick-Search und Listen nicht auseinanderlaufen (heute schon je Liste verschieden).

---

*Konzept zuerst. Bis zur Freigabe durch Tim: kein Code.*
