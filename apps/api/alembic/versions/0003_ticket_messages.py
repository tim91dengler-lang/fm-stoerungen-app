"""Slice 2 — Chat-Nachrichten pro Ticket (TicketMessage)

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-22

Tabelle ``ticket_messages``: Chat pro Ticket, Polling-basiert (kein WebSocket).
Audit-Trigger und Standard-Timestamp-Trigger laufen automatisch via Migration 0001.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("autor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "mentions",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["tickets.id"],
            name="fk_ticket_messages_ticket_id_tickets",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["autor_user_id"],
            ["users.id"],
            name="fk_ticket_messages_autor_user_id_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_ticket_messages_ticket_id_created_at",
        "ticket_messages",
        ["ticket_id", "created_at"],
    )

    op.execute("""
        CREATE TRIGGER audit_ticket_messages
        AFTER INSERT OR UPDATE OR DELETE ON ticket_messages
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_ticket_messages ON ticket_messages;")
    op.drop_index("ix_ticket_messages_ticket_id_created_at", table_name="ticket_messages")
    op.drop_table("ticket_messages")
