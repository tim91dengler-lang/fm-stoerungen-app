"""Slice 1 — Dokumente als eigene Stammdaten-Entität (plan.md §5)

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-22

Drag-and-Drop von Dateien (PDF, .docx, .xlsx) und Outlook-Mails (.msg/.eml),
n:m-Verknüpfungen zu Ticket / Projekt / Objekt / Partner.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dokumente",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("kategorie", sa.String(64), nullable=True),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column(
            "hochgeladen_von_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
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
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_dokumente_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["hochgeladen_von_user_id"],
            ["users.id"],
            name="fk_dokumente_hochgeladen_von_user_id_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_dokumente_mandant_id", "dokumente", ["mandant_id"])
    op.create_index("ix_dokumente_kategorie", "dokumente", ["mandant_id", "kategorie"])

    op.create_table(
        "dokument_links",
        sa.Column("dokument_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["dokument_id"],
            ["dokumente.id"],
            name="fk_dokument_links_dokument_id_dokumente",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "dokument_id",
            "target_type",
            "target_id",
            name="pk_dokument_links",
        ),
    )
    op.create_index("ix_dokument_links_target", "dokument_links", ["target_type", "target_id"])

    op.execute("""
        CREATE TRIGGER audit_dokumente
        AFTER INSERT OR UPDATE OR DELETE ON dokumente
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_dokumente ON dokumente;")
    op.drop_index("ix_dokument_links_target", table_name="dokument_links")
    op.drop_table("dokument_links")
    op.drop_index("ix_dokumente_kategorie", table_name="dokumente")
    op.drop_index("ix_dokumente_mandant_id", table_name="dokumente")
    op.drop_table("dokumente")
