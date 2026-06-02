# Konzept: Gespeicherte Ansichten dauerhaft (Server-Persistenz pro User + Liste)

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-02 — **Entwurf zur Abstimmung**
> **Status:** Konzept. **Bis zur Freigabe durch Tim: kein Produktiv-Code.**
> **Methodik:** Ist-Zustand mehrgleisig im Code recherchiert (Datei:Zeile-Belege), dann strukturierter Entwurf.
> **Bezug:** `docs/plan.md` (Roadmap), `docs/tech-spec.md` (Pflichtenheft), CLAUDE.md §4 (Listen-/UX-Konvention).
> **Aufwand (grob):** M

---

## 1. Ziel

Jeder User soll seine Listen so wiederfinden, wie er sie zuletzt eingestellt hat — über Logout/Login und über Geräte hinweg. Heute existiert die Server-Persistenz für BENANNTE Ansichten bereits, aber zwei Lücken bleiben: (1) die zuletzt aktive/ad-hoc eingestellte Ansicht überlebt den Re-Login NICHT (springt auf Code-Default zurück), und (2) die als Standard markierte Ansicht wird beim Öffnen der Liste nicht automatisch angewendet. Zielgruppe: Joachims FM-Disponenten/Hausmeister im Pilot (Stufe 1), die täglich denselben Ticket-Filterschnitt brauchen.

## 2. Ist-Zustand (heute im Code)

Server-Backend ist VOLLSTÄNDIG vorhanden und getestet — die Prämisse "nichts überlebt Re-Login" stimmt nur teilweise. Tabelle `gespeicherte_ansichten` (user_id, view_key, name, config JSONB, ist_default) existiert seit Migration 0002 (apps/api/alembic/versions/0002_slice2_stammdaten_auswahllisten.py:331), Model apps/api/src/fm_api/models/gespeicherte_ansicht.py:16, Service apps/api/src/fm_api/services/ansicht_service.py (list/create/update/delete, Default exklusiv pro view_key), Router apps/api/src/fm_api/api/v1/ansichten.py (GET/POST/PATCH/DELETE), 4 Integrationstests apps/api/tests/integration/test_ansichten.py:12-94. Frontend ruft den Server (NICHT localStorage): apps/web/src/api/endpoints.ts:262 ansichtenApi, Komponente apps/web/src/core/liste/SavedViewsMenu.tsx (TanStack-Query, create + delete). Eingebunden in 9 Listen (tickets, partner, projekte, fehlercodes, objekte, anlagen, users, adressen, dokumente) via toolbarLeft (z.B. apps/web/src/pages/TicketsListePage.tsx:737, apps/web/src/pages/PartnerPage.tsx:394). FAZIT: BENANNTE Ansichten überleben Re-Login (server-seitig). LÜCKEN: (a) `config` wird auf jeder Page mit `useState(DEFAULT_CONFIG)` initialisiert (TicketsListePage.tsx:425, PartnerPage.tsx:66) — der zuletzt aktive Stand (welche Ansicht war offen + ad-hoc-Anpassungen) ist nach Reload/Re-Login weg. (b) `ist_default` wird gespeichert (SavedViewsMenu.tsx:38) und angezeigt (:178), aber NIE beim Mount gelesen/angewendet — kein useEffect liest die Default-Ansicht, Grep nach ist_default in Pages = leer. (c) SavedViewsMenu kann nur NEU anlegen + löschen — kein "Diese Ansicht aktualisieren" (PATCH /ansichten/{id} existiert im Backend, wird im UI nicht genutzt). (d) Density lebt nur in localStorage pro Browser (PowerListenView.tsx:307/528), NICHT in der server-config und nicht geräteübergreifend. (e) Suchtext + activeViewId sind nicht Teil von `config`. (f) Scope ist nur user_id, kein mandant_id, kein Sharing-Feld (geprüft: leer).

## 3. Scope — erste Ausbaustufe (Pilot)

- Auto-Apply der Default-Ansicht beim Mount: useEffect liest aus dem bereits geladenen ansichtenApi.list(viewKey) die Ansicht mit ist_default=true und ruft applySavedConfig + setActiveViewId — falls keine Default existiert, greift DEFAULT_CONFIG wie heute.
- Letzten Arbeitsstand server-seitig persistieren: pro User+view_key eine implizite Ansicht (z.B. name '__last__' bzw. neues Flag ist_zuletzt) wird bei jeder config-Änderung debounced per PATCH/POST gespeichert und beim Mount (wenn keine Default-Ansicht aktiv gewählt) wiederhergestellt. Damit überlebt der zuletzt eingestellte Filter-/Sortier-/Spalten-Stand Logout/Login geräteübergreifend.
- Bestehende Ansicht aktualisieren: SavedViewsMenu bekommt pro Zeile eine Aktion 'Mit aktueller Ansicht überschreiben' (nutzt vorhandenes PATCH /ansichten/{id}) und 'Umbenennen' / 'Als Standard setzen' (PATCH ist_default).
- config-Schema vereinheitlichen + erweitern: search-Text und density mit in die gespeicherte config aufnehmen, damit eine benannte Ansicht den vollständigen Listen-Zustand kapselt (Spalten/Filter/Sortierung/Gruppierung/Reihenfolge/Suche/Density).
- Konsistente Einbindung über alle 9 Listen: shared Hook (z.B. useGespeicherteAnsicht(viewKey, defaultConfig)) der DEFAULT_CONFIG, activeViewId, Auto-Apply-Default und Last-State-Persistenz kapselt, damit jede Page identisch arbeitet (heute pro Page dupliziert).
- Versionierung der config gegen Schema-Drift: config-Objekt bekommt ein schema_version-Feld; unbekannte/veraltete Felder werden beim Apply tolerant gemergt (wie heute {...DEFAULT_CONFIG, ...saved}), damit alte gespeicherte Ansichten nach Spalten-Umbenennungen nicht brechen.

**Bewusst NICHT jetzt (später / Nordstern):**

- Ansichten teilen / mandant-weite Standard-Ansichten durch Admin (Sharing-Feld + mandant_id) — Stufe 2
- Ticket-Typ-spezifische Listen-Ansichten (plan.md:227, Reiter pro Tickettyp) — eigener Roadmap-Punkt, nicht Teil der Persistenz
- Server-seitige Filterung/Pagination der gespeicherten config-Filter (heute teils clientseitig in TanStack) — unverändert lassen
- Versionierte Historie/Undo von Ansichts-Änderungen

## 4. Architektur-Skizze

Backend bleibt weitgehend unverändert (Tabelle + Endpoints existieren). Datenmodell: gespeicherte_ansichten(user_id FK CASCADE, view_key str64, name str200, config JSONB, ist_default bool, UniqueConstraint user_id+view_key+name) — für den 'letzten Stand' entweder (Variante A) ein zusätzliches bool-Feld `ist_zuletzt` analog `ist_default` (Migration: ADD COLUMN IF NOT EXISTS, idempotent) plus Service-Logik 'genau eine ist_zuletzt pro user+view_key' wie bei ist_default; oder (Variante B) eine fest reservierte name='__last__' ohne Schema-Migration. Empfehlung: Variante A (sauberer, kein Magic-Name, in Liste filterbar/ausblendbar). Endpoints: vorhandene GET/POST/PATCH/DELETE reichen; ggf. PUT-Upsert für den Last-State (POST mit ist_zuletzt, das den bisherigen ersetzt). Frontend: neuer Core-Hook apps/web/src/core/liste/useGespeicherteAnsicht.ts kapselt config-State, Auto-Apply der Default-/Last-Ansicht beim Mount, debounced Persist des Last-State (z.B. 800ms), activeViewId-Verwaltung; SavedViewsMenu.tsx wird um Update/Umbenennen/Default-setzen erweitert (nutzt PATCH). config-Typ wird zu einem gemeinsamen ListViewConfig (sorting, visibility, columnFilters, columnOrder, grouping, search, density, schema_version) zentralisiert. Bezug zum Stack: TanStack-Query (Cache-Invalidierung wie bisher über queryKey ['ansichten', viewKey]), react-hook-form/zod nicht nötig, Persistenz async. Power-Layout-Konvention (CLAUDE.md §4) wird damit erstmals vollständig erfüllt: 'gespeicherte Ansichten' überleben Sessions und Geräte, nicht nur die benannten.

## 5. Offene Fragen — von Tim zu entscheiden

1. Letzter Arbeitsstand automatisch persistieren (jede Liste merkt sich den letzten Stand ohne Speichern-Klick) ODER nur explizit benannte Ansichten + Auto-Apply der gewählten Default? Empfehlung: automatischer Last-State + Default-Auto-Apply — maximaler 'es ist wie ich es verlassen habe'-Effekt.
2. Density in die server-config übernehmen (geräteübergreifend) oder pro Browser in localStorage belassen? Empfehlung: in die config, damit eine Ansicht vollständig ist.
3. Last-State-Persistenz via neues Feld ist_zuletzt (Migration, sauber) oder reservierter Name '__last__' (ohne Migration)? Empfehlung: Feld ist_zuletzt.
4. Ansichten teilen/Mandant-weit (z.B. Joachim-Admin legt 'Offene Heizungs-Tickets' für alle an) — jetzt schon oder Stufe 2? Empfehlung: Stufe 2 (Sharing-Feld + mandant_id später), Stufe 1 strikt pro User.
5. Soll der Auto-Apply der Default-Ansicht die URL-/Query-Param-Filter überschreiben oder respektieren (Deep-Links bleiben Vorrang)? Empfehlung: Query-Param hat Vorrang vor Default.

## 6. Umsetzungsschnitt (Reihenfolge / PR-Pakete)

1. PR 1 (Frontend, ohne Migration): Core-Hook useGespeicherteAnsicht + Auto-Apply der ist_default-Ansicht beim Mount; SavedViewsMenu um 'Aktualisieren/Umbenennen/Als Standard' (PATCH) erweitern. Pilotweise erst in TicketsListePage, E2E grün.
2. PR 2 (Frontend Roll-out): denselben Hook in die übrigen 8 Listen ziehen (PartnerPage, ProjektePage, FehlercodesPage, ObjektePage, AnlagenPage, UsersListePage, AdressenPage, DokumentePage) — config-Typ zentralisieren, search + density in config aufnehmen.
3. PR 3 (Backend + Frontend): Migration ADD COLUMN ist_zuletzt (idempotent, IF NOT EXISTS), Service-Logik 'eine ist_zuletzt pro user+view_key', Upsert-Endpoint/POST; Frontend persistiert Last-State debounced und stellt ihn beim Mount wieder her (wenn keine benannte Default aktiv).
4. PR 4 (Härtung): schema_version + tolerantes Merge beim Apply, Integrationstests für ist_zuletzt-Exklusivität, Playwright-E2E 'Filter setzen → Logout → Login → Stand ist wieder da'.

## 7. Risiken

- Schema-Drift: gespeicherte config referenziert Spalten-IDs, die nach Umbenennungen nicht mehr existieren — ohne tolerantes Merge + schema_version brechen alte Ansichten.
- Debounced Last-State-Persist kann viele PATCH-Calls + Audit-Log-Rauschen erzeugen — Debounce/Throttle nötig.
- Auto-Apply der Default-Ansicht kann mit Deep-Link-/Query-Param-Filtern kollidieren — Vorrang-Regel explizit definieren.
- Roll-out über 9 Pages mit heute dupliziertem config-State birgt Inkonsistenz — zentral im Hook kapseln (CLAUDE.md §4).
- Kein mandant_id auf gespeicherte_ansichten: bei späterem Sharing FK-Mandant-Validierung nachziehen (Memory fk-mandant-validierung).

---

*Konzept zuerst. Bis zur Freigabe durch Tim: kein Code.*
