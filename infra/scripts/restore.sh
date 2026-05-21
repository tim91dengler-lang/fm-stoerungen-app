#!/usr/bin/env bash
# Restore latest (or named) pg_dump after a failed migration.
#
# Usage:
#   ENV=staging ./restore.sh                                  # restore latest
#   ENV=staging ./restore.sh pre-migrate-20260521T120000Z.sql.gz
#
# Schicht 8 — must restore in < 5 min.

set -euo pipefail

ENV="${ENV:-staging}"
BACKUP_DIR="/var/backups/pg/${ENV}"
COMPOSE_FILE="/srv/fm-stoerungen/${ENV}/docker-compose.${ENV}.yml"

DUMP_NAME="${1:-}"
if [[ -z "${DUMP_NAME}" ]]; then
  DUMP_NAME="$(ls -1t "${BACKUP_DIR}" | head -n1)"
  echo "[restore] Latest backup: ${DUMP_NAME}"
fi
DUMP_PATH="${BACKUP_DIR}/${DUMP_NAME}"

if [[ ! -f "${DUMP_PATH}" ]]; then
  echo "[restore] ERROR: ${DUMP_PATH} not found" >&2
  exit 1
fi

read -rp "[restore] This will REPLACE the current database with ${DUMP_NAME}. Continue? (yes/no): " confirm
if [[ "${confirm}" != "yes" ]]; then
  echo "[restore] Aborted."
  exit 0
fi

echo "[restore] Restoring ${DUMP_PATH} into ${ENV} …"

# Stop API so no connections fight the restore
docker compose -f "${COMPOSE_FILE}" stop api

# Drop + recreate the database
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER:-postgres}" -d postgres <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = '${POSTGRES_DB:-fm_stoerungen}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${POSTGRES_DB:-fm_stoerungen};
CREATE DATABASE ${POSTGRES_DB:-fm_stoerungen};
SQL

# Restore
gunzip -c "${DUMP_PATH}" | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-fm_stoerungen}"

# Bring API back up
docker compose -f "${COMPOSE_FILE}" start api

echo "[restore] Done."
