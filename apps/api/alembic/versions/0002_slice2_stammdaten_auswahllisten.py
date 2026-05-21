"""Slice 2 — Auswahllisten, Adressen, Objekte, Partner, Ansichten + Ticket-Erweiterung

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-21

Schicht 9 + ADR 0004: Status- und Prio-ENUMs werden durch FK zu auswahllisten_werte
ersetzt. Audit-Trigger werden auf alle neuen Schreib-Tabellen ausgeweitet.

Datenmigration: bestehende tickets (Slice 1) werden auf die neuen Status-FKs
umgemappt. ENUM-Typen werden anschließend gedroppt.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_AUDITED_TABLES = (
    "adressen",
    "objekte",
    "objekt_partner",
    "geschaeftspartner",
    "auswahllisten",
    "auswahllisten_werte",
    "gespeicherte_ansichten",
)


def upgrade() -> None:
    # ============================================================
    # 1. AUSWAHLLISTEN (Engine — muss vor allem anderen kommen, weil
    #    tickets.status_id sie referenziert)
    # ============================================================
    op.create_table(
        "auswahllisten",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=True),
        sa.Column(
            "ist_system",
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
            name="fk_auswahllisten_mandant_id_mandanten",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("mandant_id", "key", name="uq_auswahllisten_mandant_id_key"),
    )
    op.create_index("ix_auswahllisten_mandant_id", "auswahllisten", ["mandant_id"])

    op.create_table(
        "auswahllisten_werte",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("auswahlliste_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("farbe", sa.String(32), nullable=True),
        sa.Column(
            "ist_aktiv",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "ist_system",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
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
            ["auswahlliste_id"],
            ["auswahllisten.id"],
            name="fk_auswahllisten_werte_auswahlliste_id_auswahllisten",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "auswahlliste_id", "key", name="uq_auswahllisten_werte_auswahlliste_id_key"
        ),
    )
    op.create_index(
        "ix_auswahllisten_werte_auswahlliste_id",
        "auswahllisten_werte",
        ["auswahlliste_id"],
    )

    # ============================================================
    # 2. ADRESSEN (ADR 0005 — Photon-Geocoding)
    # ============================================================
    op.create_table(
        "adressen",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("strasse", sa.String(200), nullable=False),
        sa.Column("hausnummer", sa.String(32), nullable=True),
        sa.Column("adresszusatz", sa.String(100), nullable=True),
        sa.Column("plz", sa.String(20), nullable=False),
        sa.Column("ort", sa.String(120), nullable=False),
        sa.Column(
            "land",
            sa.CHAR(2),
            nullable=False,
            server_default=sa.text("'DE'"),
        ),
        sa.Column("bemerkung", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("geocode_source", sa.String(32), nullable=True),
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
            name="fk_adressen_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("ix_adressen_mandant_id", "adressen", ["mandant_id"])
    op.create_index("ix_adressen_plz_ort", "adressen", ["mandant_id", "plz", "ort"])

    # ============================================================
    # 3. OBJEKTE (flach in Slice 2; Hierarchie Haus/Stockwerk/Einheit → Slice 3)
    # ============================================================
    op.create_table(
        "objekte",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("adresse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notiz", sa.Text(), nullable=True),
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
            name="fk_objekte_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["adresse_id"],
            ["adressen.id"],
            name="fk_objekte_adresse_id_adressen",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_objekte_mandant_id", "objekte", ["mandant_id"])
    op.create_index("ix_objekte_name", "objekte", ["mandant_id", "name"])

    # ============================================================
    # 4. GESCHÄFTSPARTNER (Typen als ARRAY-Spalte, nicht Junction-Tabelle)
    # ============================================================
    op.execute(
        "CREATE TYPE partner_typ AS ENUM ('mieter','eigentuemer','auftraggeber','nachunternehmer')"
    )

    op.create_table(
        "geschaeftspartner",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("ansprechpartner", sa.String(200), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("telefon", sa.String(64), nullable=True),
        sa.Column("adresse_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notiz", sa.Text(), nullable=True),
        sa.Column(
            "typen",
            postgresql.ARRAY(
                postgresql.ENUM(
                    "mieter",
                    "eigentuemer",
                    "auftraggeber",
                    "nachunternehmer",
                    name="partner_typ",
                    create_type=False,
                )
            ),
            nullable=False,
            server_default="{}",
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
            name="fk_geschaeftspartner_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["adresse_id"],
            ["adressen.id"],
            name="fk_geschaeftspartner_adresse_id_adressen",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_geschaeftspartner_mandant_id", "geschaeftspartner", ["mandant_id"])
    op.create_index("ix_geschaeftspartner_name", "geschaeftspartner", ["mandant_id", "name"])

    # Objekt ↔ Partner (n:m mit Rolle)
    op.create_table(
        "objekt_partner",
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "rolle",
            postgresql.ENUM(
                "mieter",
                "eigentuemer",
                "auftraggeber",
                "nachunternehmer",
                name="partner_typ",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["objekt_id"],
            ["objekte.id"],
            name="fk_objekt_partner_objekt_id_objekte",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["partner_id"],
            ["geschaeftspartner.id"],
            name="fk_objekt_partner_partner_id_geschaeftspartner",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("objekt_id", "partner_id", "rolle", name="pk_objekt_partner"),
    )

    # ============================================================
    # 5. GESPEICHERTE ANSICHTEN
    # ============================================================
    op.create_table(
        "gespeicherte_ansichten",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("view_key", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False),
        sa.Column(
            "ist_default",
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
            ["user_id"],
            ["users.id"],
            name="fk_gespeicherte_ansichten_user_id_users",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "user_id", "view_key", "name", name="uq_gespeicherte_ansichten_user_view_name"
        ),
    )
    op.create_index(
        "ix_gespeicherte_ansichten_user_view",
        "gespeicherte_ansichten",
        ["user_id", "view_key"],
    )

    # ============================================================
    # 6. TICKETS — ENUM → FK Migration (ADR 0004)
    # ============================================================
    # Neue Spalten erst nullable hinzufügen, dann Daten füllen, dann NOT NULL.
    op.add_column(
        "tickets",
        sa.Column("status_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("prioritaet_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("kategorie_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tickets",
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Seed-Logik: für jeden bestehenden Mandanten die System-Listen + Standard-Werte
    # anlegen, dann bestehende tickets.status / .prioritaet auf die neuen FKs mappen.
    # In Slice 1 gibt es 0 Tickets auf Prod, aber für lokale Tests müssen wir das
    # trotzdem korrekt machen.
    op.execute(
        """
        DO $$
        DECLARE
            m RECORD;
            liste_status_id UUID;
            liste_prio_id UUID;
            liste_kat_id UUID;
            wert_neu UUID;
            wert_pruefung UUID;
            wert_bearbeitung UUID;
            wert_wartet UUID;
            wert_erledigt UUID;
            wert_prio_niedrig UUID;
            wert_prio_mittel UUID;
            wert_prio_hoch UUID;
            wert_prio_kritisch UUID;
        BEGIN
            FOR m IN SELECT id FROM mandanten LOOP
                -- ticket_status-Liste
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'ticket_status', 'Ticket-Status', 'Status-Werte für Tickets', TRUE)
                RETURNING id INTO liste_status_id;

                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES
                    (liste_status_id, 'neu', 'Neu', 0, 'slate', TRUE),
                    (liste_status_id, 'pruefung', 'In Prüfung', 1, 'amber', TRUE),
                    (liste_status_id, 'bearbeitung', 'In Bearbeitung', 2, 'blue', TRUE),
                    (liste_status_id, 'wartet', 'Wartet', 3, 'orange', TRUE),
                    (liste_status_id, 'erledigt', 'Erledigt', 4, 'emerald', TRUE);

                SELECT id INTO wert_neu FROM auswahllisten_werte WHERE auswahlliste_id = liste_status_id AND key = 'neu';
                SELECT id INTO wert_pruefung FROM auswahllisten_werte WHERE auswahlliste_id = liste_status_id AND key = 'pruefung';
                SELECT id INTO wert_bearbeitung FROM auswahllisten_werte WHERE auswahlliste_id = liste_status_id AND key = 'bearbeitung';
                SELECT id INTO wert_wartet FROM auswahllisten_werte WHERE auswahlliste_id = liste_status_id AND key = 'wartet';
                SELECT id INTO wert_erledigt FROM auswahllisten_werte WHERE auswahlliste_id = liste_status_id AND key = 'erledigt';

                -- ticket_prioritaet-Liste
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'ticket_prioritaet', 'Ticket-Priorität', 'Prioritäten für Tickets', TRUE)
                RETURNING id INTO liste_prio_id;

                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES
                    (liste_prio_id, 'niedrig', 'Niedrig', 0, 'slate', TRUE),
                    (liste_prio_id, 'mittel', 'Mittel', 1, 'blue', TRUE),
                    (liste_prio_id, 'hoch', 'Hoch', 2, 'orange', TRUE),
                    (liste_prio_id, 'kritisch', 'Kritisch', 3, 'red', TRUE);

                SELECT id INTO wert_prio_niedrig FROM auswahllisten_werte WHERE auswahlliste_id = liste_prio_id AND key = 'niedrig';
                SELECT id INTO wert_prio_mittel FROM auswahllisten_werte WHERE auswahlliste_id = liste_prio_id AND key = 'mittel';
                SELECT id INTO wert_prio_hoch FROM auswahllisten_werte WHERE auswahlliste_id = liste_prio_id AND key = 'hoch';
                SELECT id INTO wert_prio_kritisch FROM auswahllisten_werte WHERE auswahlliste_id = liste_prio_id AND key = 'kritisch';

                -- ticket_kategorie-Liste (Default-Werte, Joachim kann ergänzen)
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'ticket_kategorie', 'Ticket-Kategorie', 'Gewerk / Kategorie der Störung', FALSE)
                RETURNING id INTO liste_kat_id;

                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe)
                VALUES
                    (liste_kat_id, 'heizung', 'Heizung', 0, 'red'),
                    (liste_kat_id, 'sanitaer', 'Sanitär', 1, 'cyan'),
                    (liste_kat_id, 'elektro', 'Elektro', 2, 'yellow'),
                    (liste_kat_id, 'aufzug', 'Aufzug', 3, 'purple'),
                    (liste_kat_id, 'sicherheit', 'Sicherheit', 4, 'rose'),
                    (liste_kat_id, 'allgemein', 'Allgemein', 5, 'slate');

                -- Bestehende Tickets dieses Mandanten auf die neuen FKs mappen
                UPDATE tickets SET
                    status_id = CASE status::text
                        WHEN 'neu' THEN wert_neu
                        WHEN 'zugewiesen' THEN wert_bearbeitung  -- semantisches Mapping
                        WHEN 'in_arbeit' THEN wert_bearbeitung
                        WHEN 'erledigt' THEN wert_erledigt
                        WHEN 'geschlossen' THEN wert_erledigt
                        ELSE wert_neu
                    END,
                    prioritaet_id = CASE prioritaet::text
                        WHEN 'niedrig' THEN wert_prio_niedrig
                        WHEN 'mittel' THEN wert_prio_mittel
                        WHEN 'hoch' THEN wert_prio_hoch
                        WHEN 'kritisch' THEN wert_prio_kritisch
                        ELSE wert_prio_mittel
                    END
                WHERE mandant_id = m.id;
            END LOOP;
        END $$;
        """
    )

    # Jetzt die alten ENUM-Spalten droppen, neue NOT NULL machen + FK-Constraints
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_prioritaet", table_name="tickets")
    op.drop_column("tickets", "status")
    op.drop_column("tickets", "prioritaet")
    op.execute("DROP TYPE IF EXISTS ticket_status")
    op.execute("DROP TYPE IF EXISTS ticket_prioritaet")

    op.alter_column("tickets", "status_id", nullable=False)
    op.alter_column("tickets", "prioritaet_id", nullable=False)

    op.create_foreign_key(
        "fk_tickets_status_id_auswahllisten_werte",
        "tickets",
        "auswahllisten_werte",
        ["status_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_tickets_prioritaet_id_auswahllisten_werte",
        "tickets",
        "auswahllisten_werte",
        ["prioritaet_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_tickets_kategorie_id_auswahllisten_werte",
        "tickets",
        "auswahllisten_werte",
        ["kategorie_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_tickets_objekt_id_objekte",
        "tickets",
        "objekte",
        ["objekt_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_tickets_partner_id_geschaeftspartner",
        "tickets",
        "geschaeftspartner",
        ["partner_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("ix_tickets_status_id", "tickets", ["status_id"])
    op.create_index("ix_tickets_prioritaet_id", "tickets", ["prioritaet_id"])
    op.create_index("ix_tickets_objekt_id", "tickets", ["objekt_id"])
    op.create_index("ix_tickets_partner_id", "tickets", ["partner_id"])

    # ============================================================
    # 7. AUDIT-TRIGGER auf neue Tabellen
    # ============================================================
    for table in NEW_AUDITED_TABLES:
        op.execute(f"""
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """)


def downgrade() -> None:
    # Audit-Trigger entfernen
    for table in NEW_AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")

    # Tickets-FKs zurück nach ENUM
    op.execute(
        "CREATE TYPE ticket_status AS ENUM "
        "('neu','zugewiesen','in_arbeit','erledigt','geschlossen')"
    )
    op.execute("CREATE TYPE ticket_prioritaet AS ENUM ('niedrig','mittel','hoch','kritisch')")
    op.add_column(
        "tickets",
        sa.Column(
            "status",
            postgresql.ENUM(name="ticket_status", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "tickets",
        sa.Column(
            "prioritaet",
            postgresql.ENUM(name="ticket_prioritaet", create_type=False),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE tickets t
        SET status = (SELECT key::text::ticket_status FROM auswahllisten_werte w WHERE w.id = t.status_id),
            prioritaet = (SELECT key::text::ticket_prioritaet FROM auswahllisten_werte w WHERE w.id = t.prioritaet_id);
        """
    )
    op.alter_column("tickets", "status", nullable=False)
    op.alter_column("tickets", "prioritaet", nullable=False)

    op.drop_constraint("fk_tickets_status_id_auswahllisten_werte", "tickets", type_="foreignkey")
    op.drop_constraint(
        "fk_tickets_prioritaet_id_auswahllisten_werte", "tickets", type_="foreignkey"
    )
    op.drop_constraint("fk_tickets_kategorie_id_auswahllisten_werte", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_objekt_id_objekte", "tickets", type_="foreignkey")
    op.drop_constraint("fk_tickets_partner_id_geschaeftspartner", "tickets", type_="foreignkey")
    op.drop_index("ix_tickets_status_id", table_name="tickets")
    op.drop_index("ix_tickets_prioritaet_id", table_name="tickets")
    op.drop_index("ix_tickets_objekt_id", table_name="tickets")
    op.drop_index("ix_tickets_partner_id", table_name="tickets")
    op.drop_column("tickets", "status_id")
    op.drop_column("tickets", "prioritaet_id")
    op.drop_column("tickets", "kategorie_id")
    op.drop_column("tickets", "objekt_id")
    op.drop_column("tickets", "partner_id")

    op.drop_table("gespeicherte_ansichten")
    op.drop_table("objekt_partner")
    op.drop_table("geschaeftspartner")
    op.drop_table("objekte")
    op.drop_table("adressen")
    op.drop_table("auswahllisten_werte")
    op.drop_table("auswahllisten")
    op.execute("DROP TYPE IF EXISTS partner_typ")
