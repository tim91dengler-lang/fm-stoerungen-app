"""Ticket-Melder-Spalte droppen (Contract-Schritt zu 0023)

Revision ID: 0026
Revises: 0025
Create Date: 2026-06-01

Tim 2026-06-01: der Melder ist durch die Beteiligten-Liste abgelöst; die Spalte
kann endgültig weg.

Contract-Schritt des Expand/Contract-Musters: Migration 0023 hat die Daten bereits
geleert (``melder = NULL``), die Spalte aber bewusst stehen lassen, solange noch
alter Code lief, der ``Ticket.melder`` mappt. Inzwischen ist der melder-freie Code
überall live (Staging deployt automatisch auf ``main``; eine separate Prod-Umgebung
existiert noch nicht), kein laufender Code referenziert die Spalte mehr — daher ist
der ``DROP COLUMN`` jetzt deploy-sicher: ``migrate.sh`` fährt ``alembic upgrade``
zwar vor dem Container-Swap, aber der bereits laufende Container ist ebenfalls
melder-frei.

``DROP COLUMN IF EXISTS`` / re-add als nullable im Downgrade — idempotent.
Die Historie der Alt-Werte bleibt im append-only ``system_audit`` erhalten.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS melder")


def downgrade() -> None:
    # Re-add als nullable; die Alt-Daten sind nicht wiederherstellbar (bewusst).
    op.add_column(
        "tickets",
        sa.Column("melder", sa.String(length=200), nullable=True),
    )
