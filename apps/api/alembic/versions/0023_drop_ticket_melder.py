"""Ticket-Melder-Daten leeren (durch Beteiligte abgelöst) — deploy-sicher

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-01

Tim 2026-06-01: der Melder/Anrufer ist durch die Beteiligten-Liste ersetzt; auch
die Alt-Werte in bestehenden Tickets sollen raus.

Expand/Contract (wie 0020/0021): hier werden NUR die Daten geleert
(``UPDATE … SET melder = NULL``). Die **Spalte bleibt** zunächst bestehen, weil
``migrate.sh`` ``alembic upgrade`` VOR dem Container-Swap ausführt — würde diese
Migration die Spalte droppen, liefe der noch laufende alte Code (mappt
``Ticket.melder``) kurzzeitig gegen ein Schema ohne die Spalte → 500er im
Deploy-Fenster. Der eigentliche ``DROP COLUMN`` kommt als separate Contract-
Migration in einem späteren Deploy, sobald der melder-freie Code überall live ist.

Die Historie bleibt im append-only ``system_audit`` erhalten.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Spalte bleibt (deploy-sicher) — nur die Daten leeren.
    op.execute("UPDATE tickets SET melder = NULL WHERE melder IS NOT NULL")


def downgrade() -> None:
    # Daten sind nicht wiederherstellbar (bewusst); No-op.
    pass
