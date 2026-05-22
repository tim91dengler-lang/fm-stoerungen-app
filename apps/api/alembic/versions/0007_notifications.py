"""Slice 1 — Notifications (plan.md §5.6)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-22

Auslöser: @-Mention im Chat, Neue Zuweisung, Status-Wechsel in eigenem Ticket,
neue Chat-Nachricht in zugewiesenem Ticket, Wartung fällig.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("typ", sa.String(32), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("ref_message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ausloeser_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "gelesen",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_notifications_mandant_id_mandanten",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_notifications_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name="fk_notifications_ticket_id_tickets",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ref_message_id"],
            ["ticket_messages.id"],
            name="fk_notifications_ref_message_id_ticket_messages",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["ausloeser_user_id"],
            ["users.id"],
            name="fk_notifications_ausloeser_user_id_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_notifications_user_id_gelesen",
        "notifications",
        ["user_id", "gelesen", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id_gelesen", table_name="notifications")
    op.drop_table("notifications")
