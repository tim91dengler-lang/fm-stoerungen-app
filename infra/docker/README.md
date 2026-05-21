# Docker-Compose-Stacks

Drei Stacks für drei Umgebungen.

## `docker-compose.dev.yml` — Lokales Dev-Setup

Startet Postgres + API mit Hot-Reload. Frontend läuft separat via `npm run dev` für Vite-HMR.

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
cd apps/web && npm install && npm run dev
# → API auf http://localhost:8000, Web auf http://localhost:5173
```

Alembic-Migrationen manuell ausführen (Schicht 8 — kein Auto-Migrate im Dev):

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec api \
  alembic upgrade head
```

Dev-Seed:

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec api \
  python -m scripts.seed_dev
```

## `docker-compose.staging.yml` — Staging-Stack auf dem Server

Läuft auf dem Hetzner-Server parallel zum Prod-Stack. Ports 8080/8443.

Erwartete ENV-Variablen (über `.env` oder Deploy-Pipeline):
- `REGISTRY` — Container-Registry (z. B. ghcr.io/tim91dengler-lang)
- `API_TAG`, `WEB_TAG` — Image-Tags (Default: latest)
- `POSTGRES_PASSWORD`, `JWT_SECRET` — Secrets
- `DOMAIN` — z. B. `fm-app.tdengler-consulting.com`

Deploy-Workflow: jeder Merge auf `main` deployt automatisch nach Staging.

## `docker-compose.prod.yml` — Prod-Stack

Identische Form wie Staging, Ports 80/443, getrennte Volumes (`pg_data_prod`).

Deploy: nur via manuellem `workflow_dispatch` in GitHub Actions („Promote to Production"). Schicht 7.

## Verwandte Dateien

- `Caddyfile.staging`, `Caddyfile.prod` — Reverse-Proxy-Konfig
- `postgres-init.sql` — Extensions (`pg_trgm`, `vector`, `pgcrypto`)
- `../scripts/migrate.sh` — Wrapper: `pg_dump` + `alembic upgrade head` (Schicht 8)
- `../scripts/restore.sh` — Restore aus Backup
