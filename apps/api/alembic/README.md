# Alembic Migrations

Verbindlich: jede Schema-Änderung läuft über Alembic, niemals direkt per SQL auf der DB.

## Befehle

```bash
# Neue Migration generieren (Autogenerate vergleicht Models gegen DB)
alembic revision --autogenerate -m "add tickets table"

# Migration anwenden
alembic upgrade head

# Eine Revision zurück
alembic downgrade -1

# Migrations-Stand prüfen
alembic current
alembic history
```

## Schicht 8 — Backup vor Migration

In Staging und Prod läuft `infra/scripts/migrate.sh` statt direktem `alembic upgrade`:
1. `pg_dump` schreibt vollständigen Dump nach `/var/backups/pg/pre-migrate-$(date).sql`
2. Erst dann `alembic upgrade head`
3. Bei Fehler: `infra/scripts/restore.sh` restored den letzten Dump in < 5 min

## Naming-Konvention

Datei-Prefix: 4-stellige laufende Nummer (`0001_initial_schema.py`, `0002_add_tickets.py`),
plus aussagekräftige Message (`-m "add tickets table"`).

Die Auto-Slug-Bildung von Alembic wird durch das `script.py.mako`-Template ergänzt.
