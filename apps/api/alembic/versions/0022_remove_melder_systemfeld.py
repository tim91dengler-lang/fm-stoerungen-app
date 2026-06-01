"""Melder-Systemfeld aus Vorlagen entfernen (durch Beteiligte abgelöst)

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-01

Entfernt das ``melder``-Feld aus dem Vorlagen-Feld-Katalog bestehender
Tickettypen (Tim 2026-06-01: der Melder/Anrufer ist durch die flexible
Beteiligten-Liste abgelöst). Idempotent.

Die Spalte ``tickets.melder`` bleibt zur Datenerhaltung bestehen (Alt-Werte
weiterhin abrufbar); sie wird im UI nur nicht mehr angezeigt.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM tickettyp_feld WHERE feld_key = 'melder'")


def downgrade() -> None:
    # Best-effort: melder-Feld pro Tickettyp wieder anlegen (sichtbar, nicht
    # Pflicht, Reihenfolge 10) — nur wo noch nicht vorhanden.
    op.execute(
        """
        INSERT INTO tickettyp_feld
            (id, tickettyp_id, feld_key, label, sichtbar, pflicht, reihenfolge,
             created_at, updated_at)
        SELECT gen_random_uuid(), t.id, 'melder', 'Melder', true, false, 10, now(), now()
        FROM tickettypen t
        WHERE NOT EXISTS (
            SELECT 1 FROM tickettyp_feld f
            WHERE f.tickettyp_id = t.id AND f.feld_key = 'melder'
        )
        """
    )
