#!/usr/bin/env bash
# Alembic migration wrapper — Schicht 8 of the security architecture:
#   1. pg_dump the current database to /var/backups/pg/<env>/pre-migrate-*.sql
#   2. run `alembic upgrade head` against the **newly pulled** API image
#   3. on failure: keep the dump for restore via restore.sh
#
# Usage:
#   ENV=staging ./migrate.sh
#
# 2026-05-26 (Track 2): switched from `exec` to `run --rm` so the migration
# uses the newly pulled image instead of the still-running old container.
# `exec` would have applied the migrations bundled in the OLD code, which
# silently skipped 0015_tickettyp_aktiv (caused 500 on Tickettyp-INSERT
# because the `aktiv` column was missing in the live DB).

set -euo pipefail

ENV="${ENV:-staging}"
BACKUP_DIR="/var/backups/pg/${ENV}"
DEPLOY_DIR="/srv/fm-stoerungen/${ENV}"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.${ENV}.yml"
ENV_FILE="${DEPLOY_DIR}/.env"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${BACKUP_DIR}/pre-migrate-${TIMESTAMP}.sql.gz"

echo "[migrate] Dumping database to ${DUMP_FILE} …"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-fm_stoerungen}" --no-owner \
  | gzip > "${DUMP_FILE}"

echo "[migrate] Running alembic upgrade head against newly pulled image …"
# `run --rm` spins up a fresh, ephemeral container from the just-pulled
# image (which contains the latest alembic/versions/*.py). The container
# is on the compose network so the api can reach the postgres service by
# hostname. `--no-deps` because postgres is already running.
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" \
  run --rm --no-deps api alembic upgrade head

echo "[migrate] Done. Dump kept at ${DUMP_FILE}"

# Rotate: keep last 30 days
find "${BACKUP_DIR}" -name 'pre-migrate-*.sql.gz' -type f -mtime +30 -delete || true
