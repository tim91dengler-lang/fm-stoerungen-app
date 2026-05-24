"""Feature 2 — Projekt-Modul: Projekttyp + Auswahllisten-Status + m:n Objekte

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-24

Setzt Feature-2-Spec um:
- Neue Auswahllisten `projekttyp` (Wartung, Sanierung, Neubau, Begehung, Bauprojekt)
  und `projektstatus` (geplant, aktiv, pausiert, abgeschlossen). Beide
  per-Mandant geseedet, als ist_system markiert.
- `projekte.projekttyp_id` (NEU, Pflicht, FK auf auswahllisten_werte)
- `projekte.status_id` (UMSTELLEN von String auf FK auf auswahllisten_werte;
  bestehende String-Werte werden gemappt — Unbekannte fallen auf "geplant" zurück)
- Alte Spalte `projekte.status` (String) und `projekte.objekt_id` (FK) DROP
- Neue Tabelle `projekt_objekte` (m:n Projekt ↔ Objekt) — bestehende
  `objekt_id`-Werte werden vor dem Drop in die Link-Tabelle übertragen.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# -----------------------------------------------------------------------
# Seed-Konfiguration: gleiche Werte wie in
# fm_api.services.auswahlliste_service.SYSTEM_AUSWAHLLISTEN_SEED, hier
# bewusst dupliziert, weil Alembic-Migrationen autonom laufen können
# (kein Import aus dem App-Code, damit auch alte Checkouts saubere
# Migrationen produzieren). Bei Änderungen beide Stellen anfassen.
# -----------------------------------------------------------------------
PROJEKTTYP_WERTE = [
    # (key, label, reihenfolge, farbe)
    ("wartung", "Wartung", 0, "blue"),
    ("sanierung", "Sanierung", 1, "amber"),
    ("neubau", "Neubau", 2, "emerald"),
    ("begehung", "Begehung", 3, "violet"),
    ("bauprojekt", "Bauprojekt", 4, "orange"),
]
PROJEKTSTATUS_WERTE = [
    ("geplant", "Geplant", 0, "slate"),
    ("aktiv", "Aktiv", 1, "blue"),
    ("pausiert", "Pausiert", 2, "amber"),
    ("abgeschlossen", "Abgeschlossen", 3, "emerald"),
]

# Mapping bestehender String-Werte auf neue projektstatus-Slugs.
# Alte Free-Text-Werte: heute "geplant"/"laufend"/"abgeschlossen"/"storniert"
# in seed_mockup, aber andere Werte im Bestand möglich.
STATUS_STRING_MAP = {
    "geplant": "geplant",
    "laufend": "aktiv",  # alter Begriff → neuer Slug
    "aktiv": "aktiv",
    "pausiert": "pausiert",
    "abgeschlossen": "abgeschlossen",
    "storniert": "abgeschlossen",  # storniert wird in Stufe 1 nicht mehr unterschieden
}


def upgrade() -> None:
    # ============================================================
    # 1) Auswahllisten projekttyp + projektstatus seeden (per Mandant)
    # ============================================================
    op.execute(
        f"""
        DO $$
        DECLARE
            m RECORD;
            liste_typ UUID;
            liste_status UUID;
        BEGIN
            FOR m IN SELECT id FROM mandanten LOOP
                -- projekttyp
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'projekttyp', 'Projekttyp', 'Art des Projekts (Wartung, Sanierung, Neubau …)', FALSE)
                ON CONFLICT (mandant_id, key) DO UPDATE SET label = EXCLUDED.label
                RETURNING id INTO liste_typ;

                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES
                    {", ".join(f"(liste_typ, '{k}', '{lbl}', {ro}, '{f}', TRUE)" for k, lbl, ro, f in PROJEKTTYP_WERTE)}
                ON CONFLICT (auswahlliste_id, key) DO NOTHING;

                -- projektstatus
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, 'projektstatus', 'Projekt-Status', 'Status-Werte für Projekte', TRUE)
                ON CONFLICT (mandant_id, key) DO UPDATE SET label = EXCLUDED.label
                RETURNING id INTO liste_status;

                INSERT INTO auswahllisten_werte (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES
                    {", ".join(f"(liste_status, '{k}', '{lbl}', {ro}, '{f}', TRUE)" for k, lbl, ro, f in PROJEKTSTATUS_WERTE)}
                ON CONFLICT (auswahlliste_id, key) DO NOTHING;
            END LOOP;
        END $$;
        """  # noqa: S608 — values are hardcoded module constants
    )

    # ============================================================
    # 2) Neue Tabelle projekt_objekte
    # ============================================================
    op.create_table(
        "projekt_objekte",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("projekt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["projekt_id"],
            ["projekte.id"],
            name="fk_projekt_objekte_projekt_id_projekte",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["objekt_id"],
            ["objekte.id"],
            name="fk_projekt_objekte_objekt_id_objekte",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_projekt_objekte_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "projekt_id", "objekt_id", name="uq_projekt_objekte_projekt_id_objekt_id"
        ),
    )
    op.create_index("ix_projekt_objekte_projekt_id", "projekt_objekte", ["projekt_id"])
    op.create_index("ix_projekt_objekte_objekt_id", "projekt_objekte", ["objekt_id"])
    op.create_index("ix_projekt_objekte_mandant_id", "projekt_objekte", ["mandant_id"])
    op.execute(
        """
        CREATE TRIGGER audit_projekt_objekte
        AFTER INSERT OR UPDATE OR DELETE ON projekt_objekte
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """
    )

    # ============================================================
    # 3) Daten-Migration: bestehende projekte.objekt_id → projekt_objekte
    # ============================================================
    op.execute(
        """
        INSERT INTO projekt_objekte (projekt_id, objekt_id, mandant_id)
        SELECT p.id, p.objekt_id, p.mandant_id
        FROM projekte p
        WHERE p.objekt_id IS NOT NULL;
        """
    )

    # ============================================================
    # 4) Neue FK-Spalten projekttyp_id + status_id (zuerst nullable für Backfill)
    # ============================================================
    op.add_column(
        "projekte",
        sa.Column("projekttyp_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "projekte",
        sa.Column("status_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # ============================================================
    # 5) Backfill status_id aus altem String-Wert + projekttyp_id default
    # ============================================================
    # Default-Projekttyp = "wartung" (häufigstes Projekt im FM-Kontext).
    # Bestehende Status-Strings via STATUS_STRING_MAP umsetzen; Unbekanntes → "geplant".
    op.execute(
        """
        UPDATE projekte p SET projekttyp_id = w.id
          FROM auswahllisten l
          JOIN auswahllisten_werte w ON w.auswahlliste_id = l.id
         WHERE l.mandant_id = p.mandant_id
           AND l.key = 'projekttyp'
           AND w.key = 'wartung'
           AND p.projekttyp_id IS NULL;
        """
    )

    map_cases = " ".join(
        f"WHEN p.status = '{old}' THEN '{new}'" for old, new in STATUS_STRING_MAP.items()
    )
    op.execute(
        f"""
        UPDATE projekte p SET status_id = w.id
          FROM auswahllisten l
          JOIN auswahllisten_werte w ON w.auswahlliste_id = l.id
         WHERE l.mandant_id = p.mandant_id
           AND l.key = 'projektstatus'
           AND w.key = (CASE {map_cases} ELSE 'geplant' END)
           AND p.status_id IS NULL;
        """  # noqa: S608 — STATUS_STRING_MAP keys/values are hardcoded
    )

    # ============================================================
    # 6) FK-Constraints + Indizes + NOT NULL setzen
    # ============================================================
    op.create_foreign_key(
        "fk_projekte_projekttyp_id_auswahllisten_werte",
        "projekte",
        "auswahllisten_werte",
        ["projekttyp_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_projekte_status_id_auswahllisten_werte",
        "projekte",
        "auswahllisten_werte",
        ["status_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_projekte_projekttyp_id", "projekte", ["projekttyp_id"])
    op.create_index("ix_projekte_status_id", "projekte", ["status_id"])
    op.alter_column("projekte", "projekttyp_id", nullable=False)
    op.alter_column("projekte", "status_id", nullable=False)

    # ============================================================
    # 7) Alte Spalten droppen (status String + objekt_id 1:1)
    # ============================================================
    op.drop_constraint("fk_projekte_objekt_id_objekte", "projekte", type_="foreignkey")
    op.drop_column("projekte", "objekt_id")
    op.drop_column("projekte", "status")


def downgrade() -> None:
    # ============================================================
    # Reverse: bringt das Schema zurück auf den 0009-Stand.
    # Inhaltliche Daten-Mappings sind lossy (z. B. "aktiv" → "laufend"),
    # aber die häufigen Werte werden zurück gemappt.
    # ============================================================
    # 1) Spalten wieder anlegen
    op.add_column(
        "projekte",
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="geplant",
        ),
    )
    op.add_column(
        "projekte",
        sa.Column("objekt_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_projekte_objekt_id_objekte",
        "projekte",
        "objekte",
        ["objekt_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 2) status-String aus status_id rückprojizieren ("aktiv"→"laufend")
    op.execute(
        """
        UPDATE projekte p SET status = CASE w.key
            WHEN 'aktiv' THEN 'laufend'
            WHEN 'pausiert' THEN 'laufend'
            ELSE w.key
        END
          FROM auswahllisten_werte w
         WHERE w.id = p.status_id;
        """
    )

    # 3) erstes verknüpftes Objekt zurück als objekt_id setzen
    op.execute(
        """
        UPDATE projekte p SET objekt_id = sub.objekt_id
          FROM (
            SELECT DISTINCT ON (projekt_id) projekt_id, objekt_id
              FROM projekt_objekte
             ORDER BY projekt_id, created_at ASC
          ) sub
         WHERE p.id = sub.projekt_id;
        """
    )

    # 4) FK-Spalten droppen
    op.drop_index("ix_projekte_status_id", table_name="projekte")
    op.drop_index("ix_projekte_projekttyp_id", table_name="projekte")
    op.drop_constraint("fk_projekte_status_id_auswahllisten_werte", "projekte", type_="foreignkey")
    op.drop_constraint(
        "fk_projekte_projekttyp_id_auswahllisten_werte", "projekte", type_="foreignkey"
    )
    op.drop_column("projekte", "status_id")
    op.drop_column("projekte", "projekttyp_id")

    # 5) Link-Tabelle droppen
    op.execute("DROP TRIGGER IF EXISTS audit_projekt_objekte ON projekt_objekte;")
    op.drop_index("ix_projekt_objekte_mandant_id", table_name="projekt_objekte")
    op.drop_index("ix_projekt_objekte_objekt_id", table_name="projekt_objekte")
    op.drop_index("ix_projekt_objekte_projekt_id", table_name="projekt_objekte")
    op.drop_table("projekt_objekte")

    # 6) Auswahllisten droppen (CASCADE löscht auch die Werte)
    op.execute(
        """
        DELETE FROM auswahllisten
         WHERE key IN ('projekttyp', 'projektstatus');
        """
    )
