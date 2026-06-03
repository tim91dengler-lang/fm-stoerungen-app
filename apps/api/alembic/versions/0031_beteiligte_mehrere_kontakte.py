"""Beteiligte: mehrere Ansprechpartner pro Beteiligung (Modell A)

Revision ID: 0031
Revises: 0030
Create Date: 2026-06-03

Ein Beteiligter (Partner + Rolle) kann mehrere Ansprechpartner desselben Partners
tragen (z. B. Eigentümer „Familie Stein" → Herr + Frau Stein). Statt der einzelnen
``partner_kontakt_id`` bekommt jede ``*_beteiligte``-Tabelle eine Array-Spalte
``partner_kontakt_ids`` (UUID[]). Element-FKs sind in Postgres-Arrays nicht
erzwingbar — die Zugehörigkeit (Kontakt → Partner + Mandant) wird im Service
validiert (analog ``geschaeftspartner.typen``).

Die alte ``partner_kontakt_id`` wird gedroppt: sie wurde nie befüllt (UI/Backfill
0030 schrieben sie nicht), daher kein Datenverlust. Idempotent (IF EXISTS / IF NOT
EXISTS), damit Re-Runs / Teil-Anwendungen sauber durchlaufen.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ["objekt_beteiligte", "haus_beteiligte", "stockwerk_beteiligte", "einheit_beteiligte"]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(
            f"ALTER TABLE {table} "
            f"ADD COLUMN IF NOT EXISTS partner_kontakt_ids UUID[] NOT NULL DEFAULT '{{}}';"
        )
        # Singuläre Spalte (nie befüllt) entfernen; FK fällt mit der Spalte weg.
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS partner_kontakt_id;")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS partner_kontakt_id UUID;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS partner_kontakt_ids;")
