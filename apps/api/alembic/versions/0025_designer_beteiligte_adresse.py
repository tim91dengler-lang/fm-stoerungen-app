"""Vorlagen-Designer an neues Ticket angleichen: partner→Beteiligte + Adresse-Feld

Revision ID: 0025
Revises: 0024
Create Date: 2026-06-01

Tim 2026-06-01: das Ticket-Detail hat sich geändert (Beteiligte-Block statt
Einzel-Partner, frei wählbare Adresse). Der Vorlagen-Feld-Katalog zieht nach:

- das ``partner``-Feld steuert jetzt den Beteiligte-Block → Default-Label
  „Partner" → „Beteiligte" (nur die unveränderten Default-Labels).
- neues ``adresse``-Feld in bestehende Vorlagen seeden (sichtbar, nicht Pflicht),
  damit die Adresse pro Vorlage schaltbar ist.

Beides idempotent.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # partner-Feld umbenennen (nur die unveränderten Default-Labels).
    op.execute(
        "UPDATE tickettyp_feld SET label = 'Beteiligte' "
        "WHERE feld_key = 'partner' AND label = 'Partner'"
    )
    # Adresse-Feld in alle Vorlagen seeden, die es noch nicht haben.
    op.execute(
        """
        INSERT INTO tickettyp_feld
            (id, tickettyp_id, feld_key, label, sichtbar, pflicht, reihenfolge,
             created_at, updated_at)
        SELECT gen_random_uuid(), t.id, 'adresse', 'Adresse', true, false, 19, now(), now()
        FROM tickettypen t
        WHERE NOT EXISTS (
            SELECT 1 FROM tickettyp_feld f
            WHERE f.tickettyp_id = t.id AND f.feld_key = 'adresse'
        )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM tickettyp_feld WHERE feld_key = 'adresse'")
    op.execute(
        "UPDATE tickettyp_feld SET label = 'Partner' "
        "WHERE feld_key = 'partner' AND label = 'Beteiligte'"
    )
