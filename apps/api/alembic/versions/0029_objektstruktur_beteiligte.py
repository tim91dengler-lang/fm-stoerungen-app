"""Beteiligte für die Objektstruktur — einheitliche Tabellen (Expand-Phase 1a)

Revision ID: 0029
Revises: 0028
Create Date: 2026-06-03

Neue Tabellen ``objekt_beteiligte`` / ``haus_beteiligte`` /
``stockwerk_beteiligte`` / ``einheit_beteiligte``: je Ebene beliebig viele
Geschäftspartner (+ optional Ansprechpartner) mit konfigurierbarer Rolle
(Auswahlliste ``objekt_beteiligten_rolle``) — analog ``ticket_beteiligte``.

Expand-only / additiv: die alten Eigentümer/Mieter-Junctions
(``haus_eigentuemer`` …) und ``objekt_partner`` bleiben unangetastet. Die
Daten-Migration (Bestand → neue Tabellen) erfolgt separat in 0030, das Droppen
der alten Tabellen erst nach Umstellung von Service/Frontend (Contract-Phase).

Seed der Rollen-Liste ist idempotent (NOT EXISTS-Guards), passend zum
``ensure_system_auswahllisten``-Provisioning.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = [
    ("objekt_beteiligte", "objekt_id", "objekte"),
    ("haus_beteiligte", "haus_id", "haus"),
    ("stockwerk_beteiligte", "stockwerk_id", "objekt_stockwerk"),
    ("einheit_beteiligte", "einheit_id", "stockwerk_einheit"),
]


def _create_beteiligte_table(name: str, parent_col: str, parent_table: str) -> None:
    op.create_table(
        name,
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(parent_col, postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_kontakt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rolle_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reihenfolge", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
        sa.ForeignKeyConstraint([parent_col], [f"{parent_table}.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["partner_kontakt_id"], ["partner_kontakte.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["rolle_id"], ["auswahllisten_werte.id"], ondelete="SET NULL"),
    )
    op.create_index(f"ix_{name}_mandant_id", name, ["mandant_id"])
    op.create_index(f"ix_{name}_{parent_col}", name, [parent_col])
    op.create_index(f"ix_{name}_partner_id", name, ["partner_id"])
    op.execute(f"DROP TRIGGER IF EXISTS audit_{name} ON {name};")
    op.execute(
        f"""
        CREATE TRIGGER audit_{name}
        AFTER INSERT OR UPDATE OR DELETE ON {name}
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """
    )


def upgrade() -> None:
    for name, parent_col, parent_table in _TABLES:
        _create_beteiligte_table(name, parent_col, parent_table)

    # Auswahlliste objekt_beteiligten_rolle pro Mandant (idempotent)
    op.execute(
        """
        INSERT INTO auswahllisten
            (id, mandant_id, key, label, beschreibung, ist_system, created_at, updated_at)
        SELECT gen_random_uuid(), m.id, 'objekt_beteiligten_rolle',
               'Objekt-Beteiligten-Rolle',
               'Rolle eines Beteiligten an Objekt / Haus / Stockwerk / Einheit',
               false, now(), now()
        FROM mandanten m
        WHERE NOT EXISTS (
            SELECT 1 FROM auswahllisten l
            WHERE l.mandant_id = m.id AND l.key = 'objekt_beteiligten_rolle'
        );
        """
    )
    op.execute(
        """
        INSERT INTO auswahllisten_werte
            (id, auswahlliste_id, key, label, reihenfolge, farbe, ist_system, created_at, updated_at)
        SELECT gen_random_uuid(), l.id, v.key, v.label, v.reihenfolge, v.farbe, false, now(), now()
        FROM auswahllisten l
        CROSS JOIN (VALUES
            ('eigentuemer', 'Eigentümer', 0, 'violet'),
            ('mieter', 'Mieter', 1, 'amber'),
            ('verwalter', 'Verwalter', 2, 'sky'),
            ('hausmeister', 'Hausmeister', 3, 'emerald'),
            ('reinigung', 'Reinigung', 4, 'cyan')
        ) AS v(key, label, reihenfolge, farbe)
        WHERE l.key = 'objekt_beteiligten_rolle'
          AND NOT EXISTS (
            SELECT 1 FROM auswahllisten_werte w
            WHERE w.auswahlliste_id = l.id AND w.key = v.key
          );
        """
    )


def downgrade() -> None:
    for name, _parent_col, _parent_table in _TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_{name} ON {name};")
        op.drop_table(name)
    # Auswahlliste objekt_beteiligten_rolle bewusst NICHT gelöscht (Admin könnte
    # sie erweitert haben) — analog zu anderen Seed-Migrationen.
