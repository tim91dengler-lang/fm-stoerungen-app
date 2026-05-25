"""R6c — Partner-Modul-Refactor

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-25

Phase 6c: Geschäftspartner bekommen Hierarchie (parent_partner_id),
mehrere Kontakte (partner_kontakte 1:n), mehrere Adressen mit Typ
(partner_adressen Junction) und eine Soft-Sperre-Spalte. Objekte
bekommen ebenfalls eine Soft-Sperre-Spalte (R6c-Konvention).

Auswahllisten werden für jeden Mandanten geseedet:
  partner_typ, kontakt_rolle, anrede, rechtsform, branche, adresstyp

Daten-Migration:
  • bestehende `geschaeftspartner.adresse_id` → Eintrag in
    partner_adressen mit typ=Hauptsitz, ist_primaer=true
  • bestehende `geschaeftspartner.ansprechpartner`-Strings → werden
    in einen partner_kontakt-Datensatz überführt (mit Heuristik
    Titel/Vorname/Nachname). Bei vermuteten Privatpersonen
    (typen ⊃ {mieter, eigentuemer} + Name ohne Rechtsform-Endung +
    Personenmuster) gehen die Daten direkt an die Partner-
    Personenfelder, kein Kontakt-Datensatz.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Auswahllisten-Seeds (key, label, reihenfolge, farbe, beschreibung der Liste)
_LISTE_PARTNER_TYP = ("partner_typ", "Partner-Typ", "Funktionale Rolle eines Geschäftspartners")
_LISTE_KONTAKT_ROLLE = ("kontakt_rolle", "Kontakt-Rolle", "Rollen einer Kontaktperson am Partner")
_LISTE_ANREDE = ("anrede", "Anrede", "Schriftliche Anrede in Anschreiben")
_LISTE_RECHTSFORM = ("rechtsform", "Rechtsform", "Rechtsform eines Unternehmens")
_LISTE_BRANCHE = ("branche", "Branche", "Fachliche Branche / Tätigkeitsfeld")
_LISTE_ADRESSTYP = ("adresstyp", "Adresstyp", "Typ einer Partner-Adresse")

_WERTE_PARTNER_TYP = [
    ("mieter", "Mieter", 10, "blue"),
    ("eigentuemer", "Eigentümer", 20, "violet"),
    ("auftraggeber", "Auftraggeber", 30, "amber"),
    ("dienstleister", "Dienstleister", 40, "emerald"),
    ("nachunternehmer", "Nachunternehmer", 50, "cyan"),
    ("privatperson", "Privatperson", 60, "slate"),
]

_WERTE_KONTAKT_ROLLE = [
    ("geschaeftsfuehrer", "Geschäftsführer", 10),
    ("disposition", "Disposition", 20),
    ("buchhaltung", "Buchhaltung", 30),
    ("sekretariat", "Sekretariat", 40),
    ("vertrieb", "Vertrieb", 50),
    ("hausmeister", "Hausmeister", 60),
    ("technik", "Technik", 70),
    ("verwaltung", "Verwaltung", 80),
]

_WERTE_ANREDE = [
    ("damen_und_herren", "Sehr geehrte Damen und Herren", 10),
    ("herr", "Sehr geehrter Herr", 20),
    ("frau", "Sehr geehrte Frau", 30),
    ("hallo", "Hallo", 40),
]

_WERTE_RECHTSFORM = [
    ("gmbh", "GmbH", 10),
    ("ag", "AG", 20),
    ("gmbh_co_kg", "GmbH & Co. KG", 30),
    ("kg", "KG", 40),
    ("ohg", "OHG", 50),
    ("e_k", "e.K.", 60),
    ("gbr", "GbR", 70),
    ("einzelunternehmen", "Einzelunternehmen", 80),
    ("e_v", "e.V.", 90),
    ("privatperson", "— (Privatperson)", 100),
]

_WERTE_BRANCHE = [
    ("klima_lueftung", "Klima/Lüftung", 10),
    ("elektro", "Elektro", 20),
    ("sanitaer", "Sanitär", 30),
    ("reinigung", "Reinigung", 40),
    ("sicherheitstechnik", "Sicherheitstechnik", 50),
    ("verwaltung", "Verwaltung", 60),
    ("garten_aussenanlagen", "Garten / Außenanlagen", 70),
    ("aufzugstechnik", "Aufzugstechnik", 80),
]

_WERTE_ADRESSTYP = [
    ("hauptsitz", "Hauptsitz", 10),
    ("rechnung", "Rechnung", 20),
    ("liefer", "Liefer", 30),
    ("baustelle", "Baustelle", 40),
]


def upgrade() -> None:
    # ============================================================
    # 1) ENUM-Erweiterung: 'privatperson' zu partner_typ hinzufügen
    # ============================================================
    # ALTER TYPE muss außerhalb der laufenden Transaktion ausgeführt
    # werden; daher autocommit_block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE partner_typ ADD VALUE IF NOT EXISTS 'privatperson'")

    # ============================================================
    # 2) Sequence für Partner-Nummern
    # ============================================================
    op.execute("CREATE SEQUENCE IF NOT EXISTS partner_nummer_seq START WITH 1000")

    # ============================================================
    # 3) Schema-Änderungen: geschaeftspartner erweitern
    # ============================================================
    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "partner_nummer",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("nextval('partner_nummer_seq')"),
        ),
    )
    op.create_index(
        "ix_geschaeftspartner_partner_nummer",
        "geschaeftspartner",
        ["partner_nummer"],
    )

    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "gesperrt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index("ix_geschaeftspartner_gesperrt", "geschaeftspartner", ["gesperrt"])

    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "parent_partner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geschaeftspartner.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_geschaeftspartner_parent_partner_id",
        "geschaeftspartner",
        ["parent_partner_id"],
    )

    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "rechtsform_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "branche_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "anrede_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    op.add_column("geschaeftspartner", sa.Column("ust_id_nr", sa.String(32), nullable=True))
    op.add_column("geschaeftspartner", sa.Column("steuer_nr", sa.String(32), nullable=True))
    op.add_column("geschaeftspartner", sa.Column("hrb", sa.String(64), nullable=True))
    op.add_column("geschaeftspartner", sa.Column("website", sa.String(255), nullable=True))
    op.add_column("geschaeftspartner", sa.Column("titel", sa.String(64), nullable=True))
    op.add_column("geschaeftspartner", sa.Column("vorname", sa.String(120), nullable=True))
    op.add_column("geschaeftspartner", sa.Column("nachname", sa.String(120), nullable=True))

    # ============================================================
    # 4) Schema-Änderungen: objekte.gesperrt
    # ============================================================
    op.add_column(
        "objekte",
        sa.Column(
            "gesperrt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index("ix_objekte_gesperrt", "objekte", ["gesperrt"])

    # ============================================================
    # 5) Neue Tabelle: partner_kontakte
    # ============================================================
    op.create_table(
        "partner_kontakte",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("anrede_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("titel", sa.String(64), nullable=True),
        sa.Column("vorname", sa.String(120), nullable=True),
        sa.Column("nachname", sa.String(120), nullable=True),
        sa.Column(
            "rollen",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'::uuid[]"),
        ),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("telefon", sa.String(64), nullable=True),
        sa.Column("mobil", sa.String(64), nullable=True),
        sa.Column(
            "ist_hauptkontakt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "gesperrt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("notiz", sa.Text(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["mandant_id"], ["mandanten.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["anrede_id"], ["auswahllisten_werte.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_partner_kontakte_mandant_id", "partner_kontakte", ["mandant_id"])
    op.create_index("ix_partner_kontakte_partner_id", "partner_kontakte", ["partner_id"])

    # ============================================================
    # 6) Neue Tabelle: partner_adressen (Junction)
    # ============================================================
    op.create_table(
        "partner_adressen",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("adresse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("typ_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "ist_primaer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
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
        sa.ForeignKeyConstraint(["mandant_id"], ["mandanten.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["adresse_id"], ["adressen.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["typ_id"], ["auswahllisten_werte.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_partner_adressen_mandant_id", "partner_adressen", ["mandant_id"])
    op.create_index("ix_partner_adressen_partner_id", "partner_adressen", ["partner_id"])
    op.create_index("ix_partner_adressen_adresse_id", "partner_adressen", ["adresse_id"])

    # ============================================================
    # 7) Audit-Trigger auf die zwei neuen Tabellen
    # ============================================================
    for table in ("partner_kontakte", "partner_adressen"):
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")
        op.execute(
            f"""
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger();
            """
        )

    # ============================================================
    # 8) Auswahllisten-Seeds pro Mandant
    # ============================================================
    _seed_auswahllisten()

    # ============================================================
    # 9) Daten-Migration: bestehende adresse_id → partner_adressen
    # ============================================================
    op.execute(
        """
        INSERT INTO partner_adressen
            (mandant_id, partner_id, adresse_id, typ_id, ist_primaer)
        SELECT
            gp.mandant_id,
            gp.id,
            gp.adresse_id,
            (SELECT w.id
               FROM auswahllisten_werte w
               JOIN auswahllisten l ON l.id = w.auswahlliste_id
              WHERE l.mandant_id = gp.mandant_id
                AND l.key = 'adresstyp'
                AND w.key = 'hauptsitz'
              LIMIT 1),
            TRUE
        FROM geschaeftspartner gp
        WHERE gp.adresse_id IS NOT NULL
          AND gp.deleted_at IS NULL
        """
    )

    # ============================================================
    # 10) Daten-Migration: ansprechpartner → partner_kontakte
    # ============================================================
    # Heuristik (vereinfacht in SQL): wir legen für JEDEN Partner mit
    # gesetztem ansprechpartner einen Kontakt an, splitten dabei den
    # String an Leerzeichen — letztes Token = nachname, Rest = vorname.
    # Privatperson-Erkennung erfolgt nicht hier, sondern ist Tims
    # nachträgliche Pflege (er kann typen=privatperson setzen und den
    # Kontakt löschen).
    op.execute(
        """
        INSERT INTO partner_kontakte
            (mandant_id, partner_id, anrede_id, titel, vorname, nachname,
             email, telefon, ist_hauptkontakt)
        SELECT
            gp.mandant_id,
            gp.id,
            NULL AS anrede_id,
            -- Titel: Erstes Token, wenn es in Whitelist matched
            CASE
              WHEN split_part(gp.ansprechpartner, ' ', 1) IN
                   ('Dr.', 'Prof.', 'Dipl.-Ing.', 'Dipl.', 'Dr', 'Prof')
              THEN split_part(gp.ansprechpartner, ' ', 1)
              ELSE NULL
            END AS titel,
            -- Vorname: alles zwischen optionalem Titel und letztem Token
            CASE
              WHEN array_length(string_to_array(gp.ansprechpartner, ' '), 1) >= 2
              THEN array_to_string(
                     (string_to_array(gp.ansprechpartner, ' '))[
                       CASE
                         WHEN split_part(gp.ansprechpartner, ' ', 1) IN
                              ('Dr.', 'Prof.', 'Dipl.-Ing.', 'Dipl.', 'Dr', 'Prof')
                         THEN 2 ELSE 1
                       END
                       :
                       array_length(string_to_array(gp.ansprechpartner, ' '), 1) - 1
                     ], ' ')
              ELSE NULL
            END AS vorname,
            -- Nachname: letztes Token, oder bei einzelnem Token alles
            CASE
              WHEN array_length(string_to_array(gp.ansprechpartner, ' '), 1) >= 1
              THEN (string_to_array(gp.ansprechpartner, ' '))[
                     array_length(string_to_array(gp.ansprechpartner, ' '), 1)
                   ]
              ELSE gp.ansprechpartner
            END AS nachname,
            gp.email,
            gp.telefon,
            TRUE AS ist_hauptkontakt
        FROM geschaeftspartner gp
        WHERE gp.ansprechpartner IS NOT NULL
          AND length(trim(gp.ansprechpartner)) > 0
          AND gp.deleted_at IS NULL
        """
    )

    # ============================================================
    # 11) Alte Spalten droppen
    # ============================================================
    op.drop_column("geschaeftspartner", "ansprechpartner")
    op.drop_column("geschaeftspartner", "adresse_id")


def _seed_auswahllisten() -> None:
    """Legt für jeden Mandanten die neuen Auswahllisten an und füllt sie."""

    def fmt_value(val: tuple) -> str:
        # (key, label, reihenfolge) oder (key, label, reihenfolge, farbe)
        key = val[0].replace("'", "''")
        label = val[1].replace("'", "''")
        reihenfolge = val[2]
        farbe = val[3].replace("'", "''") if len(val) > 3 else None
        if farbe:
            return f"('LISTE_PLACEHOLDER', '{key}', '{label}', {reihenfolge}, '{farbe}', TRUE)"
        return f"('LISTE_PLACEHOLDER', '{key}', '{label}', {reihenfolge}, NULL, TRUE)"

    listen_blocks = [
        (_LISTE_PARTNER_TYP, _WERTE_PARTNER_TYP, "v_partner_typ"),
        (_LISTE_KONTAKT_ROLLE, _WERTE_KONTAKT_ROLLE, "v_kontakt_rolle"),
        (_LISTE_ANREDE, _WERTE_ANREDE, "v_anrede"),
        (_LISTE_RECHTSFORM, _WERTE_RECHTSFORM, "v_rechtsform"),
        (_LISTE_BRANCHE, _WERTE_BRANCHE, "v_branche"),
        (_LISTE_ADRESSTYP, _WERTE_ADRESSTYP, "v_adresstyp"),
    ]

    sql_parts = ["DO $$", "DECLARE", "    m RECORD;"]
    for _liste, _werte, var in listen_blocks:
        sql_parts.append(f"    {var} UUID;")
    sql_parts.append("BEGIN")
    sql_parts.append("    FOR m IN SELECT id FROM mandanten LOOP")
    for liste, werte, var in listen_blocks:
        key, label, beschreibung = liste
        # Backslashes in Beschreibung schützen
        bes = beschreibung.replace("'", "''")
        liste_sql = f"""
        INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
        VALUES (m.id, '{key}', '{label}', '{bes}', FALSE)
        ON CONFLICT (mandant_id, key) DO UPDATE SET label = EXCLUDED.label
        RETURNING id INTO {var};
        """  # noqa: S608 — module constants only
        sql_parts.append(liste_sql)
        # Werte
        if werte and len(werte[0]) == 4:
            values_sql = ", ".join(
                f"({var}, '{k}', '{lbl}', {ro}, '{f}', FALSE)" for k, lbl, ro, f in werte
            )
        else:
            values_sql = ", ".join(
                f"({var}, '{k}', '{lbl}', {ro}, NULL, FALSE)" for k, lbl, ro in werte
            )
        werte_sql = (
            "        INSERT INTO auswahllisten_werte "  # noqa: S608 — module constants only
            "(auswahlliste_id, key, label, reihenfolge, farbe, ist_system) "
            f"VALUES {values_sql} "
            "ON CONFLICT (auswahlliste_id, key) DO NOTHING;"
        )
        sql_parts.append(werte_sql)
    sql_parts.append("    END LOOP;")
    sql_parts.append("END $$;")
    op.execute("\n".join(sql_parts))


def downgrade() -> None:
    # Best-effort: alte Spalten wiederherstellen (leer), neue Tabellen droppen,
    # Sequence + Auswahllisten droppen.

    op.add_column(
        "geschaeftspartner",
        sa.Column("ansprechpartner", sa.String(200), nullable=True),
    )
    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "adresse_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("adressen.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    # Best-effort: erste Hauptsitz-Adresse zurück in adresse_id
    op.execute(
        """
        UPDATE geschaeftspartner gp
        SET adresse_id = pa.adresse_id
        FROM (
          SELECT DISTINCT ON (partner_id) partner_id, adresse_id
          FROM partner_adressen
          ORDER BY partner_id, ist_primaer DESC
        ) pa
        WHERE gp.id = pa.partner_id
        """
    )

    for table in ("partner_kontakte", "partner_adressen"):
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")

    op.drop_index("ix_partner_adressen_adresse_id", table_name="partner_adressen")
    op.drop_index("ix_partner_adressen_partner_id", table_name="partner_adressen")
    op.drop_index("ix_partner_adressen_mandant_id", table_name="partner_adressen")
    op.drop_table("partner_adressen")

    op.drop_index("ix_partner_kontakte_partner_id", table_name="partner_kontakte")
    op.drop_index("ix_partner_kontakte_mandant_id", table_name="partner_kontakte")
    op.drop_table("partner_kontakte")

    op.drop_index("ix_objekte_gesperrt", table_name="objekte")
    op.drop_column("objekte", "gesperrt")

    op.drop_column("geschaeftspartner", "nachname")
    op.drop_column("geschaeftspartner", "vorname")
    op.drop_column("geschaeftspartner", "titel")
    op.drop_column("geschaeftspartner", "website")
    op.drop_column("geschaeftspartner", "hrb")
    op.drop_column("geschaeftspartner", "steuer_nr")
    op.drop_column("geschaeftspartner", "ust_id_nr")
    op.drop_column("geschaeftspartner", "anrede_id")
    op.drop_column("geschaeftspartner", "branche_id")
    op.drop_column("geschaeftspartner", "rechtsform_id")
    op.drop_index("ix_geschaeftspartner_parent_partner_id", table_name="geschaeftspartner")
    op.drop_column("geschaeftspartner", "parent_partner_id")
    op.drop_index("ix_geschaeftspartner_gesperrt", table_name="geschaeftspartner")
    op.drop_column("geschaeftspartner", "gesperrt")
    op.drop_index("ix_geschaeftspartner_partner_nummer", table_name="geschaeftspartner")
    op.drop_column("geschaeftspartner", "partner_nummer")

    op.execute("DROP SEQUENCE IF EXISTS partner_nummer_seq")

    # Auswahllisten löschen (CASCADE räumt Werte mit)
    op.execute(
        """
        DELETE FROM auswahllisten
        WHERE key IN ('partner_typ', 'kontakt_rolle', 'anrede',
                      'rechtsform', 'branche', 'adresstyp')
        """
    )
    # ENUM-Wert 'privatperson' kann nicht ohne weiteres entfernt werden
    # (Postgres erlaubt nur ADD VALUE, kein REMOVE). Downgrade lässt
    # diesen Wert im Enum stehen — wird beim nächsten Upgrade ignoriert.
