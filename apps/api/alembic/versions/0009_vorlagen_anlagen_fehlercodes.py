"""Slice 1 — Vorlagen-Engine + Anlagen + Fehlercodes + Icon-Spalte (Mockup-Treue 2026-05-21)

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-22

Setzt das Mockup-Datenmodell um:
- `tickettyp_feld`: Sichtbar/Pflicht/Reihenfolge pro System-Feld je Vorlage
  (Custom-Felder vorerst raus laut Tim 2026-05-22; Schema vorbereitet)
- `anlagen`: technische Einrichtungen (RLT, Heizkreis, BMA, …), optional
  an Objekt + Stockwerk gebunden
- `fehlercodes`: Stammvorlagen für wiederkehrende Störungen mit Code + Lösung
- `tickets.anlage_id`, `tickets.fehlercode_id`: FK auf neue Tabellen
- `auswahllisten_werte.icon_name`: Icon-Slug für Auswahlwerte
  (Status, Prio, Wartet-Grund, Kategorie …)
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Mockup-konforme System-Feld-Spec pro Tickettyp.
# Pflicht-Default für Reparatur ist: titel, objekt, partner, prio, beschreibung
# Für Wartung: titel, objekt, partner, anlage, beschreibung, faelligkeit_am
# Für Baubegehung: titel, objekt, beschreibung, faelligkeit_am
SYSTEM_FELDER_SPEC = {
    "reparatur": [
        # (feld_key, label, sichtbar, pflicht, reihenfolge)
        ("titel", "Titel", True, True, 0),
        ("objekt", "Objekt", True, True, 1),
        ("haus", "Haus", True, False, 2),
        ("stockwerk", "Stockwerk", True, False, 3),
        ("einheit", "Einheit", True, False, 4),
        ("anlage", "Anlage", True, False, 5),
        ("partner", "Partner", True, True, 6),
        ("kategorie", "Kategorie", True, False, 7),
        ("prio", "Priorität", True, True, 8),
        ("pin", "Foto-Pin", True, False, 9),
        ("melder", "Melder", True, False, 10),
        ("quelle", "Eingangskanal", True, False, 11),
        ("beschreibung", "Beschreibung", True, True, 12),
        ("foto", "Foto", True, False, 13),
        ("dokumente", "Dokumente", True, False, 14),
        ("projekt", "Projekt", True, False, 15),
        ("faelligkeit_am", "Fälligkeitsdatum", False, False, 16),
        ("wiederholung", "Wiederholung", False, False, 17),
        ("fehlercode", "Fehlercode", True, False, 18),
    ],
    "wartung": [
        ("titel", "Titel", True, True, 0),
        ("objekt", "Objekt", True, True, 1),
        ("haus", "Haus", True, False, 2),
        ("stockwerk", "Stockwerk", True, False, 3),
        ("anlage", "Anlage", True, True, 4),
        ("faelligkeit_am", "Fälligkeitsdatum", True, True, 5),
        ("wiederholung", "Wiederholung", True, False, 6),
        ("partner", "Partner", True, True, 7),
        ("kategorie", "Kategorie", True, False, 8),
        ("prio", "Priorität", True, False, 9),
        ("beschreibung", "Beschreibung", True, True, 10),
        ("foto", "Foto", True, False, 11),
        ("dokumente", "Dokumente", True, False, 12),
        ("projekt", "Projekt", True, False, 13),
        ("einheit", "Einheit", False, False, 14),
        ("melder", "Melder", False, False, 15),
        ("quelle", "Eingangskanal", False, False, 16),
        ("pin", "Foto-Pin", False, False, 17),
        ("fehlercode", "Fehlercode", False, False, 18),
    ],
    "baubegehung": [
        ("titel", "Titel", True, True, 0),
        ("objekt", "Objekt", True, True, 1),
        ("haus", "Haus", True, False, 2),
        ("stockwerk", "Stockwerk", True, False, 3),
        ("einheit", "Einheit", True, False, 4),
        ("partner", "Partner", True, False, 5),
        ("prio", "Priorität", True, False, 6),
        ("faelligkeit_am", "Fälligkeitsdatum", True, True, 7),
        ("pin", "Foto-Pin", True, False, 8),
        ("beschreibung", "Beschreibung", True, True, 9),
        ("foto", "Foto", True, False, 10),
        ("dokumente", "Dokumente", True, False, 11),
        ("projekt", "Projekt", True, False, 12),
        ("anlage", "Anlage", False, False, 13),
        ("kategorie", "Kategorie", False, False, 14),
        ("melder", "Melder", False, False, 15),
        ("quelle", "Eingangskanal", False, False, 16),
        ("wiederholung", "Wiederholung", False, False, 17),
        ("fehlercode", "Fehlercode", False, False, 18),
    ],
}


def upgrade() -> None:
    # ============================================================
    # 1) Auswahlwerte um icon_name erweitern
    # ============================================================
    op.add_column(
        "auswahllisten_werte",
        sa.Column("icon_name", sa.String(64), nullable=True),
    )

    # ============================================================
    # 2) tickettyp_feld — Sichtbar/Pflicht/Reihenfolge je Vorlage
    # ============================================================
    op.create_table(
        "tickettyp_feld",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tickettyp_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feld_key", sa.String(64), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column(
            "ist_system_feld",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "sichtbar",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "pflicht",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "nur_admin_sichtbar",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
            ["tickettyp_id"],
            ["tickettypen.id"],
            name="fk_tickettyp_feld_tickettyp_id_tickettypen",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "tickettyp_id", "feld_key", name="uq_tickettyp_feld_tickettyp_feld_key"
        ),
    )
    op.create_index("ix_tickettyp_feld_tickettyp_id", "tickettyp_feld", ["tickettyp_id"])

    # Audit-Trigger
    op.execute("""
        CREATE TRIGGER audit_tickettyp_feld
        AFTER INSERT OR UPDATE OR DELETE ON tickettyp_feld
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    """)

    # System-Felder seeden für die 3 existierenden Tickettypen.
    # rows_sql + tt_key sind aus der hartkodierten SYSTEM_FELDER_SPEC oben —
    # kein User-Input. `noqa: S608` deshalb erlaubt.
    for tt_key, felder in SYSTEM_FELDER_SPEC.items():
        rows_sql = ",\n              ".join(
            f"('{k}', '{lbl}', {str(s).lower()}, {str(p).lower()}, {r})"
            for k, lbl, s, p, r in felder
        )
        sql = f"""
            INSERT INTO tickettyp_feld
                (tickettyp_id, feld_key, label, sichtbar, pflicht, reihenfolge)
            SELECT tt.id, v.feld_key, v.label, v.sichtbar, v.pflicht, v.reihenfolge
            FROM tickettypen tt
            CROSS JOIN (VALUES
              {rows_sql}
            ) AS v(feld_key, label, sichtbar, pflicht, reihenfolge)
            WHERE tt.key = '{tt_key}'
            ON CONFLICT (tickettyp_id, feld_key) DO NOTHING;
            """  # noqa: S608
        op.execute(sql)

    # ============================================================
    # 3) anlagen — technische Einrichtungen
    # ============================================================
    op.create_table(
        "anlagen",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bezeichnung", sa.String(200), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column("icon_name", sa.String(64), nullable=True),
        sa.Column(
            "kategorie_wert_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="FK auf auswahllisten_werte (Auswahlliste = ticket_kategorie)",
        ),
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("stockwerk_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "aktiv",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
            name="fk_anlagen_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["kategorie_wert_id"],
            ["auswahllisten_werte.id"],
            name="fk_anlagen_kategorie_wert_id_auswahllisten_werte",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["objekt_id"],
            ["objekte.id"],
            name="fk_anlagen_objekt_id_objekte",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["stockwerk_id"],
            ["objekt_stockwerk.id"],
            name="fk_anlagen_stockwerk_id_objekt_stockwerk",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_anlagen_mandant_id", "anlagen", ["mandant_id"])
    op.create_index("ix_anlagen_objekt_id", "anlagen", ["objekt_id"])
    op.create_index("ix_anlagen_bezeichnung", "anlagen", ["mandant_id", "bezeichnung"])
    op.execute("""
        CREATE TRIGGER audit_anlagen
        AFTER INSERT OR UPDATE OR DELETE ON anlagen
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    """)

    # ============================================================
    # 4) fehlercodes
    # ============================================================
    op.create_table(
        "fehlercodes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("titel", sa.String(200), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column("loesung", sa.Text(), nullable=True),
        sa.Column("kategorie_wert_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prio_default_wert_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tickettyp_default_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("anlage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quelle", sa.String(64), nullable=True),
        sa.Column(
            "aktiv",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
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
            name="fk_fehlercodes_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["kategorie_wert_id"],
            ["auswahllisten_werte.id"],
            name="fk_fehlercodes_kategorie_wert_id_auswahllisten_werte",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["prio_default_wert_id"],
            ["auswahllisten_werte.id"],
            name="fk_fehlercodes_prio_default_wert_id_auswahllisten_werte",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tickettyp_default_id"],
            ["tickettypen.id"],
            name="fk_fehlercodes_tickettyp_default_id_tickettypen",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["anlage_id"],
            ["anlagen.id"],
            name="fk_fehlercodes_anlage_id_anlagen",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("mandant_id", "code", name="uq_fehlercodes_mandant_id_code"),
    )
    op.create_index("ix_fehlercodes_mandant_id", "fehlercodes", ["mandant_id"])
    op.create_index("ix_fehlercodes_anlage_id", "fehlercodes", ["anlage_id"])
    op.create_index(
        "ix_fehlercodes_titel_trgm",
        "fehlercodes",
        ["titel"],
        postgresql_using="gin",
        postgresql_ops={"titel": "gin_trgm_ops"},
    )
    op.execute("""
        CREATE TRIGGER audit_fehlercodes
        AFTER INSERT OR UPDATE OR DELETE ON fehlercodes
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
    """)

    # ============================================================
    # 5) tickets.anlage_id, tickets.fehlercode_id
    # ============================================================
    op.add_column(
        "tickets",
        sa.Column("anlage_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("fehlercode_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tickets_anlage_id_anlagen",
        "tickets",
        "anlagen",
        ["anlage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tickets_fehlercode_id_fehlercodes",
        "tickets",
        "fehlercodes",
        ["fehlercode_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tickets_anlage_id", "tickets", ["anlage_id"])
    op.create_index("ix_tickets_fehlercode_id", "tickets", ["fehlercode_id"])


def downgrade() -> None:
    op.drop_index("ix_tickets_fehlercode_id", table_name="tickets")
    op.drop_index("ix_tickets_anlage_id", table_name="tickets")
    op.drop_constraint("fk_tickets_fehlercode_id_fehlercodes", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_anlage_id_anlagen", "tickets", type_="foreignkey")
    op.drop_column("tickets", "fehlercode_id")
    op.drop_column("tickets", "anlage_id")

    op.execute("DROP TRIGGER IF EXISTS audit_fehlercodes ON fehlercodes;")
    op.drop_index("ix_fehlercodes_titel_trgm", table_name="fehlercodes")
    op.drop_index("ix_fehlercodes_anlage_id", table_name="fehlercodes")
    op.drop_index("ix_fehlercodes_mandant_id", table_name="fehlercodes")
    op.drop_table("fehlercodes")

    op.execute("DROP TRIGGER IF EXISTS audit_anlagen ON anlagen;")
    op.drop_index("ix_anlagen_bezeichnung", table_name="anlagen")
    op.drop_index("ix_anlagen_objekt_id", table_name="anlagen")
    op.drop_index("ix_anlagen_mandant_id", table_name="anlagen")
    op.drop_table("anlagen")

    op.execute("DROP TRIGGER IF EXISTS audit_tickettyp_feld ON tickettyp_feld;")
    op.drop_index("ix_tickettyp_feld_tickettyp_id", table_name="tickettyp_feld")
    op.drop_table("tickettyp_feld")

    op.drop_column("auswahllisten_werte", "icon_name")
