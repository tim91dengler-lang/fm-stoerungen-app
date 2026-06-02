# CLAUDE.md — Code-Repo `fm-stoerungen-app`

> Diese Datei ist die **Code-spezifische Anleitung** für Claude-Sessions, die in diesem Repo arbeiten. Sie wird zusätzlich zur globalen `~/.claude/CLAUDE.md` geladen.
>
> Beratungs-/Konzept-spezifische Regeln (Joachim-Kommunikation, Word-Deliverables) leben woanders — siehe `08_FM_ERP_app/CLAUDE.md` im Beratungs-Workspace auf Tims Windows-Server.

> **Stand:** 2026-06-02
> **Status:** Stufe 1 — MVP-Entwicklung, Pilot-Vorbereitung läuft

---

## 0. Definition of Done — vor JEDER „fertig"-Meldung (Pflicht)

> Diese 7 Punkte sind die am häufigsten verletzten Regeln. Sie stehen bewusst ganz oben.
> Punkt 1 wird vom **Stop-Hook** (`scripts/verify.sh`) mechanisch erzwungen — siehe `.claude/settings.json`.

1. **Lokal verifiziert = CI grün.** `scripts/verify.sh` ausgeführt, Exit 0 (spiegelt die CI-Gates 1:1). Insb. `npm run build` (= `tsc -b && vite build`) grün — nicht nur `vite build` / `typecheck` (Memory `web-build-tsc-b`).
2. **Format/Lint grün.** Backend `ruff check` + `ruff format --check` (Memory `backend-local-verify`), Frontend `eslint --max-warnings 0`. Kein „mach ich später".
3. **Keine nativen Controls.** Datum→`DatePicker`, Einzel-Auswahl→`EntitySearchSelect`, Multi→`MultiSelectCombobox`, Liste→`PowerListenView`. NIEMALS `<input type=date>`, `<select multiple>`, eigene `<table>`. Inventar: Skill `reuse-first` (Memory `detail-felder-keine-nativen-controls`).
4. **Selbst E2E-getestet** (Login + CRUD + Smoke), bevor Tim klickt. Tim ist Senior-Reviewer, nicht QA (Memory `selbst-testen-vor-tim`).
5. **Mandantentrennung geprüft.** Jeder user-gelieferte FK / jede Query gegen Cross-Mandant/IDOR abgesichert — fremde `mandant_id` ⇒ 404/403, nicht Treffer (Memory `fk-mandant-validierung`).
6. **Keine erfundenen Felder.** Nur Reales aus dem Datenmodell; Vorschläge als „(Vorschlag)" markieren und mit Tim klären.
7. **Modul-/Listen-/Detail-Arbeit?** Skill `modul-standard` genutzt + dessen Abnahme-Checkliste abgehakt.

---

## 1. Was dieses Repo ist

Code-Repo für das **FM-Ticketsystem** (Pilot bei Joachim Löffler). Mehr Kontext zur Beratungsseite (warum, für wen, kommerzieller Stand) im Beratungs-Workspace `08_FM_ERP_app/`.

Architektur und Scope: siehe **`docs/plan.md`** (fachliches Konzept v6) und **`docs/tech-spec.md`** (Pflichtenheft v0.6) — beides autoritativ.

## 2. Tech-Stack (entschieden, im Code umgesetzt)

| Schicht | Wahl |
|---------|------|
| Frontend | React 18 + Vite + Tailwind + PWA |
| Backend | FastAPI (Python 3.12) + SQLAlchemy + Alembic |
| Datenbank | PostgreSQL 16 + pgvector |
| Auth | Keycloak (OIDC), mandantenfähig |
| Object-Store | Hetzner Object Storage |
| Hosting | Hetzner Cloud DE (Falkenstein) |
| KI | Anthropic Claude (Haiku/Sonnet, EU-Endpoint) |
| Build-Tools | uv (Python), npm (Node) |

## 3. Architektur-Prinzipien

### Bounded Contexts (verbindlich)

- **`core/`** — FM-frei, wiederverwendbar (Listen, Auswahllisten, Adresse, Partner, RBAC, Audit, Notifications)
- **`fm-tickets/`** — FM-spezifisch (Ticket, Fehlercode, Objektstruktur, Wartet-Gründe)
- **Lint-Regel:** `fm-tickets/` darf aus `core/` importieren, **nie umgekehrt**
- Strategie: `core/` ist Plattform-Anker für spätere eigene Produkte (siehe `docs/adr/0001-plattform-anker-strategie.md`)

### API-First

Jedes UI (Web, später PWA, später Mieter-Portal) greift gegen dieselbe FastAPI. OpenAPI wird automatisch generiert.

### Migrationen — idempotent

Alembic. Migrationen müssen **idempotent** sein (siehe `track3-recovery`-Pattern in der Commit-Historie). Vor dem Schreiben neuer Migrationen:

- bestehende Migrationen anschauen, ob ähnliche Spalten woanders existieren
- `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` nutzen, wo möglich
- bei Junction-Tabellen mit Composite-PK den Audit-Trigger-Trick beachten (Memory `audit-trigger-junction-tables`, seit Migration 0012)
- **Konsistenz:** bei Feld-Änderungen ALLE Referenzen mitziehen (Formular, Anzeige, Filter, Suche, Mobile, Preview) — siehe Memory `konsistente-migration`

## 4. UI-Konvention für Listen-/Übersichtsansichten (verbindlich)

> **Master-Standard (ab 2026-06-02):** Der verbindliche Modul-Aufbau (Liste **und** Detail, Schichten-Modell,
> Block-Engine, Panel-vs-Seite, Verknüpfungen-als-Listen, „Historie"-Block) steht in
> `docs/concepts/Konzept_UIUX_MasterLayout_FINAL_2026-06-02.md`. **Bei jedem neuen/geänderten Modul den Skill
> `modul-standard` nutzen** (Bau-Vorlage + Abnahme-Checkliste). Der Abschnitt hier ist der Listen-Teil davon.

Jede Listen-/Übersichtsansicht muss diese vier Eigenschaften haben:

1. **Ausschließlich Listenansicht** (Tim 2026-06-02: keine Kachel-/Karten-Ansicht, kein ViewModeToggle).
2. **Gesamtfilter / Volltextsuche** oberhalb der Liste, durchsucht alle relevanten Felder einschließlich verknüpfter Stammdaten.
3. **Spaltenfilter** direkt unter Spaltenüberschriften, pro Spalte ein passender Filter (Text / Number ≥ / Select / Toggle). „Spalten-Filter zurücksetzen" nur sichtbar wenn aktiv. Im Ticket-Pool dynamisch (Filter rendert sich basierend auf sichtbaren Spalten).
4. **Spalten ein-/ausblendbar** — Spalten-Auswahl-Menü mit Checkbox-Liste und Default-Sichtbarkeiten. Bei neuen Views: `SPALTEN_DEFINITION` mit `default: true/false` je Spalte.

Plus **Treffer-Zähler** (`gefiltert / gesamt`) rechts oben in der Toolbar.

**Power-Layout** (Memory `power-layout-listen`): alle Listen bekommen Drag-Reorder, Gruppierungs-Zeile mit ↑↓-Pills, Multi-Sort per Shift+Klick mit 3-Klick-Reset, Bulk-Auswahl als Spalte, gespeicherte Ansichten.

**Filter-Typ passend zum Feld** (Memory `filter-passend-zum-feldtyp`): Auswahllisten-Felder bekommen Multi-Select-Filter, nicht Text-Input.

**Auswahllisten als Default** (Memory `auswahllisten-default`): alles Mehrfach-/Benutzerspezifische als konfigurierbare Auswahlliste, nicht hardcoden.

## 5. Track- und Release-Nomenklatur

- **`track-N`** = horizontale Streams nach `docs/plan.md` (track-3 = Partner-Modul)
- **`rN`** = Release-/Feature-Pakete innerhalb eines Tracks (r6c, r8, r9)
- Branch-Namen: `track-3-partner-tabs`, `r8-vorlagen-designer`
- Commit-Präfixe: `feat(scope)`, `fix(scope)`. Polish-Phasen: `feat(scope-polish)`, `feat(scope-polish-2)`

## 6. Sicherheits- und Codequalitäts-Regeln

- **DSGVO/IT-Security „by design"**, vor allem mit Blick auf Stufe 3 (externer Login)
- **Claude entwickelt eigenverantwortlich**, kein externer Senior-Review (Tim-Entscheidung 2026-05-21)

**12-Schichten-Sicherheitsarchitektur** (Detail in `docs/tech-spec.md` Kapitel 10):

1. **Automatisierte Tests** — Unit 80 %+, Integration je Endpoint, E2E (Playwright) für Top-10-Workflows
2. **Statische Code-Analyse in CI** — Semgrep (OWASP), Bandit (Python), npm audit, mypy strict, ruff/eslint strict
3. **CodeQL-Scan** (GitHub-native) für SQL-Injection, XSS, Auth
4. **Dependency-Scan** + Renovate-Bot mit Lockfile-Pflicht und CVE-Auto-Updates
5. **Pre-Commit-Hooks** gegen Secrets, Debug-Code, große Files
6. **PR-Selbstreview-Checkliste** (12 Punkte) — Claude füllt vor jedem Merge aus
7. **Staging-Spiegel** — jeder Merge auf Staging, Produktion erst nach **manuellem Promote-Klick durch Tim**
8. **Rollback-fähige Deployments** — Container-Versionen, automatisches DB-Backup vor jeder Migration (RTO < 5 min)
9. **Audit-Log alles** (append-only) + Sentry-Alerts bei 5xx
10. **Feature-Flags** für gestaffelten Roll-out (Tim → Joachim-Admin → alle)
11. **Externer Pen-Test** einmalig vor Pilot-Go-Live (~1.500 €, Spezialist)
12. **Tim als Acceptance-Reviewer** — UI-Klicks, Geschäftslogik-Validierung, Promote-Entscheidung

**Restrisiko:** subtile Lücken können trotz Schichten unentdeckt bleiben. Tim trägt das Risiko gegenüber Joachim.

## 7. Merge- und Deploy-Verantwortung (verbindlich, Tim-Entscheidung 2026-05-21)

| Stufe | Wer | Wann |
|------|-----|------|
| **PR-Merge auf `main`** | **Claude** | sobald CI grün ist (kein Tim-Klick nötig) |
| **Staging-Acceptance** | **Tim** | nach jedem Auto-Deploy — klickt Staging-URL, prüft Geschäftslogik |
| **Prod-Promote** | **Tim** | klickt `workflow_dispatch` in GitHub Actions („Promote → Production") |

Begründung: PR-Merge ist mechanisch (CI = technisches Gate). Tims Mensch-im-Loop bleibt da, wo er Wert stiftet: Funktional-Test auf Staging und finale Prod-Freigabe.

**Migration nach Deploy:** `deploy-staging.yml` fährt **automatisch** `migrate.sh` (pg_dump + `alembic upgrade head`) vor dem Container-Swap — keine manuelle Migration mehr nötig. Zusätzlich provisioniert ein Deploy-Schritt die Per-Mandant-Basisdaten (`provision_vorlagen`: Auswahllisten + Default-Vorlagen, pro Mandant abgesichert). SSH auf Staging nur noch für Inspektion/Debugging.

Gilt nur für dieses Repo (`fm-stoerungen-app`); andere Repos behalten klassischen PR-Workflow mit Tim-Merge.

## 8. Autonomer Senior-Dev-Modus (verbindlich, Tim-Entscheidung 2026-05-21)

Für dieses Repo arbeitet Claude **wie ein Senior-Entwickler**:

- Alle Bash-/SSH-/PowerShell-Befehle, die zur Umsetzung gehören, werden eigenständig ausgeführt — keine Frage-Pause pro Schritt
- Vor jeder Acceptance-Bitte an Tim: **selbst End-to-End smoke-testen** (curl, Login-Flow, CRUD). Tim ist Senior-Reviewer, kein QA (Memory `selbst-testen-vor-tim`)
- Konzept zuerst, Tim-Freigabe abwarten, dann autonom umsetzen
- Stoppen + nachfragen nur bei: harten Architektur-Weggabelungen, Kosten-relevanten Entscheidungen (Provider, Lizenz), Daten-irreversiblen Aktionen außerhalb des Repos
- Risiken transparent melden, aber nicht in „wartet auf Tim"-Pausen verwandeln — Vorschlag + Entscheidung in einem Aufwasch

## 9. Aktueller Setup-Status (Stand 2026-05-27)

**Entwicklungsumgebung:** Linux-Dev-Server bei Hetzner (`dev-server`, IP 46.224.46.112, fsn1). Tim verbindet sich via VS Code Remote-SSH vom Windows-Server aus. Lokales Docker läuft, `docker compose up` ist verfügbar.

**Stack installiert auf dem Linux-Dev-Server** (Detail in Memory `linux-dev-server`):

- Docker CE + Compose v5.1.4
- Python 3.12 + `uv` (Astral-Installer, in `~/.local/bin/`)
- Node.js LTS + `npm` (Lockfile: `apps/web/package-lock.json`; CI nutzt `npm ci`)
- GitHub CLI (`gh`), `psql`, `make`, `direnv`, `bat`, `fd`, `eza`
- Git-Config mit Tims Identität
- GitHub-SSH-Key (Public-Key in GitHub-Settings hinterlegt)

**Workflow:**

- Code lokal auf Linux ausführen, `docker compose -f infra/docker/docker-compose.yml up -d` für Postgres + ggf. Keycloak + MinIO
- E2E-Tests lokal via Playwright
- Push → CI (GitHub Actions) → Auto-Deploy auf Staging
- Staging-Inspektion via SSH + `docker exec` (Memory `migration-manuell-anwenden`)
- Prod-Promote = manueller Klick durch Tim in GitHub Actions

## 10. Wichtige Memory-Verweise

Memories werden pro Maschine und pro Projektpfad separat geschrieben. Auf dem Linux-Dev-Server entstehen sie unter `~/.claude/projects/home-tim-projects-fm-stoerungen-app/memory/`. Heute relevante Memories (auf Windows, hier referenziert weil noch nicht migriert):

- `linux-dev-server` — Verbindungsinfos, Stack, GitHub-SSH-Key
- `migration-manuell-anwenden` — `deploy-staging.yml` fährt kein Auto-Migration
- `audit-trigger-junction-tables` — Composite-PK-Trick (seit Migration 0012)
- `tanstack-grouping-loop` — Grouping in TanStack-Tables conditional aktivieren
- `power-layout-listen` — Listen-UX-Konvention
- `auswahllisten-default` — alles Konfigurierbare als Auswahlliste
- `filter-passend-zum-feldtyp` — Auswahllisten bekommen Multi-Select-Filter
- `konsistente-migration` — bei Feld-Änderungen ALLE Referenzen mitziehen
- `merge-verantwortung-fm` — Claude merget, Tim macht Acceptance + Promote
- `selbst-testen-vor-tim` — E2E vor Acceptance-Bitte

## 11. Dokument-Verweise im Repo

- `docs/plan.md` v6 — fachliches Konzept, 4-Stufen-Modell, Datenmodell-Skizzen
- `docs/tech-spec.md` v0.6 — Pflichtenheft, Datenmodell, API, Sicherheit, Aufwand
- `docs/adr/` — Architecture Decision Records (ADR-0001: Plattform-Anker-Strategie)
- `docs/patterns/` — Wiederverwendbare Patterns (Listen-UX, Audit, etc.)
- `docs/concepts/` — KI-First-Architektur, Berechtigung, EBO-Fehlercodes
- `docs/setup/phase-0-checklist.md` — Setup-Schritte
- `docs/setup/promote-to-prod.md` — Produktiv-Schalten-Doku

---

*Lebendig halten: Bei neuen Festlegungen (Tech, Stufe abgeschlossen, neue Constraints, neue Patterns) hier nachziehen. Bei größeren Architektur-Änderungen einen ADR unter `docs/adr/` anlegen.*
