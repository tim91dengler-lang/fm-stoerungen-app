"""R5b — Eigentümer + Mieter auf Haus / Stockwerk / Einheit (m:n)

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-25

Tims R5-Anforderung: auf allen 3 Ebenen (Haus, Stockwerk, Einheit) sollen
mehrere Eigentümer (WEG-Fälle) und mehrere Mieter zuweisbar sein.

Datenmodell-Änderung:
- Neue Junction-Tabellen:
  - `haus_eigentuemer` (haus_id, partner_id) — m:n
  - `haus_mieter` (haus_id, partner_id) — m:n
  - `stockwerk_eigentuemer` (stockwerk_id, partner_id) — m:n (löst alte single FK ab)
  - `einheit_eigentuemer` (einheit_id, partner_id) — m:n (löst alte single FK ab)
- Daten-Migration: bestehende `eigentuemer_partner_id`-Werte aus
  `objekt_stockwerk` und `stockwerk_einheit` in die neuen Link-Tabellen
  überführen, dann die Spalten droppen.

`stockwerk_mieter` und `einheit_mieter` existieren bereits — die werden
weiterhin verwendet, kein Change.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Neue Junction-Tabellen anlegen.
    op.create_table(
        "haus_eigentuemer",
        sa.Column("haus_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["haus_id"], ["haus.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("haus_id", "partner_id"),
    )
    op.create_table(
        "haus_mieter",
        sa.Column("haus_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["haus_id"], ["haus.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("haus_id", "partner_id"),
    )
    op.create_table(
        "stockwerk_eigentuemer",
        sa.Column(
            "stockwerk_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["stockwerk_id"], ["objekt_stockwerk.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("stockwerk_id", "partner_id"),
    )
    op.create_table(
        "einheit_eigentuemer",
        sa.Column("einheit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["einheit_id"], ["stockwerk_einheit.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("einheit_id", "partner_id"),
    )

    # 2. Daten-Migration: bestehende Single-Eigentümer-FKs in m:n übertragen.
    #    Nur Zeilen mit gesetztem FK + soft-delete = NULL übertragen.
    op.execute(
        """
        INSERT INTO stockwerk_eigentuemer (stockwerk_id, partner_id)
        SELECT id, eigentuemer_partner_id
        FROM objekt_stockwerk
        WHERE eigentuemer_partner_id IS NOT NULL
          AND deleted_at IS NULL
        """  # noqa: S608
    )
    op.execute(
        """
        INSERT INTO einheit_eigentuemer (einheit_id, partner_id)
        SELECT id, eigentuemer_partner_id
        FROM stockwerk_einheit
        WHERE eigentuemer_partner_id IS NOT NULL
          AND deleted_at IS NULL
        """  # noqa: S608
    )

    # 3. Alte Single-FK-Spalten droppen.
    op.drop_column("objekt_stockwerk", "eigentuemer_partner_id")
    op.drop_column("stockwerk_einheit", "eigentuemer_partner_id")


def downgrade() -> None:
    # Re-create Single-FK-Spalten (nullable, kein Default).
    op.add_column(
        "stockwerk_einheit",
        sa.Column(
            "eigentuemer_partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geschaeftspartner.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "objekt_stockwerk",
        sa.Column(
            "eigentuemer_partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geschaeftspartner.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Best-effort: erste Zeile aus den Junction-Tabellen zurück in den FK.
    op.execute(
        """
        UPDATE stockwerk_einheit se
        SET eigentuemer_partner_id = ee.partner_id
        FROM (
          SELECT DISTINCT ON (einheit_id) einheit_id, partner_id
          FROM einheit_eigentuemer
          ORDER BY einheit_id, partner_id
        ) ee
        WHERE se.id = ee.einheit_id
        """  # noqa: S608
    )
    op.execute(
        """
        UPDATE objekt_stockwerk os
        SET eigentuemer_partner_id = se.partner_id
        FROM (
          SELECT DISTINCT ON (stockwerk_id) stockwerk_id, partner_id
          FROM stockwerk_eigentuemer
          ORDER BY stockwerk_id, partner_id
        ) se
        WHERE os.id = se.stockwerk_id
        """  # noqa: S608
    )

    # Junction-Tabellen droppen.
    op.drop_table("einheit_eigentuemer")
    op.drop_table("stockwerk_eigentuemer")
    op.drop_table("haus_mieter")
    op.drop_table("haus_eigentuemer")
