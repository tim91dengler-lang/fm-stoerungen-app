# FM-Störungsmanagement

Ticketsystem für Facility-Management-Betriebe — Pilot bei Joachim Löffler. Stufe 1 (MVP intern, 1 Mandant), gebaut nach den Konzepten in [`docs/`](docs/).

## Stand

- **Phase 0 — Setup** (aktuell): Repo angelegt, Konzepte übertragen, CI-Skelett, Infrastruktur folgt.
- **Phase 1 — Vertical Slices**: startet nach Phase-0-Abschluss + Hetzner-Zugang.
- **Pilot bei Joachim**: ~18–20 Wochen nach Phase-1-Start.

Status-Dokumente:
- [`docs/plan.md`](docs/plan.md) — fachliches Konzept v6 mit 4-Stufen-Modell
- [`docs/tech-spec.md`](docs/tech-spec.md) — Pflichtenheft v0.6 (Datenmodell, API, Sicherheit, Aufwand)
- [`docs/concepts/`](docs/concepts/) — KI-First-Architektur, Berechtigung, EBO-Fehlercodes
- [`docs/setup/phase-0-checklist.md`](docs/setup/phase-0-checklist.md) — Setup-Schritte (laufend)
- [`docs/adr/`](docs/adr/) — Architecture Decision Records
- [`docs/patterns/`](docs/patterns/) — Wiederverwendbare Patterns (Plattform-Anker)

## Architektur (Kurzfassung)

```
apps/web/        React 18 + Vite + Tailwind + PWA            (Frontend)
apps/api/        FastAPI + SQLAlchemy + Alembic              (Backend, Empfehlung — final TBD)
packages/shared/ Geteilte TypeScript-/JSON-Schemas           (FE↔BE-Verträge)
infra/docker/    docker-compose für Dev                       (Postgres + Keycloak + MinIO)
infra/hetzner/   Provisionierungs-Scripts für Prod            (Hetzner Cloud, Caddy, systemd)
docs/            Konzept-Dokumente + ADRs + Patterns
.github/         CI, Issue/PR-Templates, Workflows
```

**Bounded Contexts** (siehe [Plattform-Anker-ADR](docs/adr/0001-plattform-anker-strategie.md)):
- `core/` — wiederverwendbar, FM-frei (Listen, Auswahllisten, Adresse, Partner, RBAC, Audit, Notifications, …)
- `fm-tickets/` — anwendungsspezifisch (Ticket, Fehlercode, Objektstruktur, Wartet-Gründe)

Lint-Regel: `fm-tickets/` darf aus `core/` importieren, **nie umgekehrt**.

## Tech-Stack (Empfehlung, final-TBD)

Detail in [`docs/tech-spec.md`](docs/tech-spec.md) Kapitel 1.

| Schicht | Wahl | Begründung |
|---------|------|------------|
| Frontend | React 18 + Vite + Tailwind | ~80 % Mockup-Komponenten wiederverwendbar |
| Backend | FastAPI (Python) | Automatische OpenAPI, KI-Workloads in Stufe 2 nahtlos |
| Datenbank | PostgreSQL 16 + pgvector | Relationen + JSONB + Vektor-Suche |
| Auth | Keycloak (OIDC) | Mandantenfähig, Admin-UI |
| Object-Store | Hetzner Object Storage | Fotos, Dokumente |
| Hosting | Hetzner Cloud (DE) | EU, günstig, AVV-fähig |
| KI | Anthropic Claude (Haiku/Sonnet, EU-Endpoint) | für 3 Stufe-1-Use-Cases |

## Setup (für lokale Entwicklung)

> Phase 0 noch nicht abgeschlossen — Setup-Anleitung folgt nach erstem Skelett-Commit.

Geplant:

```powershell
git clone https://github.com/tim91dengler-lang/fm-stoerungen-app.git
cd fm-stoerungen-app
docker compose -f infra/docker/docker-compose.yml up -d
cd apps/api && uv sync && uv run uvicorn main:app --reload
cd ../web && pnpm install && pnpm dev
```

## Sicherheitsarchitektur

Dieses Projekt wird **ohne externen Senior-Entwickler-Review** gebaut (Tim-Entscheidung 2026-05-21). Stattdessen gilt die [12-Schichten-Sicherheitsarchitektur](docs/tech-spec.md#103-12-schichten-sicherheitsarchitektur-statt-senior-review) inkl. automatisierter Tests, CodeQL-Scan, Renovate-Bot, manueller Promote-Klick auf Produktion und externer Pen-Test vor Pilot-Go-Live.

## Lizenz & Eigentum

Privates Repo, Eigentum Tim Dengler. Lizenz für den entstehenden Code wird vor Pilot-Go-Live festgelegt (proprietär für Joachim-Pilot, später ggf. Open-Core).

## Kontakt

- **Eigentum/Strategie:** Tim Dengler (Tim Dengler Consulting)
- **Pilot-Kunde:** Joachim Löffler (FM-Betrieb)
- **Begleitung:** Aaron (gemeinsamer Kontakt)
