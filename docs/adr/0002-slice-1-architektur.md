# ADR 0002 — Slice-1-Architektur: Auth, Staging und Backup

- **Status:** Akzeptiert
- **Datum:** 2026-05-21
- **plattform-relevant:** teilweise (Auth-Wahl ist FM-spezifisch, Staging- und Backup-Pattern gelten plattformweit)

## Kontext

Slice 1 baut die erste echte Software-Schicht über dem Phase-0-Hello-World: Auth, User-CRUD und Tickets-CRUD. Drei Architektur-Entscheidungen müssen vor dem ersten Code stehen, weil sie Folgekosten haben:

1. **Auth-Stack**: Eigenes JWT-Login oder gleich Keycloak (OIDC)?
2. **Staging vs. Produktion**: Zwei Server oder ein Server mit zwei Stacks?
3. **Backup**: Welcher Mechanismus, welche Frequenz, wo liegen die Backups?

## Entscheidungen

### 1. Auth Phase 1 — Eigenes JWT-Login

**Option A — Eigenes JWT-Login (bcrypt + python-jose).**
- ⊕ Schnell aufgesetzt (~1 PT), kein Extra-Container
- ⊕ Volle Kontrolle über User-Modell, kein Schema-Lock-in
- ⊖ Externe Logins (Mieter-Portal) müssen später migriert werden
- ⊖ Eigene Login-UI, Passwort-Reset-Flow, Session-Logik

**Option B — Keycloak (OIDC) ab Tag 1.**
- ⊕ Standard-Auth, OIDC-fähig für alle künftigen Clients (Mobile, Mieter, externe)
- ⊕ Login-UI, Passwort-Reset, MFA out-of-the-box
- ⊖ Zusätzlicher Container, +200 MB RAM, Realm-Konfiguration, Theme-Anpassung
- ⊖ Aufwand 4–6 PT statt 1 PT
- ⊖ Overkill solange wir nur interne User haben

**Entscheidung: Option A** (Tim, 2026-05-21).

**Begründung:** In Stufe 1 sind nur interne FM-Mitarbeitende User. JWT ist ausreichend. Migration auf Keycloak erfolgt, sobald Stufe 2a (Mieter-Portal) ansteht — dann brauchen wir externe Logins, Self-Service-Registrierung und föderierte Identitäten. Bis dahin ist Keycloak Overhead.

**Konsequenzen:**

- `users`-Tabelle hält `password_hash` (bcrypt, cost 12)
- JWT-Tokens signiert mit HS256 (Symmetric), Secret aus Env
- Access-Token 15 min, Refresh-Token 7 Tage (HTTPOnly Cookie)
- Login-Endpoint: `POST /api/v1/auth/login` → `{access_token, refresh_token}`
- Refresh-Endpoint: `POST /api/v1/auth/refresh`
- Logout-Endpoint: `POST /api/v1/auth/logout` (Refresh-Token-Blacklist in Redis später, in Slice 1 nur clientseitig)
- Auth-Dependency in FastAPI: `Depends(get_current_user)`
- Frontend: `AuthContext` hält Token in Memory + Refresh-Token im HTTPOnly Cookie

**Migrations-Trigger zu Keycloak:**
- Stufe 2a beauftragt (Mieter-Portal mit externen Logins)
- Oder: >50 interne User mit Bedarf nach MFA / SSO

### 2. Staging und Produktion — Ein Server, zwei Docker-Compose-Stacks

**Option A — Zwei separate Server (Staging + Prod).**
- ⊕ Echter Spiegel, identische Infra
- ⊕ Staging-Crash betrifft Prod nicht
- ⊖ +5,80 €/Monat (zweiter CAX21)
- ⊖ Doppelte Wartung, doppelte SSH-Keys, doppelte Backups

**Option B — Ein Server, zwei Docker-Compose-Stacks.**
- ⊕ Spart 5,80 €/Monat
- ⊕ Einfacher zu warten, ein OS, ein UFW-Setup
- ⊕ Reicht für Stufe 1 mit ~10 internen Usern
- ⊖ Staging-Stack könnte Prod-Ressourcen ziehen (RAM, CPU)
- ⊖ Bei OS-Crash sind beide weg

**Entscheidung: Option B** (Tim, 2026-05-21).

**Begründung:** Solange wir keinen Live-Traffic haben, ist Ressourcen-Konkurrenz kein Problem. Migration auf zwei Server, sobald Pilot live geht.

**Konsequenzen:**

- Staging-Stack auf Ports 8080 (HTTP) / 8443 (HTTPS), Prod-Stack auf 80/443
- Subdomain-Routing über Caddy: `staging.fm-app.…` → Staging, `fm-app.…` → Prod (sobald Domain steht; bis dahin Path-Routing oder zwei IPs nicht nötig, da unterschiedliche Ports)
- Getrennte Postgres-Instanzen (zwei Container, eigene Volumes: `pg_data_staging`, `pg_data_prod`)
- Gemeinsame Docker-Engine, getrennte Netzwerke (`staging_net`, `prod_net`)
- Promote-Pfad: CI deployt auf Staging automatisch nach Merge auf `main`. Promote auf Prod über manuellen Workflow-Dispatch („Promote to Production"-Button in GitHub Actions UI). Schicht 7 der Sicherheitsarchitektur.

**Migrations-Trigger zu zwei Servern:**
- Pilot bei Joachim live (echter Traffic ≥ 5 User parallel)
- Oder: Staging-Workload stört Prod nachweislich

### 3. Backup — Hetzner-Snapshots täglich + pg_dump vor jeder Migration

**Option A — Nur Hetzner-Snapshots (täglich, 7 Tage Retention).**
- ⊕ Vollständiger Server-Restore in <5 min möglich (RTO ✓)
- ⊕ 1,16 €/Monat (pro Snapshot 0,011 €/GB/Monat, ~20 GB Daten)
- ⊖ Snapshot ist Volume-Level, nicht logisch — bei Datenkorruption durch fehlerhafte Migration ist der Snapshot evtl. auch korrupt
- ⊖ Keine Granularität auf Tabellen-Ebene

**Option B — Nur pg_dump zu S3/B2.**
- ⊕ Logisches Backup, restore-fähig auf neue Maschine
- ⊕ Granular wiederherstellbar
- ⊖ Höherer Setup-Aufwand (Cron-Job, S3-Bucket, Zugangsdaten)
- ⊖ Storage-Kosten je nach Provider

**Option C — Beides kombiniert.**
- ⊕ Doppelte Sicherheit: Snapshot für „kompletten Server putt", pg_dump für „Migration putt"
- ⊕ pg_dump vor jeder Alembic-Migration als Pre-Hook → wir können automatisch zurück
- ⊖ Etwas mehr Komplexität, +5–8 PT Setup-Aufwand
- ⊖ Storage: zusätzlich ~1 €/Monat S3/B2

**Entscheidung: Option C** (Tim, 2026-05-21).

**Begründung:** Schicht 8 der Sicherheitsarchitektur verlangt rollback-fähige Deployments mit automatischem DB-Backup vor jeder Migration. Snapshots allein reichen für Volume-Crash, pg_dump ist die Garantie für Migrations-Pannen.

**Konsequenzen:**

- **Hetzner-Snapshots**: täglich automatisch über Hetzner Cloud Console, 7 Tage Retention
- **pg_dump vor Migration**: Alembic-Wrapper-Skript `infra/scripts/migrate.sh` macht erst `pg_dump > /backups/pre-migrate-$(date).sql`, dann `alembic upgrade head`. Backup wird mit gepackt und nach 30 Tagen rotiert.
- **Backup-Storage**: erste Stufe lokal auf Server (`/var/backups/pg/`), zweite Stufe Hetzner Object Storage (S3-kompatibel, ~0,30 €/Monat für 5 GB). Off-Site-Sicherung über `restic` mit verschlüsseltem Bucket.
- **Restore-Drill**: einmalig vor Pilot-Go-Live testen (Schicht 8: RTO < 5 min). Restore-Skript `infra/scripts/restore.sh` parametrisiert.
- **Backup-Verifikation**: Sentry-Alert wenn `pg_dump` länger als 60 s dauert oder fehlt.

## Aufwand

- Auth Slice 1: ~1 PT (statt 4–6 PT für Keycloak)
- Staging-Stack-Setup: ~1 PT
- Backup-Skripte + Object-Storage-Setup: ~1 PT
- Restore-Drill (vor Pilot): ~0,5 PT
- **Summe Slice-1-Foundation: ~3,5 PT** (im 1,5–2-Wochen-Budget enthalten)

## Bezug

- Tech-Spec [`docs/tech-spec.md`](../tech-spec.md) Kapitel 10.3 (12-Schichten-Sicherheitsarchitektur, Schichten 7 + 8)
- Plan [`docs/plan.md`](../plan.md) Stufe 1
- ADR [`0001-plattform-anker-strategie.md`](0001-plattform-anker-strategie.md) — Bounded Contexts
