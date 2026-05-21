#!/usr/bin/env bash
# Alembic migration wrapper — Schicht 8 of the security architecture:
#   1. pg_dump the current database to /var/backups/pg/<env>/pre-migrate-*.sql
#   2. run `alembic upgrade head`
#   3. on failure: keep the dump for restore via restore.sh
#
# Usage:
#   ENV=staging ./migrate.sh

set -euo pipefail

ENV="${ENV:-staging}"
BACKUP_DIR="/var/backups/pg/${ENV}"
COMPOSE_FILE="/srv/fm-stoerungen/${ENV}/docker-compose.${ENV}.yml"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${BACKUP_DIR}/pre-migrate-${TIMESTAMP}.sql.gz"

echo "[migrate] Dumping database to ${DUMP_FILE} …"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-fm_stoerungen}" --no-owner \
  | gzip > "${DUMP_FILE}"

echo "[migrate] Running alembic upgrade head …"
docker compose -f "${COMPOSE_FILE}" exec -T api alembic upgrade head

echo "[migrate] Done. Dump kept at ${DUMP_FILE}"

# Rotate: keep last 30 days
find "${BACKUP_DIR}" -name 'pre-migrate-*.sql.gz' -type f -mtime +30 -delete || true
