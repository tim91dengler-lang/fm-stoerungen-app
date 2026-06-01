"""Stufe C: frei konfigurierbare Block-Gruppierungen je Vorlage

Revision ID: 0028
Revises: 0027
Create Date: 2026-06-01

Konzept ``docs/concepts/Konzept_Vorlagendesigner_StufeC_2026-06-01.md``, PR C1.

Additiv (nichts Bestehendes wird zerstört):
- neue Tabelle ``tickettyp_block`` (Block je Vorlage, Region links/rechts) + Audit-Trigger
- ``tickettyp_feld.block_id`` (FK → tickettyp_block, ON DELETE SET NULL) — Feld→Block
- ``tickettypen.ist_alles_vorlage`` + Partial-Unique-Index (genau eine pro Mandant)

Backfill verlustfrei + idempotent: jede bestehende Vorlage bekommt die 7 System-Blöcke
(NOT EXISTS-Guard), jedes Feld seinen ``block_id`` über die code-bekannte feld_key→block_key-
Map (ungemappte → ``weitere``). ``reihenfolge`` wird ab jetzt block-lokal interpretiert
(ROW_NUMBER pro Block, Erhalt der bisherigen Reihenfolge). Die alte globale ``reihenfolge``
wird NICHT gedroppt (Expand/Contract).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1) Tabelle tickettyp_block
    op.create_table(
        "tickettyp_block",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tickettyp_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("block_key", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column(
            "region", sa.String(length=16), nullable=False, server_default=sa.text("'links'")
        ),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "ist_system_block", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "collapsible_default_open",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["tickettyp_id"], ["tickettypen.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "tickettyp_id", "block_key", name="uq_tickettyp_block_tickettyp_block_key"
        ),
    )
    op.create_index("ix_tickettyp_block_tickettyp_id", "tickettyp_block", ["tickettyp_id"])

    # Audit-Trigger (Einzel-UUID-PK → Standard-Trigger, kein Junction-Trick nötig)
    op.execute("DROP TRIGGER IF EXISTS audit_tickettyp_block ON tickettyp_block;")
    op.execute(
        """
        CREATE TRIGGER audit_tickettyp_block
        AFTER INSERT OR UPDATE OR DELETE ON tickettyp_block
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """
    )

    # 2) tickettyp_feld.block_id
    op.add_column(
        "tickettyp_feld",
        sa.Column("block_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tickettyp_feld_block_id",
        "tickettyp_feld",
        "tickettyp_block",
        ["block_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tickettyp_feld_block_id", "tickettyp_feld", ["block_id"])

    # 3) tickettypen.ist_alles_vorlage + Partial-Unique
    op.add_column(
        "tickettypen",
        sa.Column(
            "ist_alles_vorlage", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_alles_vorlage_pro_mandant "
        "ON tickettypen (mandant_id) WHERE ist_alles_vorlage;"
    )

    # 4) Backfill (verlustfrei + idempotent). VALUES inline (hartkodiert, kein
    # User-Input) — synchron zu SYSTEM_BLOECKE/DEFAULT_FELD_BLOCK_MAP im Service.
    # 4a) System-Blöcke pro Vorlage
    op.execute(
        """
        INSERT INTO tickettyp_block
            (id, tickettyp_id, block_key, label, region, reihenfolge,
             ist_system_block, collapsible_default_open, created_at, updated_at)
        SELECT gen_random_uuid(), t.id, b.block_key, b.label, b.region, b.reihenfolge,
               b.ist_system_block, true, now(), now()
        FROM tickettypen t
        CROSS JOIN (VALUES
            ('kopf','Kopf','links',0,true),
            ('problem','Problem & Bearbeitung','links',1,false),
            ('beteiligte','Kontakt & Beteiligte','links',2,false),
            ('verortung','Verortung','links',3,false),
            ('klassifizierung','Klassifizierung','links',4,false),
            ('belege','Belege & Kommunikation','rechts',0,false),
            ('weitere','Weitere Felder','links',5,true)
        ) AS b(block_key, label, region, reihenfolge, ist_system_block)
        WHERE NOT EXISTS (
            SELECT 1 FROM tickettyp_block tb
            WHERE tb.tickettyp_id = t.id AND tb.block_key = b.block_key
        );
        """
    )
    # 4b) Feld → Block über die Map
    op.execute(
        """
        UPDATE tickettyp_feld f
        SET block_id = tb.id
        FROM tickettyp_block tb,
             (VALUES
                ('titel','kopf'),
                ('beschreibung','problem'),('faelligkeit_am','problem'),('wiederholung','problem'),
                ('partner','beteiligte'),
                ('objekt','verortung'),('haus','verortung'),('stockwerk','verortung'),
                ('einheit','verortung'),('adresse','verortung'),('anlage','verortung'),
                ('pin','verortung'),
                ('prio','klassifizierung'),('kategorie','klassifizierung'),
                ('quelle','klassifizierung'),('projekt','klassifizierung'),
                ('fehlercode','klassifizierung'),
                ('foto','belege'),('dokumente','belege')
             ) AS m(feld_key, block_key)
        WHERE f.feld_key = m.feld_key
          AND tb.tickettyp_id = f.tickettyp_id
          AND tb.block_key = m.block_key
          AND f.block_id IS NULL;
        """
    )
    # 4c) Ungemappte/Custom-Felder → Auffang-Block "weitere"
    op.execute(
        """
        UPDATE tickettyp_feld f
        SET block_id = tb.id
        FROM tickettyp_block tb
        WHERE tb.tickettyp_id = f.tickettyp_id
          AND tb.block_key = 'weitere'
          AND f.block_id IS NULL;
        """
    )
    # 4d) reihenfolge block-lokal (Erhalt der bisherigen Reihenfolge je Block)
    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY tickettyp_id, block_id ORDER BY reihenfolge, feld_key
            ) - 1 AS rn
            FROM tickettyp_feld
        )
        UPDATE tickettyp_feld f
        SET reihenfolge = ranked.rn
        FROM ranked
        WHERE f.id = ranked.id;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_alles_vorlage_pro_mandant;")
    op.drop_column("tickettypen", "ist_alles_vorlage")
    op.drop_index("ix_tickettyp_feld_block_id", table_name="tickettyp_feld")
    op.drop_constraint("fk_tickettyp_feld_block_id", "tickettyp_feld", type_="foreignkey")
    op.drop_column("tickettyp_feld", "block_id")
    op.execute("DROP TRIGGER IF EXISTS audit_tickettyp_block ON tickettyp_block;")
    op.drop_index("ix_tickettyp_block_tickettyp_id", table_name="tickettyp_block")
    op.drop_table("tickettyp_block")
