"""Slice 1 (plan.md v6 §5.2) — Vierstufige Objektstruktur: Objekt → Haus → Stockwerk → Einheit

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-22

Neue Tabellen:
- haus: jedes Objekt hat min. 1 Haus (UI zeigt Ebene erst bei 2+)
- objekt_stockwerk: Stockwerke pro Haus mit Ausrichtung + Grundriss
- stockwerk_einheit: Mieteinheiten pro Stockwerk
- einheit_mieter, stockwerk_mieter: n:m Mieter-Verknüpfung

tickets erweitert um haus_id / stockwerk_id / einheit_id (denormalisiert) +
pin_x / pin_y (Position auf dem Grundriss in %).

Datenmigration: für jedes bestehende Objekt wird ein „Haupthaus" angelegt,
damit das Constraint min-1-Haus erfüllt ist.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_AUDITED_TABLES = (
    "haus",
    "objekt_stockwerk",
    "stockwerk_einheit",
    "einheit_mieter",
    "stockwerk_mieter",
)


def upgrade() -> None:
    op.execute("CREATE TYPE stockwerk_ausrichtung AS ENUM ('nord','ost','sued','west')")

    op.create_table(
        "haus",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bezeichnung", sa.String(200), nullable=False),
        sa.Column("adresse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notiz", sa.Text(), nullable=True),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default="0"),
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
            name="fk_haus_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["objekt_id"],
            ["objekte.id"],
            name="fk_haus_objekt_id_objekte",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["adresse_id"],
            ["adressen.id"],
            name="fk_haus_adresse_id_adressen",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_haus_objekt_id", "haus", ["objekt_id"])

    op.create_table(
        "objekt_stockwerk",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("haus_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bezeichnung", sa.String(120), nullable=False),
        sa.Column(
            "ausrichtung",
            postgresql.ENUM(
                "nord",
                "ost",
                "sued",
                "west",
                name="stockwerk_ausrichtung",
                create_type=False,
            ),
            nullable=True,
        ),
        sa.Column("grundriss_storage_path", sa.String(500), nullable=True),
        sa.Column("grundriss_mime", sa.String(64), nullable=True),
        sa.Column("eigentuemer_partner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default="0"),
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
            name="fk_stockwerk_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["haus_id"],
            ["haus.id"],
            name="fk_stockwerk_haus_id_haus",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["eigentuemer_partner_id"],
            ["geschaeftspartner.id"],
            name="fk_stockwerk_eigentuemer_partner",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_stockwerk_haus_id", "objekt_stockwerk", ["haus_id"])

    op.create_table(
        "stockwerk_einheit",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stockwerk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bezeichnung", sa.String(120), nullable=False),
        sa.Column("groesse_qm", sa.Numeric(8, 2), nullable=True),
        sa.Column("eigentuemer_partner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default="0"),
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
            name="fk_einheit_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["stockwerk_id"],
            ["objekt_stockwerk.id"],
            name="fk_einheit_stockwerk_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["eigentuemer_partner_id"],
            ["geschaeftspartner.id"],
            name="fk_einheit_eigentuemer_partner",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_einheit_stockwerk_id", "stockwerk_einheit", ["stockwerk_id"])

    op.create_table(
        "einheit_mieter",
        sa.Column("einheit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["einheit_id"],
            ["stockwerk_einheit.id"],
            name="fk_einheit_mieter_einheit",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["geschaeftspartner.id"],
            name="fk_einheit_mieter_partner",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("einheit_id", "partner_id", name="pk_einheit_mieter"),
    )

    op.create_table(
        "stockwerk_mieter",
        sa.Column("stockwerk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["stockwerk_id"],
            ["objekt_stockwerk.id"],
            name="fk_stockwerk_mieter_stockwerk",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["geschaeftspartner.id"],
            name="fk_stockwerk_mieter_partner",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("stockwerk_id", "partner_id", name="pk_stockwerk_mieter"),
    )

    # Tickets: hierarchische Ortsangabe + Pin auf Grundriss
    op.add_column(
        "tickets",
        sa.Column("haus_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("stockwerk_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("einheit_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("pin_x", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("pin_y", sa.Numeric(5, 2), nullable=True),
    )
    op.create_foreign_key(
        "fk_tickets_haus_id_haus",
        "tickets",
        "haus",
        ["haus_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tickets_stockwerk_id_stockwerk",
        "tickets",
        "objekt_stockwerk",
        ["stockwerk_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tickets_einheit_id_einheit",
        "tickets",
        "stockwerk_einheit",
        ["einheit_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tickets_haus_id", "tickets", ["haus_id"])
    op.create_index("ix_tickets_stockwerk_id", "tickets", ["stockwerk_id"])
    op.create_index("ix_tickets_einheit_id", "tickets", ["einheit_id"])

    # Bestehende Objekte bekommen ein „Haupthaus" als Default-Haus.
    op.execute(
        """
        INSERT INTO haus (mandant_id, objekt_id, bezeichnung, adresse_id, reihenfolge)
        SELECT mandant_id, id, 'Haupthaus', adresse_id, 0
          FROM objekte
         WHERE deleted_at IS NULL;
        """
    )

    # Audit-Trigger
    for table in NEW_AUDITED_TABLES:
        op.execute(f"""
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """)


def downgrade() -> None:
    for table in NEW_AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")

    op.drop_index("ix_tickets_einheit_id", table_name="tickets")
    op.drop_index("ix_tickets_stockwerk_id", table_name="tickets")
    op.drop_index("ix_tickets_haus_id", table_name="tickets")
    op.drop_constraint("fk_tickets_einheit_id_einheit", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_stockwerk_id_stockwerk", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_haus_id_haus", "tickets", type_="foreignkey")
    op.drop_column("tickets", "pin_y")
    op.drop_column("tickets", "pin_x")
    op.drop_column("tickets", "einheit_id")
    op.drop_column("tickets", "stockwerk_id")
    op.drop_column("tickets", "haus_id")

    op.drop_table("stockwerk_mieter")
    op.drop_table("einheit_mieter")
    op.drop_table("stockwerk_einheit")
    op.drop_table("objekt_stockwerk")
    op.drop_table("haus")
    op.execute("DROP TYPE IF EXISTS stockwerk_ausrichtung")
