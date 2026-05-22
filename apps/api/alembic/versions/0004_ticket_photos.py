"""Slice 2 — Fotogalerie pro Ticket (TicketPhoto + lokales File-Storage)

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-22

Tabelle ``ticket_photos``: Foto-Metadaten + Pfad zur Datei im
File-Storage-Volume (default ``/var/uploads/fm/<photo_id>.<ext>``).
Annotations als JSONB für B5 (Stempel + Markier-Kreise).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_photos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column(
            "annotations",
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
            name="fk_ticket_photos_ticket_id_tickets",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_user_id"],
            ["users.id"],
            name="fk_ticket_photos_uploaded_by_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_ticket_photos_ticket_id_created_at",
        "ticket_photos",
        ["ticket_id", "created_at"],
    )

    op.execute("""
        CREATE TRIGGER audit_ticket_photos
        AFTER INSERT OR UPDATE OR DELETE ON ticket_photos
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_ticket_photos ON ticket_photos;")
    op.drop_index("ix_ticket_photos_ticket_id_created_at", table_name="ticket_photos")
    op.drop_table("ticket_photos")
