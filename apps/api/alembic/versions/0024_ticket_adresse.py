"""Ticket-eigene Adresse (frei wählbar, unabhängig vom Objekt)

Revision ID: 0024
Revises: 0023
Create Date: 2026-06-01

Tim 2026-06-01: ein Ticket soll eine eigene, frei eingebbare Adresse haben —
unabhängig vom zugeordneten Objekt. Default bleibt die Objekt-Adresse (vom
Frontend/Service aufgelöst), aber pro Ticket überschreibbar; auch Ticket OHNE
Objekt + eigene Adresse ist möglich.

Expand-only: nur eine nullable FK-Spalte. ondelete=SET NULL (wird die Adresse
gelöscht, bleibt das Ticket erhalten — wie bei Objekt.adresse_id).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("adresse_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tickets_adresse_id",
        "tickets",
        "adressen",
        ["adresse_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tickets_adresse_id", "tickets", ["adresse_id"])


def downgrade() -> None:
    op.drop_index("ix_tickets_adresse_id", table_name="tickets")
    op.drop_constraint("fk_tickets_adresse_id", "tickets", type_="foreignkey")
    op.drop_column("tickets", "adresse_id")
