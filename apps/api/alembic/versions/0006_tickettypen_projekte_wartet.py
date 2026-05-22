"""Slice 1 — Tickettypen + Projekte + Wartet-auf-Sub-Status + Quelle/Melder

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-22

Themen aus plan.md:
- §5.10 Tickettypen (Reparatur/Wartung/Baubegehung) → `tickettypen` Stammdaten
- §5.11 Projekte → `projekte` Tabelle + ticket.projekt_id
- §5.7 Wartet-auf-Sub-Status → Auswahlliste `wartet_grund` + ticket.wartet_grund_id +
  ticket.wartet_nachunternehmer_id + Kontakt-Felder
- §5.5 Quelle-Tracking → Auswahlliste `eingangskanal` + ticket.quelle_id +
  ticket.melder + ticket.tickettyp_id + ticket.faelligkeit_am + ticket.wiederholung
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_AUDITED_TABLES = (
    "tickettypen",
    "projekte",
)


def upgrade() -> None:
    # ============================================================
    # 1. TICKETTYPEN (Reparatur / Wartung / Baubegehung)
    # ============================================================
    op.create_table(
        "tickettypen",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(64), nullable=True),
        sa.Column("farbe", sa.String(32), nullable=True),
        sa.Column(
            "pflichtfelder",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("default_reminder_tage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ist_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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
            name="fk_tickettypen_mandant_id_mandanten",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("mandant_id", "key", name="uq_tickettypen_mandant_id_key"),
    )
    op.create_index("ix_tickettypen_mandant_id", "tickettypen", ["mandant_id"])

    # ============================================================
    # 2. PROJEKTE (Sammelposten)
    # ============================================================
    op.create_table(
        "projekte",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "verantwortlich_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("start_am", sa.Date(), nullable=True),
        sa.Column("ende_am", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="geplant",
        ),
        sa.Column("notizen", sa.Text(), nullable=True),
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
            name="fk_projekte_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["objekt_id"],
            ["objekte.id"],
            name="fk_projekte_objekt_id_objekte",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["verantwortlich_user_id"],
            ["users.id"],
            name="fk_projekte_verantwortlich_user_id_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_projekte_mandant_id", "projekte", ["mandant_id"])

    # ============================================================
    # 3. tickets erweitern
    # ============================================================
    op.add_column(
        "tickets",
        sa.Column("tickettyp_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("projekt_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("quelle_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("melder", sa.String(200), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("wartet_grund_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("wartet_nachunternehmer_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("wartet_kontakt_name", sa.String(200), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("wartet_kontakt_telefon", sa.String(64), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("wartet_kontakt_email", sa.String(255), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("faelligkeit_am", sa.Date(), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("wiederholung", sa.String(32), nullable=True),
    )

    op.create_foreign_key(
        "fk_tickets_tickettyp_id_tickettypen",
        "tickets",
        "tickettypen",
        ["tickettyp_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tickets_projekt_id_projekte",
        "tickets",
        "projekte",
        ["projekt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tickets_quelle_id_auswahllisten_werte",
        "tickets",
        "auswahllisten_werte",
        ["quelle_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_tickets_wartet_grund_id_auswahllisten_werte",
        "tickets",
        "auswahllisten_werte",
        ["wartet_grund_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_tickets_wartet_nachunternehmer_id_geschaeftspartner",
        "tickets",
        "geschaeftspartner",
        ["wartet_nachunternehmer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tickets_tickettyp_id", "tickets", ["tickettyp_id"])
    op.create_index("ix_tickets_projekt_id", "tickets", ["projekt_id"])
    op.create_index("ix_tickets_faelligkeit_am", "tickets", ["faelligkeit_am"])

    # ============================================================
    # 4. Per-Mandant-Seed: Tickettypen + Auswahllisten wartet_grund/eingangskanal
    # ============================================================
    op.execute(
        """
        DO $$
        DECLARE
            m RECORD;
            liste_wartet UUID;
            liste_quelle UUID;
            tt_reparatur UUID;
        BEGIN
            FOR m IN SELECT id FROM mandanten LOOP
                -- Tickettypen (3 System-Defaults): erst alle anlegen,
                -- dann die reparatur-id separat selecten (INSERT ... RETURNING
                -- INTO erlaubt nur eine Zeile pro Statement).
                INSERT INTO tickettypen (mandant_id, key, label, beschreibung, icon, farbe, pflichtfelder, default_reminder_tage, reihenfolge, ist_system)
                VALUES
                    (m.id, 'reparatur', 'Reparatur', 'Standard-Reparatur-Ticket', 'wrench', 'emerald', '["titel"]'::jsonb, 0, 0, TRUE),
                    (m.id, 'wartung',  'Wartung',  'Geplante Wartung mit Fälligkeit', 'calendar', 'blue', '["titel","faelligkeit_am"]'::jsonb, 7, 1, TRUE),
                    (m.id, 'baubegehung', 'Baubegehung', 'Termingebundene Begehung', 'binoculars', 'amber', '["titel","faelligkeit_am"]'::jsonb, 3, 2, TRUE);
                SELECT id INTO tt_reparatur FROM tickettypen
                  WHERE mandant_id = m.id AND key = 'reparatur';

                -- wartet_grund-Auswahlliste mit 4 Werten
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'wartet_grund', 'Wartet-auf-Sub-Status', 'Sub-Status wenn Ticket auf etwas wartet', TRUE)
                RETURNING id INTO liste_wartet;
                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES
                    (liste_wartet, 'material', 'Wartet auf Material', 0, 'orange', TRUE),
                    (liste_wartet, 'mieter', 'Wartet auf Mieter', 1, 'amber', TRUE),
                    (liste_wartet, 'freigabe', 'Wartet auf Freigabe', 2, 'sky', TRUE),
                    (liste_wartet, 'extern', 'Wartet auf Externen', 3, 'red', TRUE);

                -- eingangskanal-Auswahlliste
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'eingangskanal', 'Eingangskanal', 'Quelle der Ticket-Erfassung', TRUE)
                RETURNING id INTO liste_quelle;
                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES
                    (liste_quelle, 'manuell', 'Manuell', 0, 'slate', TRUE),
                    (liste_quelle, 'telefon', 'Telefon', 1, 'blue', TRUE),
                    (liste_quelle, 'web', 'Web-Formular', 2, 'emerald', TRUE),
                    (liste_quelle, 'mieter', 'Mieter-Portal', 3, 'violet', TRUE),
                    (liste_quelle, 'ebo', 'EBO / GLT', 4, 'orange', TRUE);

                -- bestehende Tickets bekommen tickettyp=reparatur
                UPDATE tickets SET tickettyp_id = tt_reparatur
                 WHERE mandant_id = m.id AND tickettyp_id IS NULL;
            END LOOP;
        END $$;
        """
    )

    # Audit-Trigger auf neue Schreib-Tabellen
    for table in NEW_AUDITED_TABLES:
        op.execute(f"""
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """)


def downgrade() -> None:
    for table in NEW_AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")

    op.drop_index("ix_tickets_faelligkeit_am", table_name="tickets")
    op.drop_index("ix_tickets_projekt_id", table_name="tickets")
    op.drop_index("ix_tickets_tickettyp_id", table_name="tickets")
    op.drop_constraint(
        "fk_tickets_wartet_nachunternehmer_id_geschaeftspartner", "tickets", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_tickets_wartet_grund_id_auswahllisten_werte", "tickets", type_="foreignkey"
    )
    op.drop_constraint("fk_tickets_quelle_id_auswahllisten_werte", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_projekt_id_projekte", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_tickettyp_id_tickettypen", "tickets", type_="foreignkey")
    op.drop_column("tickets", "wiederholung")
    op.drop_column("tickets", "faelligkeit_am")
    op.drop_column("tickets", "wartet_kontakt_email")
    op.drop_column("tickets", "wartet_kontakt_telefon")
    op.drop_column("tickets", "wartet_kontakt_name")
    op.drop_column("tickets", "wartet_nachunternehmer_id")
    op.drop_column("tickets", "wartet_grund_id")
    op.drop_column("tickets", "melder")
    op.drop_column("tickets", "quelle_id")
    op.drop_column("tickets", "projekt_id")
    op.drop_column("tickets", "tickettyp_id")
    op.drop_table("projekte")
    op.drop_table("tickettypen")
