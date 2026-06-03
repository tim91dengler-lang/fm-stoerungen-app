"""Beteiligte Objektstruktur — Daten-Migration Bestand → neue Tabellen (Phase 1b)

Revision ID: 0030
Revises: 0029
Create Date: 2026-06-03

Backfill der bestehenden Eigentümer/Mieter-Junctions + ``objekt_partner`` in die
neuen ``*_beteiligte``-Tabellen (0029). Additiv — die alten Tabellen bleiben
(Drop erst in der Contract-Phase).

Korrektheit / Idempotenz (nach adversarialer Review):
- ``mandant_id`` kommt direkt aus der Eltern-Tabelle (Haus/Stockwerk/Einheit/
  Objekt haben alle ``mandant_id``) UND ist Teil des NOT-EXISTS-Guards (sonst
  Cross-Mandant-False-Negatives bei gleichen parent/partner-IDs).
- Nur **aktive** Eltern (``deleted_at IS NULL``) — keine Beteiligten zu
  soft-gelöschten Objekten/Häusern/Stockwerken/Einheiten.
- Struktur-Junctions: feste Rolle (eigentuemer/mieter) per **INNER JOIN** — die
  Rolle wird von 0029 zuverlässig geseedet; fehlt sie ausnahmsweise, wird die
  Zeile NICHT mit NULL-Rolle migriert (fail-safe, stabile Idempotenz).
- ``objekt_partner``: Rolle aus partner_typ-Enum per Key gemappt (LEFT JOIN).
  eigentuemer/mieter treffen; auftraggeber/nachunternehmer/privatperson haben in
  ``objekt_beteiligten_rolle`` keine Entsprechung → ``rolle_id`` NULL, die
  Partner-Zuordnung bleibt aber erhalten (Admin kann später eine Rolle setzen).
  Idempotenz via ``IS NOT DISTINCT FROM`` (NULL bleibt NULL → kein Duplikat).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (Quelltabelle, Eltern-Tabelle, parent_col, Zieltabelle, Rollen-Key)
_STRUKTUR = [
    ("haus_eigentuemer", "haus", "haus_id", "haus_beteiligte", "eigentuemer"),
    ("haus_mieter", "haus", "haus_id", "haus_beteiligte", "mieter"),
    (
        "stockwerk_eigentuemer",
        "objekt_stockwerk",
        "stockwerk_id",
        "stockwerk_beteiligte",
        "eigentuemer",
    ),
    ("stockwerk_mieter", "objekt_stockwerk", "stockwerk_id", "stockwerk_beteiligte", "mieter"),
    ("einheit_eigentuemer", "stockwerk_einheit", "einheit_id", "einheit_beteiligte", "eigentuemer"),
    ("einheit_mieter", "stockwerk_einheit", "einheit_id", "einheit_beteiligte", "mieter"),
]


def _backfill_struktur(
    src: str, parent_table: str, parent_col: str, target: str, role_key: str
) -> None:
    # Hartcodierte Bezeichner aus _STRUKTUR (kein User-Input) → S608 false-positive.
    op.execute(
        f"""
        INSERT INTO {target}
            (id, mandant_id, {parent_col}, partner_id, rolle_id, reihenfolge,
             created_at, updated_at)
        SELECT gen_random_uuid(), p.mandant_id, s.{parent_col}, s.partner_id,
               r.id, 0, now(), now()
        FROM {src} s
        JOIN {parent_table} p ON p.id = s.{parent_col} AND p.deleted_at IS NULL
        JOIN auswahllisten l
            ON l.mandant_id = p.mandant_id AND l.key = 'objekt_beteiligten_rolle'
        JOIN auswahllisten_werte r
            ON r.auswahlliste_id = l.id AND r.key = '{role_key}'
        WHERE NOT EXISTS (
            SELECT 1 FROM {target} b
            WHERE b.mandant_id = p.mandant_id
              AND b.{parent_col} = s.{parent_col}
              AND b.partner_id = s.partner_id
              AND b.rolle_id = r.id
        );
        """  # noqa: S608
    )


def upgrade() -> None:
    for src, parent_table, parent_col, target, role_key in _STRUKTUR:
        _backfill_struktur(src, parent_table, parent_col, target, role_key)

    # objekt_partner: Rolle aus partner_typ-Enum per Key mappen (LEFT JOIN, da
    # auftraggeber/nachunternehmer/privatperson keine Entsprechung haben).
    op.execute(
        """
        INSERT INTO objekt_beteiligte
            (id, mandant_id, objekt_id, partner_id, rolle_id, reihenfolge,
             created_at, updated_at)
        SELECT gen_random_uuid(), o.mandant_id, op.objekt_id, op.partner_id,
               r.id, 0, now(), now()
        FROM objekt_partner op
        JOIN objekte o ON o.id = op.objekt_id AND o.deleted_at IS NULL
        LEFT JOIN auswahllisten l
            ON l.mandant_id = o.mandant_id AND l.key = 'objekt_beteiligten_rolle'
        LEFT JOIN auswahllisten_werte r
            ON r.auswahlliste_id = l.id AND r.key = op.rolle::text
        WHERE NOT EXISTS (
            SELECT 1 FROM objekt_beteiligte b
            WHERE b.mandant_id = o.mandant_id
              AND b.objekt_id = op.objekt_id
              AND b.partner_id = op.partner_id
              AND b.rolle_id IS NOT DISTINCT FROM r.id
        );
        """
    )


def downgrade() -> None:
    # Ein Backfill ist nicht verlustfrei umkehrbar: der Bestand stammt aus den
    # alten Tabellen, und ab Phase 2 lägen in den neuen Tabellen ggf. echte
    # UI-Daten. Daher KEIN automatisches Löschen (das würde echte Daten
    # vernichten). Die migrierten Zeilen bleiben; ein erneutes ``upgrade`` ist
    # idempotent (NOT-EXISTS-Guards). Cleanup bei Bedarf manuell.
    pass
