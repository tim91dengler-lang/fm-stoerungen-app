"""① Kontakte/Beteiligte — flexible n:m-Liste statt fixem Einzel-Partner

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-31

Neue Tabelle ``ticket_beteiligte``: beliebig viele Geschäftspartner (+ optional
Ansprechpartner) je Ticket mit konfigurierbarer Rolle (Auswahlliste
``beteiligten_rolle``).

Expand-only: das alte ``tickets.partner_id`` bleibt erhalten (deploy-sicher); der
bestehende Wert wird als Beteiligten-Zeile mit Rolle „Melder" + Hauptkontakt
gebackfillt. Seed + Backfill sind idempotent (NOT EXISTS-Guards), damit ein
erneuter Lauf bzw. bereits per ensure_system_auswahllisten geseedete Mandanten
nicht doppeln.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ============================================================
    # 1) Neue Tabelle ticket_beteiligte
    # ============================================================
    op.create_table(
        "ticket_beteiligte",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("partner_kontakt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rolle_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "ist_hauptkontakt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["partner_id"], ["geschaeftspartner.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["partner_kontakt_id"], ["partner_kontakte.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["rolle_id"], ["auswahllisten_werte.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_ticket_beteiligte_mandant_id", "ticket_beteiligte", ["mandant_id"])
    op.create_index("ix_ticket_beteiligte_ticket_id", "ticket_beteiligte", ["ticket_id"])
    op.create_index("ix_ticket_beteiligte_partner_id", "ticket_beteiligte", ["partner_id"])

    # ============================================================
    # 2) Audit-Trigger (Einzel-UUID-PK → Standard-Trigger)
    # ============================================================
    op.execute("DROP TRIGGER IF EXISTS audit_ticket_beteiligte ON ticket_beteiligte;")
    op.execute(
        """
        CREATE TRIGGER audit_ticket_beteiligte
        AFTER INSERT OR UPDATE OR DELETE ON ticket_beteiligte
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """
    )

    # ============================================================
    # 3) Auswahlliste beteiligten_rolle pro Mandant (idempotent)
    # ============================================================
    op.execute(
        """
        INSERT INTO auswahllisten
            (id, mandant_id, key, label, beschreibung, ist_system, created_at, updated_at)
        SELECT gen_random_uuid(), m.id, 'beteiligten_rolle', 'Beteiligten-Rolle',
               'Rolle eines Beteiligten am Ticket (Melder, Auftraggeber …)',
               false, now(), now()
        FROM mandanten m
        WHERE NOT EXISTS (
            SELECT 1 FROM auswahllisten l
            WHERE l.mandant_id = m.id AND l.key = 'beteiligten_rolle'
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
            ('melder', 'Melder', 0, 'blue'),
            ('auftraggeber', 'Auftraggeber', 1, 'amber'),
            ('mieter', 'Mieter vor Ort', 2, 'cyan'),
            ('nachunternehmer', 'Nachunternehmer', 3, 'emerald'),
            ('hausverwaltung', 'Hausverwaltung', 4, 'violet'),
            ('eigentuemer', 'Eigentümer', 5, 'slate')
        ) AS v(key, label, reihenfolge, farbe)
        WHERE l.key = 'beteiligten_rolle'
          AND NOT EXISTS (
            SELECT 1 FROM auswahllisten_werte w
            WHERE w.auswahlliste_id = l.id AND w.key = v.key
          );
        """
    )

    # ============================================================
    # 4) Backfill: tickets.partner_id → Beteiligten-Zeile (Rolle Melder)
    # ============================================================
    op.execute(
        """
        INSERT INTO ticket_beteiligte
            (id, mandant_id, ticket_id, partner_id, rolle_id, ist_hauptkontakt,
             reihenfolge, created_at, updated_at)
        SELECT
            gen_random_uuid(), t.mandant_id, t.id, t.partner_id,
            (
                SELECT w.id FROM auswahllisten l
                JOIN auswahllisten_werte w ON w.auswahlliste_id = l.id
                WHERE l.mandant_id = t.mandant_id
                  AND l.key = 'beteiligten_rolle'
                  AND w.key = 'melder'
                LIMIT 1
            ),
            true, 0, now(), now()
        FROM tickets t
        WHERE t.partner_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ticket_beteiligte b WHERE b.ticket_id = t.id
          );
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_ticket_beteiligte ON ticket_beteiligte;")
    op.drop_index("ix_ticket_beteiligte_partner_id", table_name="ticket_beteiligte")
    op.drop_index("ix_ticket_beteiligte_ticket_id", table_name="ticket_beteiligte")
    op.drop_index("ix_ticket_beteiligte_mandant_id", table_name="ticket_beteiligte")
    op.drop_table("ticket_beteiligte")
    # Auswahlliste beteiligten_rolle bewusst NICHT gelöscht (könnte vom Admin
    # erweitert worden sein); analog zu anderen Seed-Migrationen.
