"""Ticket-Spalte ``melder`` entfernen (durch Beteiligte vollständig abgelöst)

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-01

Tim 2026-06-01: der Melder/Anrufer ist durch die Beteiligten-Liste ersetzt; auch
die Alt-Werte in bestehenden Tickets sollen raus. Die Historie bleibt im
append-only ``system_audit`` erhalten, daher ist der Drop verlustfrei für die
Nachvollziehbarkeit.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS melder")


def downgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("melder", sa.String(length=200), nullable=True),
    )
