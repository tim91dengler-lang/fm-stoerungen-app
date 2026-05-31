"""Mehrere Grundriss-Pins je Ticket (Konzept TicketDetail_UX §3)

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-31

Fügt ``tickets.pins`` (JSONB-Liste ``[{x, y, label?}]``) als neue Quelle der
Wahrheit für die Grundriss-Markierungen hinzu. Bestehende Einzel-Pins aus
``pin_x``/``pin_y`` werden in die Liste übernommen.

Bewusst **expand-only**: ``pin_x``/``pin_y`` bleiben erhalten (Altlast,
späteres Cleanup), damit während des Deploys (Migration läuft vor dem
Container-Swap) die noch laufende alte API nicht über fehlende Spalten
stolpert. Idempotent (``IF NOT EXISTS`` + Backfill nur auf leere ``pins``).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pins JSONB NOT NULL DEFAULT '[]'::jsonb"
    )
    op.execute(
        "UPDATE tickets "
        "SET pins = jsonb_build_array(jsonb_build_object('x', pin_x, 'y', pin_y)) "
        "WHERE pin_x IS NOT NULL AND pin_y IS NOT NULL AND pins = '[]'::jsonb"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS pins")
