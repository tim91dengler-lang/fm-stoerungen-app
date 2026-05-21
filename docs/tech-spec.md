# Tech-Spec Stufe 1 — FM-Ticketsystem (Joachim Löffler)

**Projekt:** 08_FM_ERP_app
**Stand:** 2026-05-20
**Adressat:** Senior-Entwickler (intern, soll Stufe 1 implementieren)
**Vorgängerdokumente:**
- [`01_plan/plan.md`](../01_plan/plan.md) — fachliches Konzept v3
- [`01_plan/Konzept_Berechtigung_und_EBO_Vorlagen_2026-05-19.md`](../01_plan/Konzept_Berechtigung_und_EBO_Vorlagen_2026-05-19.md) — RBAC und Fehlercode-Stammdaten
- [`01_plan/Konzept_KI_first_2026-05-19.md`](../01_plan/Konzept_KI_first_2026-05-19.md) — KI-Architektur (Stufe 1 nur als Hook vorbereitet, nicht aktiv)
- [`02_draft/fm-stoerungen/`](fm-stoerungen/) — Mockup-Stand, klickbarer React-Prototyp

> **Lesehinweis:** Dieses Dokument ist Pflichtenheft + Architektur-Brief. Tech-Stack-Entscheidungen sind als **Optionen mit Trade-offs** dargestellt — die Wahl pro Schicht trifft der Senior-Entwickler nach Review. Empfehlungen sind als „Empfehlung" markiert.
>
> Was **nicht** in Stufe 1 gehört: KI-Funktionen aktiv, EBO-Live-Anbindung, externe Logins (Mieter-Portal), feingranulares RBAC. Diese Punkte sind im Datenmodell und in der Architektur **vorbereitet** (Hooks, Schema-Spalten, Gateway-Stub), aber nicht implementiert.

---

## 0. Executive Summary

**Was zu bauen ist:** Eine produktive Stufe-1-Version des FM-Ticketsystems für einen Kunden (Joachim, ca. 10 Mitarbeitende). Ersetzt einen Mockup, dessen UX bereits in mehreren Demos validiert wurde. Pilotbetrieb auf einem Objekt-Portfolio mit gemischter Nutzung (Wohnanlage, Bürohaus, Logistik).

**Stufenmodell** (verbindlich, siehe [`01_plan/plan.md`](../01_plan/plan.md) v4 Abschnitt 4):

- Stufe 0 — Mockup ✅ (abgeschlossen)
- **Stufe 1 — MVP-Pilot bei Joachim** ← Scope dieses Dokuments
- Stufe 2 — Vollausbau intern + KI-Layer aktiv (Backlog)
- Stufe 2a — Mieter-Portal (optional, Backlog)
- Stufe 3 — Vermarktung & Plattform-Aktiv (Vision)

**Kern-Funktionsumfang Stufe 1:**
- Ticket-Lifecycle (Erfassung, Pool, Zuweisung, Status mit Wartet-auf-Sub-Grund inkl. Nachunternehmer-Detail, Erledigung) inklusive Multi-Foto + SVG-Annotationen
- Stammdaten: vierstufige Objektstruktur (Objekt → Haus → Stockwerk → Einheit) mit Grundriss-Upload + Pin pro Ticket, Geschäftspartner (n:m-Typen + n-Kontakte), Adressen als eigene Entität, Benutzer mit 2 Rollen aktiv
- Konfigurierbare Auswahllisten (Status, Prio, Kategorie, Wartet-Grund, Anlagen, Anrede, Kontaktrolle, …)
- Ticket-Vorlagen (3 feste Tickettypen mit Custom-Feldern in JSONB — kein Designer-UI), Projekte als Sammelposten, **Fehlercodes als Stammdaten** (Liste + Hydratation im Ticket; Schartec-Excel-Import-Workflow erst Stufe 2)
- Chat pro Ticket mit @-Mentions, In-App-Notifications, Browser-Push, Read-Receipts
- 2 Dashboards (Admin, Techniker)
- Globale Quick-Search (Volltext), NL-Search-Hook vorbereitet (Stufe 1: gibt 503)
- PWA mit Offline-Read-Fallback und Install-Prompt
- Outlook-`mailto:`-Trigger für Mails an Nachunternehmer
- Audit-Log auf Ticket-Ebene (im Backend, in der UI Stufe-1 unsichtbar)
- **Dokumente als eigene Stammdaten-Entität** (`dokument`-Tabelle): Drag-and-Drop von Dateien und Outlook-`.msg`/`.eml` am Ticket-Detail und im Anlegen-Modal, n:m-Verknüpfung zu Ticket/Projekt/Objekt/Partner, Deduplikation per SHA-256-Hash, eigener Stammdatenbereich mit Power-Layout-Liste, `.msg`/`.eml`-Parser für Absender/Betreff/Body/Anhänge. Foto-Galerie bleibt getrennt (Annotation-Workflow). Details Kapitel 2.7 + 8.x.
- **KI-Light produktiv:** API-Key-Admin-UI · LLM-Gateway mit Pseudonymisierungs-Layer aktiv · 3 Use Cases live (Schreibassistenz im Textfeld, Triage-Vorschlag im Anlegen-Modal, Ähnliche-Tickets-Suche als Admin-Side-Panel — Frau-Zwittich-Schichtung). Details Kapitel 6.

**Explizit nicht in Stufe 1** (mit Stufen-Zuordnung):
- **Erweiterte KI-Funktionen** → Stufe 2 (Stufe 1 hat KI-Light mit 3 Use Cases — siehe Kapitel 6 und letzter Punkt der Stufe-1-Liste oben): Auto-Klassifizierung als Online-Lern-Loop · NL-Search/Reporting mit Aggregationen · EBO-Filter-Layer mit Cluster/Self-Healing · Coach-Modus für Techniker · Mieter-Vorab-Triage · Smart Inbox · Bereitschafts-Briefing
- **Schartec-Excel-Import** als Workflow mit Mapping/Konflikt-UI → Stufe 2 (Fehlercode-Stammdatentabelle und manueller Anlegen vorhanden in Stufe 1)
- **EBO-Live-Anbindung** über OPC-UA/REST → Stufe 3 (mit vorgeschaltetem KI-Filter-Layer)
- **Mieter-Portal** mit externem Login + Vorab-Triage-Chatbot → Stufe 2a (optional)
- **Microsoft Graph** für direkten E-Mail-Versand → Stufe 2 (Stufe 1: nur `mailto:`-Trigger)
- **Vorlagen-Designer** für Tickettyp-Konfiguration → Stufe 2 (Stufe 1: drei feste Typen + JSONB-Custom-Felder pro Typ)
- **Reporting/Trends** jenseits Dashboard-KPIs → Stufe 2 (NL-Queries gegen Aggregationen)
- **Feingranulares RBAC** mit Custom-Rollen + Self-Service-Editor → Stufe 2 (Rollen-/Recht-Tabellen vorhanden, Stufe 1 hardcoded 2 Rollen)
- **Multi-Mandant aktiv** → Stufe 3 (Schema mandantenfähig ab Tag 1, Stufe 1 nur ein Mandant befüllt)
- **Native Mobile-Apps** → Stufe 3 bei Bedarf (Stufe 1: PWA installierbar reicht)
- **WebSocket-Realtime** → Stufe 2 (Stufe 1: Pull-Polling 15–30 s)
- **Predictive Maintenance**, KI Cross-Mandant, npm-Pakete für Plattform-Core → Stufe 3

**Architektur-Prinzipien:**
1. **API-First.** Backend exposes eine einzige REST-API, OpenAPI 3.1 als Vertrag. Frontend, mobile Web, später Mieter-Portal, später EBO-Inbound — alle konsumieren dieselbe API.
2. **Mandantenfähig ab Tag 1.** Jede Tabelle hat `mandant_id`. Stufe 1 nur ein Mandant befüllt, Datenmodell-Refactor entfällt.
3. **„Eingang" vs. „Bearbeitung" getrennt.** Quellen-Adapter (manuell, Telefon, Web; später EBO, Mieter) docken über ein einheitliches Inbound-Interface an den Pool an.
4. **Auswahllisten in Tabellen, nicht als ENUMs.** Status, Prio, Kategorie, … sind Stammdaten — pflegbar zur Laufzeit ohne Schema-Migration.
5. **Audit-Log Pflicht.** Jede Schreiboperation an Tickets, Stammdaten und Benutzern wird auditiert (mit User-, Rollen- und Aktionsbezug).
6. **DSGVO by design.** EU-Hosting, AVV, Verschlüsselung at-rest + in-transit, Pseudonymisierung am späteren KI-Gateway, Daten-Boundaries pro Endpoint.
7. **Vorbereitet für KI, vorbereitet für externe Rollen.** Schema-Spalten und API-Hooks für embedding-basierte Suche, RBAC und Mieter-Portal liegen, sind aber inaktiv. Stufe 2 ist eine Konfig-Aufgabe, kein Refactoring.
8. **Plattform-Ready (nicht Plattform-Aktiv).** Saubere Bounded Contexts trennen wiederverwendbaren Kern (`core/`) von Anwendungs-Code (`fm-tickets/`). Pattern-Library im Repo, ADRs mit `plattform-relevant`-Marker. Extraktion zu npm-Paketen erst bei App #2/#3 — keine Premature Generalization. Details siehe Kapitel 13.

**Open-Source-First, keine Lizenz-Lock-ins.** Wo immer möglich Open-Source-Komponenten in EU-Cloud betrieben.

---

## 1. Tech-Stack & Architektur

### 1.1 Architektur-Skizze (Ziel-Topologie Stufe 1)

```
                ┌──────────────────────────────────────────────┐
                │ Browser (Desktop / Mobile, installiert via PWA)│
                │  React 18 + Vite Frontend                    │
                └────────────────┬─────────────────────────────┘
                                 │ HTTPS, JWT in HttpOnly Cookie
                                 ▼
                ┌──────────────────────────────────────────────┐
                │ Reverse Proxy / TLS Termination (Caddy/Traefik)│
                └────────────────┬─────────────────────────────┘
                                 ▼
            ┌────────────────────┴───────────────────────┐
            │ Backend-API                                │
            │ (FastAPI / Fastify — siehe Optionen)       │
            │  - Auth (OIDC) + Session                   │
            │  - REST nach OpenAPI 3.1                   │
            │  - Domain-Services (Tickets, Stammdaten,   │
            │    Notifications, …)                       │
            │  - Inbound-Adapter (Mail, Web-Form)        │
            │  - KI-Gateway-Stub (für Stufe 2 reserviert)│
            │  - Audit-Logger (Append-Only)              │
            └─┬───────────────┬───────────────┬──────────┘
              │               │               │
              ▼               ▼               ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
    │ PostgreSQL 16 │  │ S3-kompat.   │  │ SMTP-Relay       │
    │ + pgvector    │  │ Object Store │  │ (Notifications,  │
    │   (Embeddings │  │ (Fotos,      │  │  Mail-Triage     │
    │   vorbereitet)│  │  Grundrisse) │  │  Stufe 2)        │
    └──────────────┘  └──────────────┘  └──────────────────┘
```

**Identitäten:**
- Frontend: PWA mit Service Worker (Workbox), installierbar auf iOS/Android/Desktop. Offline-Read-Fallback.
- Backend: Einzelner Service in Stufe 1 (kein Microservice-Sprawl), klar modularisiert nach Domain.
- DB: Single Postgres, Tablespaces für Hot/Cold-Trennung optional, pgvector-Extension von Beginn an installiert.
- Object-Store: S3-kompatibel (MinIO self-host oder Hetzner Object Storage), pre-signed URLs für Direct-Upload.
- Mail: SMTP-Relay für ausgehende Notifications + Stufe-2-Inbound. Outlook-Trigger über `mailto:`-Links benötigt kein Server-Setup.

### 1.2 Frontend — Optionen

| Option | Pro | Contra | Bewertung |
|--------|-----|--------|-----------|
| **A) React 18 + Vite** (wie Mockup) | direkt übernehmbar aus dem Mockup, ~12k Zeilen wiederverwendbar, Ökosystem riesig | Mockup ist monolithisch (eine Datei), braucht Refactor in Module | **Empfehlung** — minimiert Stufe-1-Risiko, da UX-validiert |
| B) Next.js 14 (App Router) | SSR, SEO, Auth-Patterns out of the box | SSR-Bedarf gering (interne App, nicht öffentlich), Lernkurve, Refactor des Mockups groß | Nicht empfohlen für Stufe 1 |
| C) SvelteKit | kleineres Bundle, schnelleres DX | Mockup-Migration kompletter Rewrite, Ökosystem kleiner | Nicht empfohlen |

**Begleit-Stack (alle Optionen):**
- TailwindCSS 3 (im Mockup verankert, keine Diskussion)
- lucide-react Icons
- recharts für Dashboards
- React Hook Form für Formulare (Mockup hat noch nichts — beim Refactor einführen)
- Zod für Schema-Validation (synchron mit OpenAPI-Schema)
- TanStack Query für Server-State / Caching (statt manuelles `useState`-Fetching)
- Workbox via `vite-plugin-pwa` (Mockup-Setup nutzen)

**Bundle-Strategie:** Code-Splitting nach Routes (Dashboard / Pool / Stammdaten / Vorlagen) — der Mockup hat aktuell 1 MB minified, das muss aufgeteilt werden.

### 1.3 Backend-Sprache & Framework — Optionen

| Option | Pro | Contra | Bewertung |
|--------|-----|--------|-----------|
| **A) Python + FastAPI** | Erstklassiges ML/KI-Ökosystem (für Stufe 2), automatische OpenAPI-Generierung aus Type-Hints, pydantic-Validation, async out of the box | Zwei-Sprachen-Setup (TS Frontend, Python Backend), Build-Tooling getrennt | **Vorschlag 1** — wenn KI-First-Pfad realistisch ist |
| **B) Node + Fastify** (TypeScript) | Single-Language-Stack mit Frontend, Shared Types via Monorepo, Fastify ist Performance-stark | Schwächeres ML-Ökosystem (Stufe-2-KI-Workloads landen ggf. in einem Side-Service), OpenAPI nicht automatisch | **Vorschlag 2** — wenn Mono-TypeScript bevorzugt wird |
| C) Node + NestJS | Strukturierter, „enterprise" | Mehr Overhead als Fastify, Decorator-Heavy, langsamer | Nicht empfohlen für 10-MA-Kunden |
| D) Go + Fiber/Echo | Performance-Spitze, statische Binaries | Kleineres Ökosystem für FM-Anwendungen, Lernkurve, KI-Integration komplex | Nicht empfohlen für Stufe 1 |

**Entscheidungsfrage Senior-Entwickler:** A oder B. Hängt davon ab, wie nah die Stufe-2-KI-Workloads ans Backend gehört (FastAPI integriert Embeddings/Klassifikatoren direkt) oder ob ein separater Python-Inferenz-Service ohnehin in Stufe 2 entsteht (dann ist Fastify im Backend okay).

**Querschnitt für beide Optionen:**
- ORM/Query-Layer:
  - bei Python: SQLAlchemy 2.x (sync oder async) + Alembic für Migrationen
  - bei Node: Drizzle ORM oder Kysely (typsicher, schmal); kein Prisma (zu opinionated, Migration-Tooling rigide)
- Validation:
  - bei Python: pydantic v2
  - bei Node: Zod (auch im Frontend nutzbar → Shared Schemas im Monorepo)
- OpenAPI:
  - bei Python: automatisch aus FastAPI-Routes
  - bei Node: `@fastify/swagger` mit JSON-Schema oder `zod-to-openapi`
- Background-Jobs:
  - bei Python: Celery oder dramatiq, Redis als Broker
  - bei Node: BullMQ, Redis als Broker
- Realtime (für Chat / Notifications):
  - WebSocket via `fastapi.websockets` bzw. `@fastify/websocket`, Fallback auf Server-Sent-Events
  - Stufe 1 reicht Pull-Polling alle 30 s; WebSocket nur wenn Chat-Erlebnis spürbar leidet

### 1.4 Datenbank

**Empfehlung: PostgreSQL 16** (alternativlos für diesen Use Case).
- Relationale Mietverhältnisse, n:m-Beziehungen, Audit-Trails — Postgres-Heimspiel
- **pgvector-Extension** ab Tag 1 installiert (für Stufe-2-Embedding-Suche). Spalten `embedding_vec vector(384)` auf `ticket` und `fehlercode` reserviert, Stufe 1 lässt sie leer
- JSONB für flexible Felder (`tickettyp.pflichtfelder`, `ki_audit.payload`)
- Logical Replication für späteres Read-Replica / Backup-Strategie
- Backup: pgBackRest mit Object-Store-Target (Hetzner) — RPO 24 h ist für Stufe 1 ausreichend

**Verworfene Alternativen:**
- SQLite: nicht produktionsreif für Concurrent-Writes
- MySQL/MariaDB: schwächere JSONB-Implementierung, kein pgvector
- CockroachDB / Yugabyte: Overkill bei 10 MA

### 1.5 Auth — Optionen

| Option | Pro | Contra | Bewertung |
|--------|-----|--------|-----------|
| **A) Keycloak** (selbst gehostet, OIDC) | OSS, mandantenfähig, integrierte Userverwaltung, MFA, später externe IdPs anbindbar | Operativer Mehraufwand (separater Service, Updates) | **Empfehlung** — wenn Stufe 2 (Mieter-Portal) absehbar |
| B) Ory Kratos + Hydra | OSS, headless, kleinere Footprints | Mehr Konfig-Aufwand als Keycloak, Doku schwächer | Alternative |
| C) Auth.js (NextAuth) | leichtgewichtig, beliebt im Node-Stack | Kein eigener IdP — braucht externe Provider; Token-Verwaltung manuell | Nur, wenn extreme Schmalspur-Lösung gewünscht |
| D) Eigenes Auth aus pydantic/JWT bauen | volle Kontrolle | Verantwortung für Security-Hardening, MFA-Aufwand, kein Stufe-2-Pfad | **Nicht empfohlen** — DSGVO-Risiko, Wartungsaufwand |

**Entscheidungsfrage Senior-Entwickler:** Keycloak vs. Kratos. Empfehlung: Keycloak, weil eine fertige Admin-UI für Joachim-Admin nützlich ist.

**Anforderungen unabhängig vom Provider:**
- OIDC / OAuth2 Authorization Code Flow mit PKCE
- JWT als Access-Token, im **HttpOnly-Cookie**, nicht in LocalStorage
- Refresh-Token-Rotation
- MFA Pflicht für Admin-Rolle (TOTP minimum, WebAuthn empfohlen)
- Session-Timeout konfigurierbar
- Audit-Log für Login-Events (erfolg/fehl)

### 1.6 Object-Store

**Empfehlung: MinIO** (S3-kompatibel, self-host in der gleichen Cloud wie Postgres) oder **Hetzner Object Storage**.

- Direct-Upload aus dem Browser via Pre-Signed URLs (entlastet Backend)
- Server-Side-Encryption (SSE-S3) verpflichtend
- Lifecycle-Policy für „Soft-Delete" (Ticket-Foto bleibt 30 Tage erreichbar nach Lösch-Marke, dann hard-delete)
- Strukturierung: `mandant_id/objekt_id/ticket_id/foto_id` als Key-Prefix

### 1.7 Hosting — Optionen

| Option | Pro | Contra | Bewertung |
|--------|-----|--------|-----------|
| **A) Hetzner Cloud (DE/Helsinki)** | EU-Hoster, günstig, AVV-fähig, Server + Object Storage + Volumes aus einer Hand | Kein managed Postgres (selbst hosten) | **Empfehlung** für Stufe 1 |
| B) Azure (West Europe) | Managed Postgres, Managed Container Apps, integriertes Monitoring | Teurer, Vendor-Lock-in-Risiko | Alternative bei höheren Compliance-Anforderungen |
| C) On-Premise bei Joachim | volle Datenkontrolle | Joachim ist FM-Betrieb, keine IT-Mannschaft; Update-Operations problematisch | **Nicht empfohlen** |
| D) Scaleway | EU-Hoster, modernere Managed-Services | Höhere Preise als Hetzner | Backup-Option |

**Container vs. Bare:** Docker-Compose für Dev, in Prod **Hetzner Cloud + Docker-Compose über Systemd** (klein und übersichtlich) **oder** k3s-Cluster (wenn Senior-Entwickler k8s-affin ist). Kubernetes ist für 10 MA Overkill, aber legitim wenn Skalierung Stufe 2+ ohnehin kommt.

### 1.8 Entwicklungsumgebung

- **Repo-Struktur:** Monorepo (pnpm-Workspaces oder uv-Workspaces) mit `apps/web` (Frontend), `apps/api` (Backend), `packages/shared` (Schemas, Types). Nur ein Repo, ein CI.
- **Container-Dev:** `docker-compose.yml` mit Postgres + MinIO + Backend-Live-Reload, Frontend per Vite-Dev-Server. Onboarding für neuen Entwickler ≤ 10 Min: `git clone && docker compose up && pnpm dev`.
- **Coding-Standards:**
  - bei Python: black + ruff + mypy (strict), pre-commit-hook
  - bei Node: ESLint + Prettier + TypeScript strict
- **Editor:** VS Code mit `.vscode/extensions.json` und `settings.json` im Repo (gemeinsame Defaults).

---

## 2. Datenmodell (SQL-DDL)

Komplettes Schema für Stufe 1. Tabellen sind in logische Gruppen geteilt. Indices, Constraints, Audit-Trigger als Hinweis am Ende jeder Gruppe.

> **Konventionen:**
> - PostgreSQL 16 Syntax
> - Alle Tabellen haben `mandant_id UUID NOT NULL`, `erstellt_am`, `geaendert_am` (außer reine Stammdaten-Auswahllisten)
> - PK als `id UUID DEFAULT gen_random_uuid()`, außer wo fachliche ID stabiler ist (z. B. `T-2044` als String-PK auf `ticket`)
> - Soft-Delete via `geloescht_am TIMESTAMPTZ NULL` auf Datentabellen; Stammdaten nutzen `aktiv BOOLEAN`
> - FK-Constraints `ON DELETE RESTRICT`, außer wo explizit anders gewünscht
> - Audit-Trigger (siehe Kapitel 5.5) hängen an allen Schreib-Tabellen außer den Auswahllisten

### 2.1 Mandant, Benutzer, RBAC

```sql
CREATE TABLE mandant (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE,
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollen-Tabelle ist vorhanden, Stufe 1 nutzt nur 2 aktive Rollen
CREATE TABLE rolle (
  id           TEXT PRIMARY KEY,        -- 'admin','techniker','buero','mieter',...
  label        TEXT NOT NULL,
  beschreibung TEXT,
  aktiv        BOOLEAN NOT NULL DEFAULT FALSE,
  ist_system   BOOLEAN NOT NULL DEFAULT FALSE,
  reihenfolge  INT NOT NULL DEFAULT 0
);

-- Recht & rolle_recht vorhanden, in Stufe 1 nicht für Logik genutzt (vorbereitet)
CREATE TABLE recht (
  id                TEXT PRIMARY KEY,    -- 'tickets.bearbeiten','stammdaten.objekte.lesen',...
  bereich           TEXT NOT NULL,
  aktion            TEXT NOT NULL,
  label             TEXT NOT NULL,
  unterstuetzt_scope TEXT[] DEFAULT ARRAY['alle']::TEXT[]
);

CREATE TABLE rolle_recht (
  rolle_id  TEXT NOT NULL REFERENCES rolle(id),
  recht_id  TEXT NOT NULL REFERENCES recht(id),
  scope     TEXT NOT NULL DEFAULT 'alle',
  PRIMARY KEY (rolle_id, recht_id)
);

CREATE TABLE benutzer (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id     UUID NOT NULL REFERENCES mandant(id),
  oidc_subject   TEXT UNIQUE,            -- IdP-Identität (Keycloak sub-claim)
  name           TEXT NOT NULL,
  email          CITEXT NOT NULL,
  telefon        TEXT,
  rolle_id       TEXT NOT NULL REFERENCES rolle(id),
  aktiv          BOOLEAN NOT NULL DEFAULT TRUE,
  initialen      TEXT NOT NULL,
  ist_bereitschaft BOOLEAN NOT NULL DEFAULT FALSE,
  erstellt_am    TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mandant_id, email)
);
CREATE INDEX idx_benutzer_mandant ON benutzer(mandant_id) WHERE aktiv;
```

### 2.2 Adressen, Objekte, Häuser, Stockwerke, Einheiten

```sql
CREATE TABLE adresse (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id    UUID NOT NULL REFERENCES mandant(id),
  strasse       TEXT NOT NULL,
  hausnummer    TEXT NOT NULL,
  adresszusatz  TEXT,
  plz           TEXT NOT NULL,
  ort           TEXT NOT NULL,
  land          CHAR(2) NOT NULL DEFAULT 'DE',
  bemerkung     TEXT,
  geo_lat       NUMERIC(9,6),
  geo_lon       NUMERIC(9,6),
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_adresse_plz_ort ON adresse(mandant_id, plz, ort);
CREATE INDEX idx_adresse_strasse_trgm ON adresse USING gin (strasse gin_trgm_ops);

CREATE TABLE objekt (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id    UUID NOT NULL REFERENCES mandant(id),
  name          TEXT NOT NULL,
  adresse_id    UUID REFERENCES adresse(id),
  notiz         TEXT,
  geloescht_am  TIMESTAMPTZ,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE haus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id    UUID NOT NULL REFERENCES mandant(id),
  objekt_id     UUID NOT NULL REFERENCES objekt(id),
  bezeichnung   TEXT NOT NULL,         -- 'Vorderhaus', 'Halle 1', ...
  adresse_id    UUID REFERENCES adresse(id),  -- NULL → erbt vom Objekt
  notiz         TEXT,
  reihenfolge   INT NOT NULL DEFAULT 0,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_haus_objekt ON haus(objekt_id, reihenfolge);

CREATE TABLE stockwerk (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id           UUID NOT NULL REFERENCES mandant(id),
  haus_id              UUID NOT NULL REFERENCES haus(id),
  bezeichnung          TEXT NOT NULL,        -- '3. OG', 'EG', '1. UG'
  ausrichtung          TEXT REFERENCES ausrichtung(id),
  grundriss_file_key   TEXT,                 -- S3-Key
  grundriss_mime       TEXT,
  eigentuemer_partner_id UUID REFERENCES geschaeftspartner(id),
  reihenfolge          INT NOT NULL DEFAULT 0,
  erstellt_am          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stockwerk_haus ON stockwerk(haus_id, reihenfolge);

CREATE TABLE einheit (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id             UUID NOT NULL REFERENCES mandant(id),
  stockwerk_id           UUID NOT NULL REFERENCES stockwerk(id),
  bezeichnung            TEXT NOT NULL,
  groesse_qm             NUMERIC(8,2),
  eigentuemer_partner_id UUID REFERENCES geschaeftspartner(id),
  reihenfolge            INT NOT NULL DEFAULT 0,
  erstellt_am            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_einheit_stockwerk ON einheit(stockwerk_id);
```

### 2.3 Geschäftspartner, n:m-Beziehungen

```sql
CREATE TABLE partnertyp (
  id           TEXT PRIMARY KEY,         -- 'mieter','eigentuemer','auftraggeber','nachunternehmer'
  label        TEXT NOT NULL,
  farbe        TEXT,
  icon         TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE geschaeftspartner (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id    UUID NOT NULL REFERENCES mandant(id),
  name          TEXT NOT NULL,
  adresse_id    UUID REFERENCES adresse(id),
  notiz         TEXT,
  geloescht_am  TIMESTAMPTZ,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gp_name_trgm ON geschaeftspartner USING gin (name gin_trgm_ops);

CREATE TABLE geschaeftspartner_typ (
  partner_id  UUID NOT NULL REFERENCES geschaeftspartner(id),
  typ_id      TEXT NOT NULL REFERENCES partnertyp(id),
  PRIMARY KEY (partner_id, typ_id)
);

CREATE TABLE anrede (
  id           TEXT PRIMARY KEY,         -- 'herr','frau','divers','firma','familie'
  label        TEXT NOT NULL,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE kontaktrolle (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  icon         TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE kontakt (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES geschaeftspartner(id) ON DELETE CASCADE,
  anrede_id     TEXT REFERENCES anrede(id),
  titel         TEXT,
  vorname       TEXT,
  nachname      TEXT,
  rolle_id      TEXT REFERENCES kontaktrolle(id),
  email         CITEXT,
  telefon       TEXT,
  mobil         TEXT,
  telefax       TEXT,
  ist_primaer   BOOLEAN NOT NULL DEFAULT FALSE,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kontakt_partner ON kontakt(partner_id);

-- n:m Beziehungen Objekt/Einheit/Stockwerk → Partner
CREATE TABLE objekt_partner (
  objekt_id   UUID NOT NULL REFERENCES objekt(id) ON DELETE CASCADE,
  partner_id  UUID NOT NULL REFERENCES geschaeftspartner(id) ON DELETE CASCADE,
  PRIMARY KEY (objekt_id, partner_id)
);

CREATE TABLE einheit_mieter (
  einheit_id  UUID NOT NULL REFERENCES einheit(id) ON DELETE CASCADE,
  partner_id  UUID NOT NULL REFERENCES geschaeftspartner(id),
  PRIMARY KEY (einheit_id, partner_id)
);

CREATE TABLE stockwerk_mieter (
  stockwerk_id UUID NOT NULL REFERENCES stockwerk(id) ON DELETE CASCADE,
  partner_id   UUID NOT NULL REFERENCES geschaeftspartner(id),
  PRIMARY KEY (stockwerk_id, partner_id)
);
```

### 2.4 Auswahllisten (konfigurierbare Stammdaten)

```sql
CREATE TABLE status (
  id                  TEXT PRIMARY KEY,
  label               TEXT NOT NULL,
  rolle               TEXT NOT NULL,          -- 'eingang','bearbeitung','wartend','abgeschlossen'
  farbe               TEXT,
  icon                TEXT,
  reihenfolge         INT NOT NULL DEFAULT 0,
  aktiv               BOOLEAN NOT NULL DEFAULT TRUE,
  ist_default         BOOLEAN NOT NULL DEFAULT FALSE,
  fordert_wartet_grund BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE prio (
  id                    INT PRIMARY KEY,
  label                 TEXT NOT NULL,
  farbe                 TEXT,
  stufe                 INT NOT NULL,
  ist_default           BOOLEAN NOT NULL DEFAULT FALSE,
  aktiv                 BOOLEAN NOT NULL DEFAULT TRUE,
  bereitschafts_alarm   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE kategorie (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  icon         TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE,
  ist_default  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE wartet_grund (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  beschreibung TEXT,
  icon         TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE anlage (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  beschreibung TEXT,
  icon         TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE eingangskanal (
  id     TEXT PRIMARY KEY,            -- 'telefon','manuell','email','web','ebo','mieter'
  label  TEXT NOT NULL,
  aktiv  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE ausrichtung (
  id           TEXT PRIMARY KEY,        -- 'ost','west','nord','sued'
  label        TEXT NOT NULL,
  kuerzel      CHAR(1),
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE projekt_status (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  rolle        TEXT NOT NULL,           -- 'geplant','aktiv','abgeschlossen','abgebrochen'
  farbe        TEXT,
  ist_default  BOOLEAN NOT NULL DEFAULT FALSE,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE projekttyp (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  farbe        TEXT,
  icon         TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE
);
```

### 2.5 Tickettypen (Vorlagen) und Fehlercodes

```sql
CREATE TABLE tickettyp (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  beschreibung    TEXT,
  farbe           TEXT,
  icon            TEXT,
  system_felder   JSONB NOT NULL,          -- { feldId: {sichtbar, pflicht} }
  custom_felder   JSONB NOT NULL DEFAULT '[]',
  feldreihenfolge TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
  reihenfolge     INT NOT NULL DEFAULT 0
);

CREATE TABLE fehlercode (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id           UUID NOT NULL REFERENCES mandant(id),
  code                 TEXT NOT NULL,            -- 'RLT-3471'
  titel                TEXT NOT NULL,
  beschreibung         TEXT,
  loesung              TEXT,                     -- Sichtbarkeit über RBAC geregelt (Frau-Zwittich-Regel)
  kategorie_id         TEXT REFERENCES kategorie(id),
  prio_default         INT REFERENCES prio(id),
  tickettyp_default    TEXT REFERENCES tickettyp(id),
  wartet_grund_default TEXT REFERENCES wartet_grund(id),
  anlage_id            TEXT REFERENCES anlage(id),
  objekt_id            UUID REFERENCES objekt(id),
  tags                 TEXT[] DEFAULT ARRAY[]::TEXT[],
  quelle               TEXT NOT NULL DEFAULT 'intern',  -- 'schartec','intern','manuell'
  aktiv                BOOLEAN NOT NULL DEFAULT TRUE,
  nutzung_count        INT NOT NULL DEFAULT 0,
  letzte_nutzung_am    TIMESTAMPTZ,
  embedding_vec        VECTOR(384),              -- pgvector, in Stufe 1 leer
  erstellt_am          TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mandant_id, code)
);
CREATE INDEX idx_fehlercode_kategorie ON fehlercode(mandant_id, kategorie_id) WHERE aktiv;
CREATE INDEX idx_fehlercode_embedding ON fehlercode USING hnsw (embedding_vec vector_cosine_ops);

-- Import-Audit (für Schartec-Excel-Import, Stufe 2 aktiv genutzt)
CREATE TABLE fehlercode_import (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id               UUID NOT NULL REFERENCES mandant(id),
  durchgefuehrt_von_user_id UUID REFERENCES benutzer(id),
  durchgefuehrt_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  quelle_datei_name        TEXT,
  neu_count                INT NOT NULL DEFAULT 0,
  aktualisiert_count       INT NOT NULL DEFAULT 0,
  deaktiviert_count        INT NOT NULL DEFAULT 0,
  mapping_snapshot         JSONB
);
```

### 2.6 Projekte und Tickets

```sql
CREATE TABLE projekt (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id            UUID NOT NULL REFERENCES mandant(id),
  name                  TEXT NOT NULL,
  beschreibung          TEXT,
  objekt_id             UUID REFERENCES objekt(id),
  verantwortlich_user_id UUID REFERENCES benutzer(id),
  start_am              DATE,
  ende_am               DATE,
  status_id             TEXT NOT NULL REFERENCES projekt_status(id),
  typ_id                TEXT REFERENCES projekttyp(id),
  notizen               TEXT,
  geloescht_am          TIMESTAMPTZ,
  erstellt_am           TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket (
  id                          TEXT PRIMARY KEY,                -- 'T-2044' — fachliche ID
  mandant_id                  UUID NOT NULL REFERENCES mandant(id),
  tickettyp_id                TEXT NOT NULL REFERENCES tickettyp(id) DEFAULT 'reparatur',
  projekt_id                  UUID REFERENCES projekt(id),
  fehlercode_id               UUID REFERENCES fehlercode(id),
  fehlercode_snapshot         JSONB,                            -- Snapshot bei Hydratation
  titel                       TEXT NOT NULL,
  beschreibung                TEXT,
  objekt_id                   UUID NOT NULL REFERENCES objekt(id),
  haus_id                     UUID REFERENCES haus(id),
  stockwerk_id                UUID REFERENCES stockwerk(id),
  einheit_id                  UUID REFERENCES einheit(id),
  pin_x                       NUMERIC(5,2),                     -- 0..100, % auf Grundriss
  pin_y                       NUMERIC(5,2),
  partner_id                  UUID REFERENCES geschaeftspartner(id),
  kontakt_id                  UUID REFERENCES kontakt(id),
  anlage_id                   TEXT REFERENCES anlage(id),
  kategorie_id                TEXT NOT NULL REFERENCES kategorie(id),
  prio_id                     INT NOT NULL REFERENCES prio(id),
  status_id                   TEXT NOT NULL REFERENCES status(id),
  wartet_grund_id             TEXT REFERENCES wartet_grund(id),
  wartet_nachunternehmer_id   UUID REFERENCES geschaeftspartner(id),
  wartet_kontakt_name         TEXT,
  wartet_kontakt_telefon      TEXT,
  wartet_kontakt_email        TEXT,
  quelle_id                   TEXT NOT NULL REFERENCES eingangskanal(id),
  melder                      TEXT,
  zugewiesen_user_id          UUID REFERENCES benutzer(id),
  faelligkeit_am              DATE,
  wiederholung                TEXT DEFAULT 'einmalig',
  custom_values               JSONB DEFAULT '{}',
  embedding_vec               VECTOR(384),                       -- in Stufe 1 leer
  geloescht_am                TIMESTAMPTZ,
  erstellt_am                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am                TIMESTAMPTZ NOT NULL DEFAULT now(),
  erledigt_am                 TIMESTAMPTZ,
  CHECK (wartet_grund_id IS NULL OR status_id IN (SELECT id FROM status WHERE fordert_wartet_grund))
);
CREATE INDEX idx_ticket_mandant_status ON ticket(mandant_id, status_id) WHERE geloescht_am IS NULL;
CREATE INDEX idx_ticket_zugewiesen ON ticket(zugewiesen_user_id) WHERE geloescht_am IS NULL AND status_id <> 'erledigt';
CREATE INDEX idx_ticket_objekt ON ticket(objekt_id);
CREATE INDEX idx_ticket_partner ON ticket(partner_id);
CREATE INDEX idx_ticket_embedding ON ticket USING hnsw (embedding_vec vector_cosine_ops);
CREATE INDEX idx_ticket_titel_trgm ON ticket USING gin (titel gin_trgm_ops);
```

### 2.7 Chat, Audit, Notifications, Fotos

```sql
-- Chat: sichtbare Konversation pro Ticket
CREATE TABLE ticket_message (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     TEXT NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES benutzer(id),
  text          TEXT NOT NULL,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_message_ticket ON ticket_message(ticket_id, erstellt_am);

CREATE TABLE ticket_mention (
  message_id  UUID NOT NULL REFERENCES ticket_message(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES benutzer(id),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE ticket_message_read (
  message_id  UUID NOT NULL REFERENCES ticket_message(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES benutzer(id),
  gelesen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Audit: maschinen-generierter Verlauf (Status-Wechsel, Zuweisung, …)
CREATE TABLE ticket_verlauf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       TEXT NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  aktor_user_id   UUID REFERENCES benutzer(id),
  aktor_rolle_id  TEXT REFERENCES rolle(id),
  typ             TEXT NOT NULL,         -- 'status_wechsel','zuweisung','foto','system'
  text            TEXT NOT NULL,
  payload         JSONB,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_verlauf_ticket ON ticket_verlauf(ticket_id, erstellt_am);

-- System-Audit: schreibende Vorgänge auf allen Tabellen
CREATE TABLE system_audit (
  id              BIGSERIAL PRIMARY KEY,
  mandant_id      UUID NOT NULL,
  aktor_user_id   UUID,
  aktor_rolle_id  TEXT,
  tabelle         TEXT NOT NULL,
  datensatz_id    TEXT NOT NULL,
  aktion          TEXT NOT NULL,         -- 'insert','update','delete'
  vorher          JSONB,
  nachher         JSONB,
  zeit            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_audit_tabelle ON system_audit(tabelle, datensatz_id, zeit);
CREATE INDEX idx_system_audit_mandant_zeit ON system_audit(mandant_id, zeit);

CREATE TABLE notification (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES benutzer(id),
  ticket_id         TEXT REFERENCES ticket(id) ON DELETE CASCADE,
  typ               TEXT NOT NULL,        -- 'mention','zuweisung','status','chat','wartung_faellig'
  text              TEXT NOT NULL,
  ref_message_id    UUID REFERENCES ticket_message(id) ON DELETE SET NULL,
  ausloeser_user_id UUID REFERENCES benutzer(id),
  gelesen           BOOLEAN NOT NULL DEFAULT FALSE,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_user_ungelesen ON notification(user_id, gelesen, erstellt_am DESC) WHERE NOT gelesen;

CREATE TABLE ticket_foto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       TEXT NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  storage_key     TEXT NOT NULL,         -- S3-Key
  mime            TEXT NOT NULL,
  groesse_bytes   BIGINT,
  hochgeladen_von UUID NOT NULL REFERENCES benutzer(id),
  annotationen    JSONB DEFAULT '[]',    -- SVG-Overlay-Daten
  hochgeladen_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_foto_ticket ON ticket_foto(ticket_id, hochgeladen_am);

-- Dokumente: eigenständige Entität, n:m zu Ticket/Projekt/Objekt/Partner
CREATE TABLE dokument_kategorie (
  id           TEXT PRIMARY KEY,           -- 'rechnung','wartungsvertrag','protokoll','korrespondenz','foto','sonstiges'
  label        TEXT NOT NULL,
  icon         TEXT,
  farbe        TEXT,
  reihenfolge  INT NOT NULL DEFAULT 0,
  aktiv        BOOLEAN NOT NULL DEFAULT TRUE,
  ist_default  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE dokument (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandant_id      UUID NOT NULL REFERENCES mandant(id),
  dateiname       TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  mime            TEXT NOT NULL,
  groesse_bytes   BIGINT NOT NULL,
  hash_sha256     TEXT NOT NULL,           -- Deduplikation: gleiche Datei nicht zweimal
  quelle          TEXT NOT NULL,           -- 'drag_drop','upload','email_anhang','ebo','manuell'
  kategorie_id    TEXT REFERENCES dokument_kategorie(id),
  beschreibung    TEXT,
  email_meta      JSONB,                   -- nur bei quelle in ('drag_drop','email_anhang') mit .msg/.eml: { absender, betreff, gesendet_am, body_text }
  hochgeladen_von UUID NOT NULL REFERENCES benutzer(id),
  hochgeladen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  geloescht_am    TIMESTAMPTZ,
  embedding_vec   VECTOR(384),             -- für Stufe-2-Volltextsuche, in Stufe 1 leer
  UNIQUE (mandant_id, hash_sha256)         -- Deduplikation pro Mandant
);
CREATE INDEX idx_dokument_mandant_zeit ON dokument(mandant_id, hochgeladen_am DESC) WHERE geloescht_am IS NULL;
CREATE INDEX idx_dokument_kategorie ON dokument(mandant_id, kategorie_id) WHERE geloescht_am IS NULL;
CREATE INDEX idx_dokument_dateiname_trgm ON dokument USING gin (dateiname gin_trgm_ops);
CREATE INDEX idx_dokument_embedding ON dokument USING hnsw (embedding_vec vector_cosine_ops);

-- n:m-Verknüpfungen Dokument ↔ Bezugsobjekt
CREATE TABLE dokument_ticket (
  dokument_id  UUID NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
  ticket_id    TEXT NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  verknuepft_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dokument_id, ticket_id)
);
CREATE INDEX idx_dokument_ticket_ticket ON dokument_ticket(ticket_id);

CREATE TABLE dokument_projekt (
  dokument_id  UUID NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
  projekt_id   UUID NOT NULL REFERENCES projekt(id) ON DELETE CASCADE,
  verknuepft_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dokument_id, projekt_id)
);

CREATE TABLE dokument_objekt (
  dokument_id  UUID NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
  objekt_id    UUID NOT NULL REFERENCES objekt(id) ON DELETE CASCADE,
  verknuepft_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dokument_id, objekt_id)
);

CREATE TABLE dokument_partner (
  dokument_id  UUID NOT NULL REFERENCES dokument(id) ON DELETE CASCADE,
  partner_id   UUID NOT NULL REFERENCES geschaeftspartner(id) ON DELETE CASCADE,
  verknuepft_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dokument_id, partner_id)
);
```

**Anmerkungen zum Dokument-Modell:**
- **Deduplikation:** SHA-256 über Dateiinhalt. Wenn dieselbe Datei zum zweiten Mal hochgeladen wird, wird kein neuer `dokument`-Eintrag angelegt, sondern nur die n:m-Verknüpfung zum neuen Bezugsobjekt — spart Storage, verhindert Versions-Wildwuchs.
- **E-Mail-Parsing:** Bei Drop von `.msg` (Outlook Compound File) oder `.eml` (RFC 822) extrahiert ein Server-Parser Absender, Betreff, gesendetes Datum, Body und Anhänge. Body wandert in `email_meta`, Anhänge werden als eigene `dokument`-Einträge angelegt (Quelle `email_anhang`), Parent-Verknüpfung über ein zusätzliches JSONB-Feld `email_meta.parent_dokument_id` (Stufe-2-Verfeinerung — für Stufe 1 reicht: Anhänge separat, Bezug rein über gemeinsame Ticket-Verknüpfung).
- **Foto-Galerie bleibt getrennt:** `ticket_foto` hat den Annotation-Workflow (SVG-Overlay) — bewusste Trennung. Drag-Drop-Zone im Ticket-Detail leitet Bild-MIME-Types in `ticket_foto`, alles andere in `dokument`.
- **Storage:** S3-Key-Pfad `mandant_id/dokumente/jahr/monat/dokument_id/<dateiname>` — pre-signed URL für Direct-Upload.

### 2.8 KI-Audit (Schnittstelle reserviert, Stufe 1 leer)

```sql
CREATE TABLE ki_audit (
  id              BIGSERIAL PRIMARY KEY,
  mandant_id      UUID NOT NULL,
  user_id         UUID,
  use_case        TEXT NOT NULL,         -- 'triage','classify','similar_tickets',...
  modell          TEXT NOT NULL,         -- 'local-embed','claude-haiku-4-5','claude-sonnet-4-6'
  input_hash      TEXT,                  -- SHA256 vom (pseudonymisierten) Input
  input_token     INT,
  output_token    INT,
  kosten_cent     INT,
  confidence      NUMERIC(4,3),
  ergebnis_status TEXT,                  -- 'akzeptiert','abgelehnt','korrigiert','still'
  payload         JSONB,                 -- verschlüsselt (siehe Kapitel 5.4)
  zeit            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ki_audit_mandant_zeit ON ki_audit(mandant_id, zeit);
```

### 2.9 Datenmodell-Hinweise

- **Audit-Trigger:** Postgres-Trigger auf alle Schreib-Tabellen, die `system_audit` befüllen. Implementierungsvorschlag: ein generischer Trigger pro Tabelle, der mit `current_setting('app.user_id')` und `current_setting('app.rolle_id')` arbeitet (Session-Variablen, gesetzt vom Backend pro Request).
- **Row-Level-Security (RLS):** für Mandantentrennung. `ALTER TABLE ticket ENABLE ROW LEVEL SECURITY;` plus Policy `mandant_id = current_setting('app.mandant_id')::uuid`. Stufe 1 mit nur einem Mandanten aktiv, aber Policy ist Pflicht von Tag 1.
- **Soft-Delete-Pattern:** Datensätze werden nicht hart gelöscht, sondern `geloescht_am` gesetzt. Views (`v_ticket_aktiv`, `v_objekt_aktiv`) filtern automatisch. Hard-Delete nur bei DSGVO-Löschanfrage.
- **Embedding-Spalten leer in Stufe 1.** Werden in Stufe 2 vom KI-Gateway gefüllt; Stufe 1 ignoriert sie.

---

## 3. API-Design (OpenAPI 3.1, REST)

### 3.1 Grundprinzipien

- **OpenAPI-First.** Die OpenAPI-Spec (`apps/api/openapi.yaml` oder generiert aus Route-Definitionen) ist Vertrag zwischen Frontend und Backend. Aus ihr werden:
  - Swagger-UI-Doku (auto)
  - TypeScript-Client-SDK fürs Frontend (`openapi-typescript-codegen`)
  - JSON-Schema-Validation Frontend ↔ Backend (Zod-/pydantic-Modelle)
- **Versionierung:** Pfad-Präfix `/api/v1`. Breaking Changes nur in `v2`-Endpunkten.
- **Pagination:** Cursor-basiert (`?cursor=...&limit=50`), nicht Offset (Performance bei wachsenden Tabellen).
- **Filter & Sort:** generischer Query-Parameter `?filter[status]=neu&filter[prio]=1,2&sort=-prio_id,erstellt_am`.
- **Bulk-Endpunkte:** für jeden Schreib-Endpunkt eine Bulk-Variante (`POST /tickets/bulk`, `PATCH /tickets/bulk`). Frontend Power-Layout (siehe Memory-Konvention) braucht das.
- **Idempotenz:** `Idempotency-Key`-Header für POST-Endpunkte; Server cached die Response 24 h.
- **Realtime:** WebSocket-Endpoint `/api/v1/stream` (Server-Sent-Events als Fallback) für Chat-Live + Notifications.

### 3.2 Endpoint-Übersicht (Stufe 1, Auszug)

```
GET    /api/v1/me                          # eingeloggter User + Rolle + Permissions
POST   /api/v1/auth/logout

# Tickets
GET    /api/v1/tickets                     # mit Filter, Sort, Pagination
POST   /api/v1/tickets
GET    /api/v1/tickets/{id}
PATCH  /api/v1/tickets/{id}
DELETE /api/v1/tickets/{id}
POST   /api/v1/tickets/bulk
PATCH  /api/v1/tickets/bulk
POST   /api/v1/tickets/{id}/verlauf         # System schreibt; UI nur GET
GET    /api/v1/tickets/{id}/verlauf
GET    /api/v1/tickets/{id}/messages
POST   /api/v1/tickets/{id}/messages
PATCH  /api/v1/tickets/{id}/messages/{mid}/read
GET    /api/v1/tickets/{id}/fotos
POST   /api/v1/tickets/{id}/fotos           # nur Metadaten, Upload via Pre-Signed URL
DELETE /api/v1/tickets/{id}/fotos/{fid}

# Stammdaten
GET    /api/v1/objekte
POST   /api/v1/objekte
GET    /api/v1/objekte/{id}
PATCH  /api/v1/objekte/{id}
GET    /api/v1/objekte/{id}/baum            # vollständige Hierarchie
POST   /api/v1/objekte/{id}/haeuser
...

GET    /api/v1/partner
POST   /api/v1/partner
GET    /api/v1/partner/{id}
PATCH  /api/v1/partner/{id}
POST   /api/v1/partner/{id}/kontakte
PATCH  /api/v1/partner/{id}/kontakte/{kid}

GET    /api/v1/adressen
POST   /api/v1/adressen
PATCH  /api/v1/adressen/{id}

GET    /api/v1/benutzer
POST   /api/v1/benutzer
PATCH  /api/v1/benutzer/{id}

# Konfiguration / Auswahllisten
GET    /api/v1/config/auswahllisten         # alle Listen in einem Aufruf (initial-load)
PATCH  /api/v1/config/auswahllisten/{key}/werte/{id}

GET    /api/v1/tickettypen
POST   /api/v1/tickettypen
PATCH  /api/v1/tickettypen/{id}

GET    /api/v1/fehlercodes
POST   /api/v1/fehlercodes
PATCH  /api/v1/fehlercodes/{id}
POST   /api/v1/fehlercodes/import           # Stufe-2-fähig; Stufe 1: manueller Import-CSV

# Dokumente (eigene Stammdaten-Entität)
GET    /api/v1/dokumente                    # Liste mit Filter (kategorie, quelle, ticket_id, projekt_id, …)
POST   /api/v1/dokumente                    # Metadaten anlegen, Upload via Pre-Signed URL
GET    /api/v1/dokumente/{id}
PATCH  /api/v1/dokumente/{id}
DELETE /api/v1/dokumente/{id}
POST   /api/v1/dokumente/parse-email        # .msg/.eml-Parser → strukturiertes Ergebnis (Absender, Betreff, Body, Anhänge)
GET    /api/v1/dokumente/{id}/verknuepfungen
POST   /api/v1/dokumente/{id}/verknuepfen   # n:m zu Ticket/Projekt/Objekt/Partner anlegen
DELETE /api/v1/dokumente/{id}/verknuepfen   # n:m lösen
GET    /api/v1/tickets/{id}/dokumente       # alle Dokumente an einem Ticket

# Projekte
GET    /api/v1/projekte
POST   /api/v1/projekte
...

# Notifications
GET    /api/v1/notifications
PATCH  /api/v1/notifications/{id}/read
POST   /api/v1/notifications/read-all

# Dashboard-Aggregationen
GET    /api/v1/dashboard/admin              # KPIs + Charts
GET    /api/v1/dashboard/techniker

# Suche
GET    /api/v1/search?q=...                 # Volltext, später KI-NL

# Files (Pre-Signed URL-Vermittlung)
POST   /api/v1/files/presigned-upload       # → URL für Direct-Upload zu S3
POST   /api/v1/files/presigned-download

# Realtime
WS     /api/v1/stream                       # Multi-Channel-Subscription

# KI-Gateway-Stub (Stufe 1 antwortet 503, Stufe 2 aktiv)
POST   /api/v1/ki/{use_case}
```

### 3.3 Schema-Patterns

- **Response-Envelope:** `{ "data": ..., "meta": { "cursor_next": ..., "total_estimate": ... } }`
- **Error-Envelope:** RFC 7807 (Problem Details). `{ "type": "...", "title": "...", "status": 400, "detail": "...", "instance": "..." }`
- **Optionale Felder:** explizit `null` statt Auslassen, damit Patch-Semantik klar bleibt.
- **PATCH-Semantik:** JSON Merge Patch (RFC 7396) oder partielles Schema mit allen Feldern als optional. Empfehlung: partielles Schema mit pydantic/Zod, weil Merge Patch bei verschachtelten Strukturen rumpelt.
- **Timestamps:** ISO 8601 UTC, `2026-05-20T08:42:13Z`. Frontend rechnet lokal.

### 3.4 Inbound-Adapter (für Stufe-2-Erweiterungen vorbereitet)

Damit später EBO, E-Mail-Inbox, Mieter-Portal andocken ohne Refactoring:

```python
# Konzept (Python-Pseudocode)
class InboundAdapter(Protocol):
    quelle: str             # 'ebo','email','mieter_portal','manuell'
    def parse(self, raw: bytes | dict) -> TicketCandidate: ...
    def validate(self, c: TicketCandidate) -> ValidationResult: ...

class TicketService:
    def from_inbound(self, candidate: TicketCandidate) -> Ticket:
        # Klassifizierung, Dedup, Pool-Eintrag
        ...
```

Stufe 1 implementiert nur `ManualInboundAdapter` (UI-Formular). Stufe 2 fügt `EboInboundAdapter` und `EmailInboundAdapter` hinzu.

---

## 4. Authentication & Authorization

### 4.1 Authentication (Stufe 1 produktiv)

- **Provider:** Keycloak (Empfehlung, siehe 1.5)
- **Flow:** OIDC Authorization Code mit PKCE
- **Token-Speicherung:** Access-Token als JWT in HttpOnly + Secure + SameSite=Strict-Cookie. Refresh-Token in separatem HttpOnly-Cookie. Kein Token in LocalStorage.
- **Session-Timeout:** 8 h idle, 24 h absolut (Refresh-Token-Lifetime)
- **MFA:** Pflicht für Admin-Rolle ab Tag 1 (TOTP minimum). Optional für Techniker.
- **Login-Audit:** alle Login-Events (success/fail) in `system_audit` mit IP und User-Agent.

### 4.2 Authorization (Stufe 1 schmal)

- Stufe 1 nutzt nur 2 aktive Rollen: `admin`, `techniker`. Die Rollen-Tabelle ist befüllt, weiteres deaktiviert.
- Berechtigungs-Logik im Backend:
  ```python
  @router.get("/objekte")
  @requires("stammdaten.objekte.lesen")
  async def list_objekte(...): ...
  ```
- Decorator/Middleware prüft `rolle_recht`-Tabelle. In Stufe 1 ist das ein konstantes Mapping (zwei Rollen × Rechte-Set). Architektur erlaubt späteres Auslagern in DB-Konfiguration (siehe Konzept Berechtigung Teil A).
- Frontend: `useRechte()`-Hook (im RBAC-Konzept definiert) ersetzt den Mockup-`istAdmin`-Pauschalcheck. Frontend prüft Sichtbarkeit; **Backend prüft jede Operation erneut**.

### 4.3 Scope-Checks (eigene vs. alle)

- Techniker hat `tickets.bearbeiten` mit Scope `eigene`. Backend-Check:
  ```python
  if rolle.recht("tickets.bearbeiten").scope == "eigene":
      query = query.where(Ticket.zugewiesen_user_id == current_user.id)
  ```
- Wichtig: **Server prüft nicht UI-Hide.** Wenn ein Techniker per API ein fremdes Ticket patcht, antwortet der Server mit 403.

---

## 5. Security & DSGVO

### 5.1 Transport- und Speicher-Verschlüsselung

- **TLS 1.3** zwischen Browser, Proxy, Backend, DB. Lets Encrypt via Caddy/Traefik.
- **at-rest:** Postgres-Volumes verschlüsselt (LUKS bei Hetzner). Object-Store SSE-S3.
- **Sensible Spalten zusätzlich applikationsseitig verschlüsselt:**
  - `kontakt.telefon`, `kontakt.email` (in Stufe 2 mit Mieter-Daten erweitert)
  - `ki_audit.payload`
  - Verschlüsselung mit `pgcrypto` oder symmetrisch im App-Layer (libsodium), Schlüssel in HashiCorp Vault oder Hetzner KMS-Äquivalent.

### 5.2 OWASP Top 10 — Stufe-1-Checkliste

| OWASP-Risiko | Maßnahme |
|---|---|
| A01 Broken Access Control | Backend-Authorization auf jedem Endpoint, Tests pro Recht, RLS in Postgres |
| A02 Cryptographic Failures | TLS 1.3, at-rest-Encryption, Argon2id für Passwort-Hashes (in Keycloak default) |
| A03 Injection | pydantic/Zod-Validation, parametrisierte SQL-Queries via ORM, Output-Encoding im Frontend (React-default-XSS-Schutz) |
| A04 Insecure Design | Threat-Modeling vor Stufe-1-Start, Architektur-Review |
| A05 Security Misconfiguration | Security-Headers (HSTS, CSP, X-Frame-Options, Referrer-Policy), keine Default-Credentials, regelmäßige Image-Updates |
| A06 Vulnerable Components | Dependabot/Renovate, `pip-audit` / `pnpm audit` im CI, SBOM-Generation |
| A07 Identification and Authentication Failures | Keycloak mit MFA, Rate-Limiting auf Login, Brute-Force-Detection |
| A08 Software and Data Integrity Failures | Signierte Container-Images (cosign), git-signed-commits empfohlen, GitHub-Actions OIDC statt Long-lived Secrets |
| A09 Security Logging and Monitoring Failures | strukturiertes Logging in JSON, Sentry für Errors, system_audit für Datenmanipulationen, Alerts bei Anomalien |
| A10 Server-Side Request Forgery | strikte URL-Allowlist bei Upload-Avatars / Bild-Fetch (Stufe 2 relevanter) |

### 5.3 Security-Headers (Reverse Proxy)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://*.<s3-host>; connect-src 'self' wss://<api-host>; style-src 'self' 'unsafe-inline'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=(self)
```

### 5.4 DSGVO

- **Rechtsgrundlage** der Verarbeitung dokumentieren (Vertragsdurchführung Joachim ↔ Auftraggeber; berechtigtes Interesse für interne Tickets)
- **AVV** zwischen Joachim und Hoster (Hetzner: AV-Vertrag online verfügbar), zwischen Joachim und Tims Beratung (separat)
- **Verzeichnis von Verarbeitungstätigkeiten** vorbereiten (Joachim braucht das ohnehin)
- **Löschkonzept:**
  - Personenbezogene Daten von Mietern: Aufbewahrung 6 Jahre (HGB) für abgerechnete Tickets, sonst 1 Jahr nach Ticket-Abschluss
  - Hard-Delete-Job läuft nächtlich, prüft `geloescht_am` + Retention-Policy pro Tabelle
  - Recht auf Löschung (Art. 17 DSGVO): Admin-UI für Löschanfragen
- **Recht auf Auskunft (Art. 15):** Export-Funktion pro Geschäftspartner / Benutzer als JSON-Download
- **Datenminimierung:** keine Felder, die nicht für den Zweck nötig sind (z. B. Geburtsdatum von Mietern wird nicht erfasst)
- **Pseudonymisierung am späteren KI-Gateway** (Kapitel 6)

### 5.5 Audit-Trail-Implementierung

Pro Schreib-Operation ein Eintrag in `system_audit` via Postgres-Trigger. Beispiel:

```sql
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO system_audit(mandant_id, aktor_user_id, aktor_rolle_id, tabelle, datensatz_id, aktion, vorher, nachher, zeit)
  VALUES (
    COALESCE(NEW.mandant_id, OLD.mandant_id),
    NULLIF(current_setting('app.user_id', TRUE), '')::UUID,
    NULLIF(current_setting('app.rolle_id', TRUE), ''),
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

Backend setzt `app.user_id` und `app.rolle_id` pro Connection-Acquire:
```python
async with db.transaction():
    await db.execute("SELECT set_config('app.user_id', :uid, true)", uid=current_user.id)
    await db.execute("SELECT set_config('app.rolle_id', :rid, true)", rid=current_user.rolle_id)
    ...
```

---

## 6. KI-Light in Stufe 1 (aktiv) + Hooks für Stufe 2

Stufe 1 enthält einen **schmalen, produktiv genutzten KI-Layer** mit drei Use Cases. Die restlichen Use Cases aus dem [KI-First-Konzept](../01_plan/Konzept_KI_first_2026-05-19.md) sind als Hooks vorbereitet und werden in Stufe 2 aktiviert. Begründung der Scope-Erweiterung: Joachim ist auf Pilot-Kurs (Stand 2026-05-21) — KI-Demo-Effekt in der Pilotphase ist Differenzierungsmerkmal für die Folge-Beauftragung.

### 6.1 Die drei aktiven Use Cases

| # | Use Case | Wirkort | Sichtbarkeit |
|---|----------|---------|--------------|
| 1 | **Schreibassistenz** — Knopf „Verbessern/Zusammenfassen" am Beschreibungs- und Chat-Textfeld → Cloud-LLM strukturiert/kürzt den Text. Original bleibt sichtbar, Vorschlag erscheint daneben mit Übernehmen/Verwerfen. | Ticket-Anlegen-Modal, Ticket-Detail Chat, ggf. E-Mail-Generierung für `mailto:` | alle Rollen |
| 2 | **Triage-Vorschlag** — im Anlegen-Modal Feld „Schnellerfassung" (Freitext oder eingehängte Outlook-`.msg`/`.eml`). „Übernehmen" → LLM füllt Titel, Beschreibung, Kategorie, Priorität, Tickettyp und Fehlercode-Match (Fuzzy gegen Stammdaten) vor. Pro Feld Confidence-Indikator, `Why?`-Tooltip. | Ticket-Anlegen-Modal | alle Rollen, Admin/Büro erhalten zusätzlich Fehlercode-Vorschlag-Erklärung |
| 3 | **Ähnliche-Tickets-Suche** — Side-Panel rechts im Ticket-Detail. 3–5 ähnliche abgeschlossene Tickets aus Historie (Embedding-Suche per pgvector HNSW), mit Status, Lösung, durchschnittlicher Dauer. | Ticket-Detail-Side-Panel | **Admin + Büro nur** (Frau-Zwittich-Schichtung — Techniker sieht das Panel nicht). |

**Trust-Pattern für alle drei Use Cases** (gemäß KI-First-Konzept Kapitel 4):
- Confidence-Indikator pro Vorschlag (hoch/mittel/niedrig)
- `Why?`-Hover zeigt Quellausschnitt oder Heuristik
- Akzeptieren / Ablehnen / Korrigieren — alle drei Aktionen werden ins `ki_audit` geloggt (Trainings-Signal für Stufe-2-Verfeinerung)
- Pre-Fill nur bei Confidence > 0.7, sonst reiner Vorschlag

### 6.2 LLM-Gateway-Service (aktiv)

Eigener Backend-Service (in `apps/api/src/core/ki/gateway.py`) — alle Frontend-Anfragen gehen über diesen Gateway, niemals direkt zum LLM-Anbieter.

```
Frontend → REST: POST /api/v1/ki/{use_case}
              ↓
        Auth + Rollen-Check (Frau-Zwittich-Sichtbarkeit)
              ↓
        Context-Builder (welche Daten? scope eigene/alle?)
              ↓
        Pseudonymisierung (Mieter-Namen/Telefon → IDs)
              ↓
        Prompt-Library (versioniertes Template pro Use Case)
              ↓
        Modell-Router (Embedding lokal / Reasoning Cloud)
              ↓
        Output-Validator (Schema-Check, Halluzinations-Filter)
              ↓
        Re-Identifizierung (IDs zurück zu Namen)
              ↓
        Audit-Logger (ki_audit-Eintrag)
              ↓
        Cost-Tracker (Budget-Cap, Alerts)
              ↓
Response → Frontend
```

Implementierungs-Architektur identisch zum [KI-First-Konzept Kapitel 3](../01_plan/Konzept_KI_first_2026-05-19.md). Stufe 1 nutzt davon: Pseudonymisierung, Prompt-Library, Cost-Tracker, Audit. Modell-Router läuft in Stufe 1 nur über zwei Modelle:

- **Lokales Embedding-Modell** (in EU-Cloud, separater Inferenz-Service): `sentence-transformers/all-MiniLM-L6-v2`, 384 Dimensionen. Für Use Case 3 (Ähnliche-Tickets-Suche).
- **Cloud-LLM**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) als Default, Claude Sonnet 4.6 (`claude-sonnet-4-6`) bei niedriger Confidence. Über Anthropic EU-Endpoint oder AWS Bedrock EU-Region. Für Use Case 1 + 2.

### 6.3 API-Key-Verwaltung

Admin-UI für API-Key-Hinterlegung in den Settings:

- Sidebar → „Einstellungen" → Reiter „KI"
- Felder: Anbieter (Dropdown: Anthropic / Bedrock), API-Key (Passwort-Input, masked), Region, optionaler Cost-Cap (€/Monat, Default 100 €), Aktiv-Flag
- Speicherung: API-Key applikationsseitig verschlüsselt (libsodium, Master-Key in Hetzner KMS-Äquivalent oder HashiCorp Vault) in `mandant_ki_konfig`-Tabelle. **Nie im Klartext in Logs oder Audit**.
- Cost-Cap-Verhalten: bei Erreichen → Notification an Admin, KI-Funktionen werden für den Rest des Monats disabled (App-Kern läuft weiter)
- Test-Knopf „Verbindung testen" → minimaler API-Call, validiert Key

**Schema-Ergänzung:**
```sql
CREATE TABLE mandant_ki_konfig (
  mandant_id      UUID PRIMARY KEY REFERENCES mandant(id),
  anbieter        TEXT NOT NULL,            -- 'anthropic','bedrock'
  api_key_enc     BYTEA NOT NULL,           -- libsodium-verschlüsselt
  region          TEXT NOT NULL,            -- 'eu-central-1', 'eu' (Anthropic EU-Endpoint)
  modell_default  TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  modell_eskalation TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  cost_cap_cent_monat INT NOT NULL DEFAULT 10000,  -- 100 EUR
  aktiv           BOOLEAN NOT NULL DEFAULT FALSE,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  geaendert_am    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.4 Pseudonymisierungs-Layer

Vor jedem Cloud-LLM-Aufruf:
- Mieter-Namen, Telefonnummern, E-Mail-Adressen, Adress-Details → ersetzen durch IDs (`[MIETER_42]`, `[TEL_7]`, `[EMAIL_3]`)
- Mapping bleibt nur im Gateway (Request-lokal, nicht persistiert)
- Nach LLM-Antwort: IDs zurück zu Namen (Re-Identifizierung)

Damit sieht das Cloud-Modell nie echte Personendaten. Für Use Case 1 (Schreibassistenz) ist Pseudonymisierung relevant, für Use Case 3 (Ähnliche-Tickets) findet alles lokal statt — keine Cloud-Beteiligung.

Implementierung: regex-basierte Erkennung + Lookup gegen `geschaeftspartner`/`kontakt`-Tabelle. Test-Suite mit gängigen deutschen Namen, Telefon-Formaten, PLZ-Mustern.

### 6.5 Schema-Nutzung in Stufe 1

- `ticket.embedding_vec VECTOR(384)` — **wird gefüllt** beim Speichern eines Tickets (Embedding über lokales Modell auf `titel + beschreibung`)
- `fehlercode.embedding_vec VECTOR(384)` — wird gefüllt beim Anlegen/Ändern eines Fehlercodes (für Fuzzy-Match in Triage)
- HNSW-Indices aktiv (cosine similarity)
- `ki_audit` — wird befüllt bei jeder KI-Operation

Background-Job für Embedding-Backfill alter Tickets nach Import läuft einmalig beim Pilot-Start.

### 6.6 Frontend-Hooks

| Hook | Stufe 1 | Stufe 2 |
|------|:-------:|:-------:|
| `useSchreibAssistenz()` | ✅ aktiv | erweitert um Domänen-Tonalität |
| `useTriageVorschlag()` | ✅ aktiv | + Auto-Klassifizierung im Hintergrund |
| `useSimilarTickets()` | ✅ aktiv (Admin/Büro) | + Lösungs-Zusammenfassung |
| `useNlSearch()` | `enabled: false` | ✅ aktiv |
| `useCoachModus()` | `enabled: false` | ✅ aktiv (Techniker-only) |
| `useSmartReport()` | `enabled: false` | ✅ aktiv |

UI-Komponenten (Assistant-Slot, Coach-Modus-Box, NL-Search-Eingabe) sind als JSX immer vorhanden — bei `enabled: false` rendern sie `null`.

### 6.7 Eval-Suite + Confidence-Schwellen

Pro Use Case ein Test-Set mit 30–50 erwarteten Input/Output-Paaren:

- `apps/api/tests/ki/eval/schreibassistenz.jsonl`
- `apps/api/tests/ki/eval/triage.jsonl`
- `apps/api/tests/ki/eval/similar_tickets.jsonl`

CI führt Eval-Suite nach Prompt-Änderungen aus. Bei Verschlechterung (Confidence-Average sinkt unter Schwellwert) → CI-Stop. Schwellwerte:
- Schreibassistenz: Confidence > 0.8 → Pre-Fill, sonst nur Vorschlag
- Triage: Confidence > 0.7 → Pre-Fill, sonst nur Vorschlag
- Ähnliche-Tickets: cosine similarity > 0.65 → in Liste, sonst weglassen

### 6.8 DSGVO-Voraussetzungen vor Live-Schaltung

Pflicht vor Pilot-Go-live:
- **AVV mit LLM-Anbieter** (Anthropic-AVV oder AWS Bedrock — Standardvertragsklauseln)
- **AVV zwischen Tim-Beratung und Joachim** (Auftragsverarbeiter-Konstrukt)
- **Zero-Retention-Vertrag** mit Anbieter (Prompts/Antworten nicht zwischengespeichert)
- **Datenschutzhinweis** im UI: „Diese Funktion nutzt einen KI-Dienst (Anbieter X, EU-Region). Pseudonymisierung aktiv. Details in den Einstellungen."
- **Opt-out pro Benutzer**: in Profil-Settings Schalter „KI-Vorschläge nutzen: ja/nein". Bei „nein" sind alle KI-UI-Elemente unsichtbar.
- **Audit-Log**: jede KI-Operation in `ki_audit` mit Modell, Token-Count, Antwort-Hash (PII-frei).

### 6.9 Was nicht in Stufe 1 — Stufe-2-Hooks vorbereitet

- **Auto-Klassifizierung als Online-Lern-Loop** (lokales Klassifikator-Modell mit Akzeptieren/Ablehnen-Feedback)
- **NL-Search / Smart Reporting** (NL → strukturierte Query → Aggregation oder inline Chart)
- **EBO-Filter-Layer** (Cluster zusammenhängender Codes, Self-Healing-Erkennung) — abhängig von EBO-Anbindung Stufe 3
- **Coach-Modus für Techniker** (KI stellt Fragen statt Antworten — Frau-Zwittich-positive Variante)
- **Lösungs-Zusammenfassung mit Quellen-Verknüpfung** (Vertiefung des Ähnliche-Tickets-Panels)
- **Mieter-Portal-Vorab-Triage** (RAG gegen Hausordnung — abhängig Stufe 2a)
- **Bereitschafts-Briefing** als Hintergrund-Job zum Schichtwechsel
- **Cross-Mandant-KI** (DSGVO-pseudonymisiert) — Stufe 3

Endpoint `POST /api/v1/ki/{use_case}` für die nicht-aktiven Use Cases gibt `501 Not Implemented`.

---

## 7. Automatische Dokumentation

Anforderung: bei Code-Änderungen wachsen die Dokumentationen mit, ohne manuell gepflegt werden zu müssen.

### 7.1 API-Doku — automatisch aus OpenAPI

- **Swagger UI** unter `/api/v1/docs` (auth-geschützt, nur Admin)
- **ReDoc** unter `/api/v1/redoc` als alternative Darstellung
- OpenAPI-Spec auch als YAML herunterladbar
- Bei FastAPI automatisch aus Routes; bei Fastify via `@fastify/swagger` + Schema-Definitionen
- **CI prüft Spec-Konsistenz:** generierter Client darf nicht von Hand editiert sein

### 7.2 Frontend-Komponenten — Storybook

- Storybook 8 mit allen wiederverwendbaren Komponenten (AuswahlCombobox, PowerHeaderZelle, BulkConfirmDialog, ZeitRelativ, …)
- Stories als Lebenddokumentation, Designer/Joachim können durchblättern
- Visual-Regression-Tests via Chromatic oder Loki (optional Stufe 2)
- Deployment der Storybook-Instanz auf einer Subdomain (`storybook.<app>.de`)

### 7.3 Architecture Decision Records (ADRs)

- Verzeichnis `docs/adr/` im Repo
- Vorlage: MADR (Markdown Architectural Decision Records)
- Pro Entscheidung ein ADR (z. B. „0001-backend-language.md", „0002-orm-choice.md")
- Senior-Entwickler legt ADRs an bei jeder verbindlichen Architektur-Entscheidung
- **Plattform-Marker:** Jedes ADR trägt einen Block `plattform-relevant: ja|nein` plus kurze Begründung. „Ja" bedeutet: die Entscheidung gilt nicht nur für die FM-App, sondern als Default für künftige Apps. Damit ist beim Bootstrap der nächsten App sofort sichtbar, was übernommen wird — und was neu geprüft werden muss. Siehe Kapitel 13.
- Vorteil: nachvollziehbar, warum etwas so gebaut ist — wichtig bei späteren Refactorings

### 7.4 Code-Doku

- **Python:** Google-Style Docstrings, mkdocs-material generiert HTML aus Docstrings
- **TypeScript:** TSDoc, TypeDoc generiert HTML
- Auto-Build im CI, Deployment auf Doku-Subdomain (`docs.<app>.de`, intern)
- Public Functions/Methods müssen einen Docstring haben (ruff/eslint-Rule)

### 7.5 README & Onboarding

- `README.md` im Repo: Quickstart („was tut die App?", „wie starte ich?", „wo finde ich Doku?")
- `docs/development/`-Ordner mit:
  - `getting-started.md` — Dev-Setup in ≤ 10 min
  - `architecture.md` — Übersicht (Verweis auf ADRs)
  - `database.md` — Schema-Diagramm + Migration-Guide
  - `deployment.md` — Prod-Deploy-Schritte
  - `troubleshooting.md` — bekannte Probleme

### 7.6 Changelog

- `CHANGELOG.md` nach Keep-a-Changelog-Format
- Automatisierung über `semantic-release` (aus Commit-Messages → Changelog + Release-Tag)
- Conventional Commits Pflicht (`feat:`, `fix:`, `chore:`, `docs:`, …)

### 7.7 Pattern-Library (wiederverwendbares Wissens-Repository)

Verzeichnis `docs/patterns/` im Repo. Pro wiederverwendbares Pattern eine Markdown-Datei mit fester Struktur:

- **Pattern-Name** und Einsatzgebiet
- **Wann anwenden** — Kriterien
- **Wie umsetzen** — Schritte mit Code-Beispielen
- **Beispiel-Implementierung im Code** (Link auf Datei/Zeile)
- **Stolperfallen** — was nicht funktioniert, warum
- **Plattform-relevant: ja|nein** — analog zu ADRs

Erstinhalt (aus dem Mockup geboren, in `memory/`-Konventionen verankert):

- `power-layout-listen.md` — Drag-Reorder, Multi-Sort mit 3-Klick-Reset, Bulk-Auswahl, Pencil-Bulk-Edit, gespeicherte Ansichten
- `auswahllisten-default.md` — Stammdaten in Tabellen, nicht im Code
- `filter-passend-zum-feldtyp.md` — UI-Filter abgeleitet aus Feldtyp
- `konsistente-migration.md` — bei Feld-Änderung alle Referenzen mitziehen
- `audit-trigger-postgres.md` — globaler Audit über Postgres-Trigger
- `combobox-mit-inline-anlegen.md` — Adresse/Partner/Anlage „neu anlegen" aus jeder Auswahl
- `bounded-context-trennung.md` — `core/` vs. anwendungsspezifisch (siehe Kapitel 13)

**Pflegeregel:** Wer ein Pattern zum dritten Mal kopiert, schreibt es als Pattern-Datei aus (Rule of Three). Diese Library wandert bei der nächsten App mit — operative Form des „lernenden Systems": Erkenntnisse werden festgehalten und sind beim nächsten Projekt sofort abrufbar.

---

## 8. In-App-Benutzerhilfe

Joachim und Frau Zwittich sind keine IT-Profis. Mitarbeitende auch nicht. Die App muss sich selbst erklären.

### 8.1 Inline-Tooltips

- Jedes nicht-triviale Feld bekommt Hover-Tooltip mit Erklärung
- Implementierung: Wrapper-Komponente `<Field label="..." hilfe="...">` — Hilfe-Text aus zentraler Datei `docs/feldhilfe.<sprache>.json`
- Pflege durch Tim/Joachim selbst, ohne Code-Änderung

### 8.2 Onboarding-Tour

- Beim ersten Login pro User eine geführte Tour (5–7 Schritte) durch die wichtigsten Bereiche
- Bibliothek: `react-joyride` oder `intro.js`
- Tour-Schritte als JSON-Konfiguration pflegbar
- Wiederaufrufbar über Header-Menü „Tour starten"

### 8.3 Kontextsensitives Hilfe-Center

- Header-Icon „?" öffnet Side-Panel mit:
  - Aktuell sichtbare View → passende Hilfe-Artikel
  - Volltextsuche über alle Hilfe-Artikel
  - „Tour neu starten" als Knopf
- Hilfe-Artikel als Markdown im Repo (`docs/hilfe/`), gerendert in der App
- Update-Workflow: PR auf `docs/hilfe/`, Merge → automatisch live

### 8.4 Empty-States als Hilfe

- Mockup hat das bereits (EmptyState-Komponente). Im Produktivsystem ausbauen:
  - Erste Liste leer? Erklärtext + Quick-Start-Tipp + CTA
  - Erste Suche ohne Treffer? Vorschläge, was die Suche kann
- Verhindert „weiße Seite"-Ratlosigkeit

### 8.5 Was-ist-Neu-Banner

- Bei Releases mit User-relevanten Änderungen: Banner nach Login („Neu seit dem letzten Login: X, Y, Z. → Details")
- Banner-Inhalte aus `docs/release-notes/` automatisch

### 8.6 Video-Tutorials (optional Stufe 1+)

- 3–5 kurze Screencasts (jeweils < 2 min) zu Kern-Workflows: Ticket erfassen, Foto annotieren, Mieter anlegen, Bulk-Edit, Filter-Set speichern
- Hosting bei Vimeo Pro (DSGVO-fähig) oder selbst gehostet
- Eingebettet im Hilfe-Center

### 8.7 Anti-Pattern (vermeiden)

- Keine **Chat-Bot-Hilfe** in Stufe 1 (das wäre KI, das wollen wir nicht). Stufe 2+ unter Vorbehalt.
- Keine **Popup-Werbung** für Premium-Features oder Add-Ons — die App hat das nicht.
- Keine **Modal-Karussells** zum Klicken — Tour kann pausiert werden.

---

## 9. Observability

### 9.1 Logging

- **Format:** strukturierte JSON-Logs (eine Zeile pro Event)
- **Felder pflicht:** `ts`, `level`, `service`, `mandant_id`, `user_id`, `request_id`, `event`, `payload`
- **Library:** structlog (Python) bzw. pino (Node)
- **Aggregation:** Loki (Grafana-Stack, EU-self-host) oder Elastic
- **Retention:** 90 Tage Live, danach Cold-Storage (S3) für 1 Jahr

### 9.2 Metrics

- **Prometheus** als Metric-Store
- **Standard-Metrics:**
  - HTTP-Latenz P50/P95/P99 pro Endpoint
  - DB-Connection-Pool-Auslastung
  - Background-Job-Queue-Tiefe
  - Anzahl aktiver Sessions
- **Domain-Metrics:**
  - Tickets neu/Tag, erledigt/Tag
  - Durchschnittliche Wartet-Dauer pro Grund
  - Foto-Upload-Volumen
- **Grafana** als Frontend, eine Dashboard-Sammlung im Repo (`infra/grafana/dashboards/`)
- **Alerts:** Alertmanager → Webhook in einen Status-Kanal (Slack/E-Mail)

### 9.3 Error-Tracking

- **Sentry self-hosted** (DSGVO-konform, EU) oder Sentry SaaS mit EU-Region
- Backend + Frontend integriert
- PII-Scrubbing aktiv (E-Mail, Telefon, Name werden vor Senden geschwärzt)
- Issue-Lifecycle ins Repo verlinkt

### 9.4 Tracing (optional Stufe 1, Pflicht Stufe 2)

- OpenTelemetry für verteilte Traces. Backend/DB/Object-Store-Requests
- Backend: `opentelemetry-instrumentation-fastapi` bzw. `@opentelemetry/instrumentation-fastify`
- Backend → Tempo (Grafana-Stack) als Trace-Store

### 9.5 Audit-Stream (Domain-Observability)

- `system_audit` als Append-Only-Tabelle ist Pflicht (Kapitel 5.5)
- Stufe-2-Erweiterung: Audit-Stream als Real-Time-Feed (LISTEN/NOTIFY in Postgres), z. B. für Reporting

---

## 10. Testing & CI/CD

### 10.1 Test-Pyramide

| Stufe | Werkzeug | Coverage-Ziel |
|-------|----------|---------------|
| Unit | pytest / Vitest | > 70 % Backend, > 50 % Frontend-Logic |
| Integration | pytest mit Test-Postgres (testcontainers) | alle API-Endpunkte abgedeckt |
| E2E | Playwright | Top-10-User-Workflows (Login, Ticket erfassen, Foto, Bulk, Wartet-Status, Chat, Suche, Mobile-Modus, Filter, Notification) |
| Visual Regression | Chromatic / Loki (optional) | Top-Komponenten |
| Load | k6 oder Locust | Stufe-2-Pflicht, Stufe-1 als smoke (50 RPS / 10 concurrent) |

### 10.2 CI

- **GitHub Actions** (oder GitLab CI, je nach Repo-Wahl)
- Pipeline:
  1. Lint (ruff/eslint) — < 30 s
  2. Unit-Tests — < 2 min
  3. Build (FE + BE) — < 3 min
  4. Integration-Tests — < 5 min
  5. E2E (nur main + PR) — < 8 min
  6. Container-Build + Push (signiert mit cosign)
  7. Deploy zu Staging (auto auf main)
- **Quality Gates:** Lint + Unit-Tests + Build müssen grün sein vor Merge. E2E darf flaky sein, aber muss innerhalb 3 Re-Runs grün werden.

### 10.3 12-Schichten-Sicherheitsarchitektur (statt Senior-Review)

Tim hat sich am 2026-05-21 dafür entschieden, dass Claude das Projekt eigenverantwortlich programmiert und deployed (siehe CLAUDE.md). Stattdessen wirkt eine technische Sicherheitsarchitektur in 12 Schichten:

| # | Schicht | Werkzeug / Maßnahme |
|---|---------|---------------------|
| 1 | Automatisierte Tests | Vitest/pytest 80 %+, Playwright-E2E (10 Workflows), CI-Pflicht |
| 2 | Statische Analyse | Semgrep (OWASP), Bandit (Python), npm audit, mypy strict, ruff/eslint strict |
| 3 | CodeQL-Scan | GitHub-native für SQL-Injection, XSS, Auth-Probleme |
| 4 | Dependency-Hygiene | Renovate-Bot, Lockfile-Pflicht, CVE-Auto-Updates |
| 5 | Pre-Commit-Hooks | Secrets-Detection (`gitleaks`), Debug-Code, Filesize-Limits |
| 6 | PR-Selbstreview | 12-Punkte-Checkliste, Claude füllt vor Merge aus (Tests vorhanden? Auth-Check da? Migration reversibel? …) |
| 7 | Staging-Promote | Auto-Deploy auf Staging, Produktion nur nach **manuellem Klick durch Tim** |
| 8 | Rollback-fähig | Container-Versionen mit `:vN`, DB-Backup vor jeder Migration, RTO < 5 min |
| 9 | Audit + Alerting | `system_audit`-Append-Only + Sentry-Alerts auf 5xx + Slack/Email-Notify |
| 10 | Feature-Flags | Roll-out gestaffelt (`tim_only` → `joachim_admin` → `alle`) |
| 11 | Externer Pen-Test | Einmalig vor Pilot-Go-Live (~1.500 €) — Mindest-Außenkontrolle |
| 12 | Acceptance-Reviewer | Tim klickt durch Staging, validiert Geschäftslogik, gibt Promote-Freigabe |

- **Branch Protection** auf `main`: kein direkter Push, kein Force-Push, Status-Checks aller Schichten 1–6 als Pflicht-Gate
- **Restrisiko bleibt:** subtile Sicherheitslücken und Architektur-Schulden können trotz aller Schichten unentdeckt bleiben. Bewusste Entscheidung Tims.

### 10.4 PR-Selbstreview-Checkliste

Verpflichtende Liste pro Pull-Request — Claude füllt aus, blockiert Merge bei Lücken:

```
[ ] Tests für neue/geänderte Logik vorhanden (Unit + Integration wo passend)
[ ] Auth-Decorator/Permission-Check auf jedem geänderten Endpoint vorhanden
[ ] User-Input wird validiert (pydantic/Zod-Schema)
[ ] Keine Secrets oder Debug-Outputs im Code
[ ] DB-Migration vorhanden und mit Rollback-Skript getestet
[ ] Audit-Log für relevante Schreiboperationen erweitert
[ ] Frontend-Strings auf Deutsch (kein hardcoded Englisch)
[ ] Mobile/Touch-Bedienbarkeit für UI-Änderungen geprüft
[ ] Feature-Flag gesetzt, falls Risiko-Feature
[ ] Doku/ADR aktualisiert bei Architektur-Änderung
[ ] OpenAPI-Spec aktualisiert bei API-Änderung
[ ] Manueller Smoke-Test auf Staging durchgeführt
```

### 10.4 Test-Daten

- Faker-Library für reproduzierbare Demo-Daten (Joachims Demo-Daten kommen nach Pilot-Start raus)
- Seed-Script `pnpm seed` füllt Test-DB mit ~50 Tickets, ~10 Mitarbeitenden, 3 Objekten

---

## 11. Deployment & Hosting

### 11.1 Umgebungen

- **dev** (Entwickler lokal, docker-compose)
- **staging** (Hetzner, auto-deploy aus `main`)
- **prod** (Hetzner, manueller Promote aus staging-Build, Single-Click-Rollback)

### 11.2 Topologie Prod (Vorschlag)

- 1× App-Server (Hetzner CPX21 oder CCX12) mit:
  - Reverse Proxy (Caddy)
  - Backend-Service
  - MinIO (oder Hetzner Object Storage als Service)
- 1× DB-Server (Hetzner CPX31) mit:
  - Postgres 16 + pgvector
  - pgBackRest für Backups
- 1× Keycloak-Instanz (kann auf App-Server mitlaufen)
- Optional: 1× Monitoring-VM mit Loki + Prometheus + Grafana + Sentry

Trennung App/DB ist Pflicht (Sicherheit + Backup-Strategie + Performance-Isolation).

### 11.3 Backup-Strategie

- **DB:** pgBackRest, full-Backup nächtlich, WAL-Archiv kontinuierlich. RPO < 5 min, RTO < 1 h
- **Object-Store:** Cross-Region-Replication (Hetzner: zweite Region) oder nächtlicher Snapshot
- **Backup-Restore-Test:** quartalsweise dokumentiertes Restore-Drill

### 11.4 Deployment-Mechanik

- **Container-Images** signiert mit cosign, in einer privaten Registry (Hetzner Container Registry, GHCR, oder Harbor)
- **Deploy via GitHub Actions** → SSH → `docker compose pull && docker compose up -d`
- **Zero-Downtime-Deploys:** Backend hat `--graceful-shutdown`, Frontend ist statisch (kein Restart nötig)
- **Datenbank-Migrationen:** Alembic (Python) oder Drizzle-Kit (Node). Migration als separater CI-Step **vor** App-Deploy, mit Rollback-Skript für jede Migration

### 11.5 Disaster Recovery

- **Runbook im Repo** (`docs/operations/disaster-recovery.md`)
- **Szenarien dokumentiert:** DB-Crash, Object-Store-Verlust, Keycloak-Ausfall, kompromittierter Server
- **Wiederherstellungs-Test:** halbjährlich, Ergebnis als Audit-Protokoll

---

## 12. Migration vom Mockup

### 12.1 Was direkt übernommen wird

- **UI-Komponenten** (~80 % wiederverwendbar):
  - PowerLayout-Hook (`usePowerLayout`)
  - PowerHeaderZelle, PowerGruppierungsZeile
  - BulkEditDropdown, BulkConfirmDialog
  - AuswahlCombobox, AuswahlMultiFilter
  - ViewModeToggle, SpaltenMenu
  - ZeitRelativ, EmptyState
  - DropGap, alle Annotation-Tools für Fotos
- **Views** (Refactor erforderlich, aber Logik bleibt):
  - TicketPool, DetailPanel
  - PartnerView, ProjekteView, ObjekteView, AdressView, BenutzerView, VorlagenView, FehlercodeView
  - AdminDashboard, TechnikerDashboard
  - MobileDemo (wird zu Mobile-Verhalten der PWA)
  - NeuTicket-Modal
- **Auswahllisten-Architektur** (Stufe-1-fertig im Mockup)

### 12.2 Was neu geschrieben werden muss

- **State-Management:** weg von prop-drilling, hin zu TanStack Query (Server-State) + ggf. Zustand (Client-State für UI-Konfig wie offene Sidebars)
- **Datenpersistenz:** statt React-State → API-Calls. Optimistic Updates wo sinnvoll
- **PWA-Setup auf Backend-Auth abgestimmt** (Service Worker kennt Auth-Cookies)
- **Routing:** React Router oder TanStack Router (statt Hash-basiertes Routing wie im Mockup)
- **Formular-Validation:** Zod-Schemas (synchron mit Backend)
- **Datei-Upload:** Pre-Signed URLs, nicht Base64-im-State

### 12.3 Modul-Aufteilung (Refactor der monolithischen `App.jsx`)

Trennung in **Plattform-Kern** (`core/`) und **Anwendungs-Code** (`fm-tickets/`) — Plattform-Anker-Strategie, Details in Kapitel 13.

```
apps/web/src/
├── core/                       # potenziell wiederverwendbar (Plattform-Kandidaten)
│   ├── liste/                  # usePowerLayout-Hook, PowerHeaderZelle, BulkEditDropdown, …
│   ├── auswahllisten/          # Engine + Combobox + MultiFilter + SpaltenMenu
│   ├── adresse/                # Adress-Modul (CRUD, Combobox, Modal)
│   ├── partner/                # Geschäftspartner (n:m-Typen, n-Kontakte)
│   ├── benutzer/               # Benutzerverwaltung + Rollen
│   ├── audit/                  # Audit-Logger-UI, Verlauf-Komponenten
│   ├── rbac/                   # useRechte-Hook, Permission-Wrapper
│   ├── notifications/          # In-App-Toast, Bell-Dropdown, Push-Permission
│   ├── hilfe/                  # Tooltips, Onboarding-Tour, Hilfe-Center
│   └── components/             # generische UI-Bausteine (ZeitRelativ, EmptyState, …)
├── fm-tickets/                 # anwendungsspezifisch (FM-Domäne)
│   ├── tickets/                # Pool, Detail, NeuTicket, Workflow
│   ├── fehlercodes/            # Fehlercode-Stammdaten + Hydratation
│   ├── objekte/                # Objekt → Haus → Stockwerk → Einheit
│   ├── projekte/
│   ├── dashboards/
│   └── mobile/
├── routes.tsx                  # Routing-Konfiguration
└── app.tsx                     # Bootstrap
```

**Lint-Rule (verbindlich):** `fm-tickets/` darf aus `core/` importieren, **nie umgekehrt**. ESLint-Regel im Repo (`eslint-plugin-boundaries` o. ä.); CI-Pipeline bricht bei Verstoß.

Analog im Backend:

```
apps/api/src/
├── core/                       # Plattform-Kandidaten
│   ├── auswahllisten/
│   ├── adresse/
│   ├── partner/
│   ├── benutzer/
│   ├── audit/
│   ├── rbac/
│   └── notifications/
└── fm/                         # FM-spezifische Domain-Services
    ├── tickets/
    ├── fehlercodes/
    ├── objekte/
    └── projekte/
```

### 12.4 Daten-Migration

- Mockup hat nur Demo-Daten — keine echte Migration nötig
- Joachim startet mit leeren Stammdaten, Demo-Daten optional als Seed
- Initial-Setup-Checkliste:
  1. Mandant anlegen
  2. Auswahllisten mit Defaults befüllen (Status, Prio, Kategorie, …)
  3. Admin-User per Keycloak anlegen, MFA einrichten
  4. Joachims Pilot-Objekt anlegen (mit Häusern/Stockwerken/Einheiten)
  5. Geschäftspartner importieren (CSV-Import-Helfer in Stufe 1 nett-to-have)
  6. Erste Tickets erfassen

---

## 13. Plattform-Anker (wiederverwendbarer Kern für künftige Apps)

Strategie: **Plattform-Ready, nicht Plattform-Aktiv** (Entscheidung vom 2026-05-20).

Ziel: Aus dem FM-Ticketsystem-Bau wachsen wiederverwendbare Bausteine und dokumentierte Patterns mit. Bei der nächsten App startet das Projekt nicht von Null, sondern hat einen **Plattform-Kern**, der erprobt und übernommen wird. Aufschlag in Stufe 1: ~+10 % (≈ 8 PT). Bootstrap-Aufwand zweite App: ~30–50 % statt 100 %.

**Was wir bewusst nicht tun:** Echtes Monorepo mit publishbaren npm-Packages, generische Konfig-Schicht, „Configurable Everything"-Architektur. Diese Schritte folgen erst, wenn die zweite (oder dritte) App ernsthaft am Start ist und die Schnittstellen sich bewährt haben (Rule of Three).

### 13.1 Bounded Contexts — core/ vs. fm-tickets/

Code-Struktur trennt zwei Welten:

| Schicht | Inhalt | Beispiele |
|---------|--------|-----------|
| `core/` | wiederverwendbar, FM-frei | Listen/Power-Layout, Auswahllisten-Engine, Adresse, Geschäftspartner, Benutzer/Rolle, Audit, RBAC, Notifications, In-App-Hilfe |
| `fm-tickets/` | anwendungsspezifisch | Ticket, Fehlercode, Objekt → Haus → Stockwerk → Einheit, Anlagen, Wartet-Gründe, Mieter-Logik |

**Verbindlich:** `fm-tickets/` darf aus `core/` importieren, **nie umgekehrt**. ESLint-Regel verankert (`eslint-plugin-boundaries` o. ä.); CI-Pipeline bricht bei Verstoß. Selbe Regel im Backend (siehe Kapitel 12.3).

**Vorteil bei der nächsten App:** `core/` wird kopiert (oder später als Library extrahiert), `fm-tickets/` durch das neue Domain-Modul ersetzt. Datenmodell-Patterns (Audit, Soft-Delete, Mandantenfähigkeit, Auswahllisten als Tabellen) sind ohnehin Plattform-Konzepte — wandern mit.

### 13.2 Pattern-Library

Verzeichnis `docs/patterns/` im Repo (siehe Kapitel 7.7). Pro Pattern eine Markdown-Datei mit fester Struktur — Wann anwenden, Wie umsetzen, Beispiel-Code-Referenz, Stolperfallen, Plattform-Marker.

Erstinhalt aus dem Mockup-Bau bereits etabliert (in `memory/`-Konventionen verankert):

- Power-Layout in Listen
- Auswahllisten als Default
- Filter passend zum Feldtyp
- Konsistente Migration
- Audit-Trigger über Postgres
- Combobox mit Inline-Anlegen
- Bounded-Context-Trennung

**Pflegeregel:** Wer ein Pattern zum dritten Mal kopiert, schreibt es als Pattern-Datei aus (Rule of Three). So entsteht ein gepflegter Bestand statt willkürlich kopierter Schnipsel.

### 13.3 Plattform-Kandidaten — Module mit besonderer API-Disziplin

Folgende 10 Module werden mit **stabiler Schnittstelle und FM-freier Implementierung** gebaut. Sie sind die ersten Kandidaten für npm-Paket-Extraktion bei App #2/#3:

| Modul | Inhalt | Schnittstelle (Beispiel) |
|-------|--------|--------------------------|
| `liste` | `usePowerLayout`-Hook + zugehörige Komponenten | `({ listeId, spaltenDef, defaultSpalten, defaultSortierungen, aktionenBreite }) → PowerLayoutState` |
| `auswahllisten` | Engine + UI (Combobox, MultiFilter, SpaltenMenu, KonfigUI) | CRUD über generische `liste<T>`-API |
| `adresse` | CRUD + Combobox + Modal + Validation | Adress-Schema, `useAdressen()`, `<AdressCombobox>` |
| `partner` | Geschäftspartner mit n:m-Typen, n-Kontakten | Generisches Typ-Mapping, `usePartner()`, `<PartnerCombobox>` |
| `benutzer` | Benutzer + Rolle | Pluggable Identity-Provider (Keycloak in Stufe 1) |
| `audit` | `system_audit`-Trigger + UI-Anzeige | DDL-Snippet + `<AuditTimeline>` |
| `rbac` | Rechte-Prüfung, `useRechte`-Hook | `darf(recht, scope?)` |
| `notifications` | In-App-Toast, Bell-Dropdown, Push-API | `useNotifications()` + Push-Worker |
| `llm-gateway` | LLM-Gateway-Service (Pseudonymisierung, Modell-Router, Prompt-Library, Cost-Tracker, KI-Audit) — siehe Kapitel 6 | `gateway.invoke(use_case, payload, mandant_id) → KiResponse` |
| `dokumente` | Dokumenten-CRUD, Drag-Drop-Zone, `.msg`/`.eml`-Parser, n:m-Verknüpfungs-Engine, Deduplikation per SHA-256 | `useDokumente()`, `<DropZone bezug={...} />`, `parseEmail(file) → ParsedMail` |

**API-Disziplin pro Modul:**

- Keine Imports aus `fm-tickets/`
- Eigene Tests (Unit + Integration) ohne FM-spezifische Fixtures
- ADR pro nicht-triviale Schnittstellen-Entscheidung mit `plattform-relevant: ja`
- Pattern in `docs/patterns/` dokumentiert

### 13.4 Was nachgelagert bleibt (bewusst)

- **Echte Monorepo-Distribution** mit publishbaren npm-Packages — erst bei App #2/#3, wenn Schnittstellen stabil sind
- **Generische Konfigurations-Schicht** („App auf Code-Level konfigurieren statt anpassen") — Risiko der Over-Engineering ist hoch
- **Externe Komponenten-Library zur Distribution** — Storybook ja, aber primär als Doku, nicht als Pakete
- **Multi-App-Mandantenfähigkeit zur Laufzeit** — eine Instanz pro Mandant ist für Stufe 1+2 ausreichend

### 13.5 Trigger für die zweite Stufe der Plattform-Bildung

Wenn folgendes eintritt, ist es Zeit, von Plattform-Ready auf Plattform-Aktiv zu wechseln:

1. **Zweite zahlende Software-Anwendung** in Sicht (Tims „eigene Produkte"-Vision, siehe globale `CLAUDE.md`)
2. **Drittes Mal Power-Layout extrahiert** — Pattern hat sich bewährt
3. **Drittes Mal Adress-Modul kopiert** — Schnittstelle ist stabil
4. **Externe Devs / Junior-Entwickler im Team** — Wartbarkeit per Library wichtiger als per Konvention

Bis dahin: Disziplin reicht, Distribution ist Overkill.

---

## 14. Aufwand-Indikation & Meilensteine

> **Hinweis:** Die folgenden Aufwandsangaben sind **indikativ, vor finaler Senior-Entwickler-Schätzung nicht verbindlich.** Sie helfen dem Senior-Entwickler, eine Erstabschätzung zu validieren.

### 13.1 Aufwand-Indikation (Personentage Senior)

| Block | PT (indikativ) | Anmerkung |
|------|---------------|-----------|
| Architektur-Setup (Repo, CI/CD, Docker, Keycloak) | 5 | inkl. Staging-Umgebung |
| Datenmodell + Migrationen + Audit-Trigger + RLS | 6 | komplettes Schema, Alembic/Drizzle-Migrationen |
| API-Skeleton + OpenAPI-Pipeline | 4 | Auth-Middleware, Pagination, Error-Envelope |
| Auth + RBAC (schmal, Stufe 1) | 3 | Keycloak-Integration, Decorators |
| Tickets CRUD + Bulk + Verlauf | 6 | inkl. Wartet-auf-Logik |
| Stammdaten (Objekte/Häuser/Stockwerke/Einheiten + Adressen + Partner + Kontakte) | 8 | das Datenmodell ist die hauptsächliche Komplexität |
| Auswahllisten-Konfiguration (Stammdaten-Konfig-UI + API) | 3 | |
| Tickettypen (Vorlagen) + Fehlercodes | 4 | inkl. CRUD-UI und Hydratations-Logik |
| Projekte | 2 | |
| Chat + @-Mentions + Notifications + WebSocket | 5 | |
| Foto-Upload + Annotationen (Pre-Signed-URL-Flow) | 4 | |
| Dashboards (Admin + Techniker) | 3 | aus Mockup übernehmen |
| Frontend-Refactor (Modul-Aufteilung, TanStack Query, Routing) | 8 | aufwendigster reiner FE-Block |
| In-App-Hilfe (Tooltips, Onboarding, Hilfe-Center) | 3 | |
| Auto-Doku (OpenAPI, Storybook, ADRs, mkdocs) | 2 | Setup-only, fortlaufende Pflege gehört zu jedem Feature |
| Observability (Logging, Metrics, Sentry) | 3 | |
| Testing (Unit + Integration + E2E-Setup, 10 Top-Workflows) | 7 | |
| PWA-Setup (Service Worker, Offline-Fallback, Install-Prompt) | 2 | |
| Deployment (Staging + Prod, Backup, DR-Runbook) | 4 | |
| Plattform-Disziplin (Bounded Contexts, Pattern-Library, ADR-Marker) | 8 | `core/` vs. `fm-tickets/`, 9 Module mit besonderer API-Disziplin (Kapitel 13), Patterns dokumentieren |
| **KI-Light** — API-Key-Admin-UI + Cost-Cap + Schema | 1 | `mandant_ki_konfig`-Tabelle, Settings-UI, Verschlüsselung mit libsodium |
| **KI-Light** — LLM-Gateway-Service produktiv | 4–5 | Auth, Pseudonymisierung, Prompt-Library, Modell-Router, Output-Validator, Cost-Tracker, Audit (Kapitel 6.2–6.4) |
| **KI-Light** — Use Case Schreibassistenz | 2 | Inline-Knopf, Prompt-Pflege, Eval-Suite |
| **KI-Light** — Use Case Triage-Vorschlag | 3–4 | Schnellerfassungs-Feld, Confidence-UI, Fehlercode-Match, Eval-Suite |
| **KI-Light** — Use Case Ähnliche-Tickets-Suche | 2–3 | Lokales Embedding-Modell-Hosting, pgvector-HNSW-Suche, Admin-Side-Panel-UI (Frau-Zwittich-Schichtung) |
| **Dokumente** — Schema, CRUD, Pre-Signed Upload, n:m-Verknüpfungen | 3 | `dokument` + 4 n:m-Tabellen, Deduplikation, Storage-Pfad-Logik |
| **Dokumente** — DropZone-Komponente, Liste am Ticket, Sidebar-Bereich „Dokumente" mit Power-Layout | 3 | wiederverwendbar in `core/`, Bild-MIME-Weiche → ticket_foto, Rest → dokument |
| **Dokumente** — `.msg`/`.eml`-Parser (Absender, Betreff, Body, Anhänge) | 2 | `extract-msg` (Python) bzw. `eml-parser`, Anhänge als eigene Dokumente |
| Pilot-Begleitung, Bugfixing, Onboarding Joachim | 5 | Puffer |
| **Summe (indikativ)** | **~115 PT** | **≈ 23 Personenwochen** |

Plus ~10–15 % Reserve für Unvorhergesehenes = **~130–140 PT für eine erfahrene Senior-Person**.

**Stufe-1-Aufschlag KI-Light:** ~12–15 PT (Gateway, Key-UI, 3 Use Cases).
**Stufe-1-Aufschlag Dokumente:** ~8 PT (Schema, UI, E-Mail-Parser). Beide Aufschläge parallelisierbar zum Hauptentwicklungsstrang, damit Pilot-Termin nicht verschoben wird.

### 13.2 Meilensteine (Vorschlag)

| MS | Wochen | Inhalt |
|----|--------|--------|
| MS-1: Setup + Schema | W1–W2 | Repo, CI/CD, Auth, Datenmodell live |
| MS-2: Tickets + Stammdaten Backend | W3–W6 | API komplett, ohne UI |
| MS-3: Frontend Refactor + Tickets-UI | W7–W10 | klickbar, gegen API |
| MS-4: Stammdaten-UI + Auswahllisten-Konfig | W11–W13 | Stufe-1-Funktionsumfang erreicht |
| MS-5: Chat + Foto + Notifications + PWA | W14–W15 | Stufe-1-Komfort komplett |
| MS-6: Hilfe + Doku + Testing-Ausbau | W16–W17 | produktionsreif |
| MS-7: Pilot-Onboarding | W18 | Joachim live, Begleitung |

---

## 15. Offene Punkte für Senior-Entwickler-Klärung

| # | Frage | Erforderlich für | Vorschlag |
|---|------|-------------------|----------|
| 1 | Backend-Sprache: FastAPI (Python) vs. Fastify (TypeScript) | Architektur-Setup | FastAPI, weil KI-Workloads in Stufe 2 |
| 2 | Auth-Provider: Keycloak vs. Ory Kratos | Auth-Setup | Keycloak |
| 3 | Hosting: Hetzner Cloud vs. Azure EU | Deployment | Hetzner für Kostenoptimum |
| 4 | k3s-Cluster vs. Docker-Compose-Setup für Prod | Deployment | Docker-Compose, k3s overkill bei 10 MA |
| 5 | Realtime: WebSocket vs. SSE für Chat/Notifications Stufe 1 | Chat-Implementierung | Pull-Polling Stufe 1, WebSocket Stufe 2 (Aufwand: 1 PT gespart) |
| 6 | Object-Store: MinIO self-host vs. Hetzner Object Storage | Foto-Upload | Hetzner Object Storage, weniger Betrieb |
| 7 | Storybook: hosten oder rein lokal? | Frontend-Doku | als Subdomain hosten |
| 8 | Sentry: self-host vs. SaaS-EU? | Error-Tracking | SaaS-EU, schneller live |
| 9 | Embedding-Dimension: 384 (`all-MiniLM-L6-v2`) vs. 768 (`bge-base`) | Schema-Dimension der pgvector-Spalten | 384 — Memory-effizient, reicht für unsere Domäne |
| 10 | Deutsche Übersetzungs-/i18n-Strategie | Frontend-Setup | `i18next`, Sprachen-Datei in Stufe 1 nur `de`, Struktur für `en`/`tr`/`pl` vorbereitet (häufige Sprachen im FM-Personal) |
| 11 | Datei-Limits: max Foto-Größe, max Anzahl je Ticket? | Upload-Backend | 10 MB pro Foto, 20 Fotos pro Ticket — mit Joachim final |
| 12 | Mobile-App (native) vs. PWA-only Stufe 1? | Frontend-Scope | PWA-only, native erst Stufe 2 bei Bedarf |
| 13 | Realnamen-Kollisionen (zwei Mieter "Schmidt") wie handhaben? | Stammdaten-UX | Geschäftspartner mit zusätzlichem internem Bezeichner; UI zeigt Adresse als Disambiguator |
| 14 | i18n-Datumsformat / Lokalisierung | Frontend-Setup | de-DE als Default, ISO 8601 intern |
| 15 | Daten-Export-Format (DSGVO Art. 15) | Compliance | JSON-Dump pro Partner / Benutzer; CSV-Export als Bonus |
| 16 | Mandant-Onboarding-Self-Service oder nur Tim/Senior-Entwickler? | Stufe-1-Scope | nur via Admin-Skript, Self-Service ist Stufe 3+ |

---

## 16. Was sich aus dem Mockup an Erkenntnissen für die Implementierung mitnehmen lässt

- **Power-Layout-Konvention** ist im Mockup als Hook + Komponenten ausgereift und für alle Listenansichten konsistent. Diese Konvention 1:1 übernehmen — User-Erwartung (Joachim hat sie freigegeben) ist gesetzt.
- **Stammdaten-konfigurierbar** statt hartcodiert ist verbindlich (siehe Memory-Konvention „Auswahllisten als Default"). Bei jeder neuen Funktion prüfen: müsste das eine Auswahlliste sein?
- **Frau-Zwittich-Regel** ist im Mockup über `istAdmin` umgesetzt. Im Produktivsystem wird das über das echte RBAC-System gelöst, sobald Teil A aus dem Berechtigungskonzept umgesetzt ist (in Stufe 1 noch im Backlog).
- **Mobile-Verhalten** im Mockup ist die UX-Validierung der späteren PWA-Touch-UI. Identische Komponenten verwenden, nicht zwei Code-Pfade.

---

## Anhang A — Versionsgeschichte

| Version | Datum | Änderung |
|---------|-------|----------|
| 0.1 | 2026-05-20 | Erster Entwurf (Senior-Adressat, Tech-Stack als Optionen) |
| 0.2 | 2026-05-20 | Plattform-Anker-Kapitel hinzugefügt (Bounded Contexts `core/` vs. `fm-tickets/`, Pattern-Library `docs/patterns/`, ADR `plattform-relevant`-Marker, 8 Plattform-Kandidaten-Module). Aufwand +8 PT für Plattform-Disziplin. Ordnerstruktur in Kapitel 12.3 entsprechend angepasst. |
| 0.3 | 2026-05-20 | Stufenmodell auf 4 Stufen geschärft (siehe plan.md v4): Stufe 1 MVP-Pilot · Stufe 2 Vollausbau + KI aktiv · Stufe 2a Mieter-Portal (optional) · Stufe 3 Vermarktung & Plattform-Aktiv. „Explizit nicht in Stufe 1"-Liste pro Punkt mit Ziel-Stufe versehen. Outlook-`mailto:`-Trigger als Stufe-1-Funktion ergänzt. |
| 0.4 | 2026-05-21 | **KI-Light in Stufe 1 verankert** (Begründung: Joachim auf Pilot-Kurs nach Call am 2026-05-21). API-Key-Admin-UI, LLM-Gateway produktiv mit Pseudonymisierung, 3 Use Cases live (Schreibassistenz, Triage-Vorschlag, Ähnliche-Tickets-Suche Admin-only). Kapitel 6 komplett umgebaut. Aufwand +12–15 PT (Stufe-1-Summe jetzt ~107 PT, mit Reserve ~120–130 PT). Plattform-Kandidaten in Kapitel 13.3 um `llm-gateway` (9. Modul) erweitert. |
| 0.5 | 2026-05-21 | **Dokumenten-Verwaltung in Stufe 1 verankert** als eigene Stammdaten-Entität (`dokument` + 4 n:m-Tabellen + `dokument_kategorie`). Schema in Kapitel 2.7, REST-Endpoints in Kapitel 3.2, `.msg`/`.eml`-Parser, Deduplikation per SHA-256. Foto-Galerie bleibt getrennt (Annotation-Workflow). Plattform-Kandidaten erweitert um `dokumente` (10. Modul). Aufwand +8 PT (Stufe-1-Summe jetzt ~115 PT, mit Reserve ~130–140 PT). |
| 0.6 | 2026-05-21 | **Senior-Review-Gate ersetzt durch 12-Schichten-Sicherheitsarchitektur** (Tim-Entscheidung). Kapitel 10.3 komplett umgebaut: Semgrep/CodeQL/Renovate/Pre-Commit/Audit/Feature-Flags/Pen-Test/Acceptance-Review-Gate durch Tim. Neue Sektion 10.4 mit verbindlicher 12-Punkte-PR-Selbstreview-Checkliste. CLAUDE.md projektspezifisch entsprechend angepasst. |

---

*Sobald Senior-Entwickler review + Aufwandsschätzung vorliegt, wird dieses Dokument zur verbindlichen Implementierungs-Grundlage. Änderungen danach via ADR.*
