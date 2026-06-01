"""Ticket: wartet_beteiligter_id — Wartet-Kontakt aus den Beteiligten ziehen

Revision ID: 0027
Revises: 0026
Create Date: 2026-06-01

Tim 2026-06-01: der Wartet-Block soll keine eigenen Kontaktfelder mehr pflegen,
sondern auf einen der Ticket-Beteiligten zeigen (eine Datenquelle). Neue, nullbare
FK auf ``ticket_beteiligte``; Kontaktdaten werden read-only aus dem gewählten
Beteiligten aufgelöst (im Frontend aus der ohnehin geladenen Liste).

``ON DELETE SET NULL``: wird der Beteiligte vom Ticket entfernt, fällt der Zeiger
sauber weg. (Zirkuläre FK tickets ↔ ticket_beteiligte ist unkritisch: der Zeiger
ist nullbar und wird erst gesetzt, wenn beide Zeilen existieren; beim Löschen des
Tickets räumt der CASCADE auf ticket_beteiligte.ticket_id auf.)

Expand-only: nur eine nullable Spalte. Die Alt-Spalten (wartet_nachunternehmer_id,
wartet_kontakt_*) bleiben vorerst als Lese-Fallback bestehen; ihr DROP folgt als
separate Contract-Migration, sobald der kontaktfeld-freie Code überall live ist.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tickets",
        sa.Column("wartet_beteiligter_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tickets_wartet_beteiligter_id",
        "tickets",
        "ticket_beteiligte",
        ["wartet_beteiligter_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tickets_wartet_beteiligter_id", "tickets", ["wartet_beteiligter_id"])


def downgrade() -> None:
    op.drop_index("ix_tickets_wartet_beteiligter_id", table_name="tickets")
    op.drop_constraint("fk_tickets_wartet_beteiligter_id", "tickets", type_="foreignkey")
    op.drop_column("tickets", "wartet_beteiligter_id")
