"""R8 Vorlagen-Designer — Tickettyp.aktiv (deaktivierbare Vorlagen)

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-26

Tim 2026-05-26 (Track-2-Spec): Vorlagen sollen deaktivierbar sein.
System- und User-Vorlagen können auf inaktiv gesetzt werden. Deaktivierte
Vorlagen erscheinen nicht mehr im Tickettyp-Picker des TicketErfassenModal
(GET /tickettypen?aktiv_only=true), bleiben aber in der DB und in
bestehenden Tickets sichtbar (FK ON DELETE SET NULL bleibt unverändert).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tickettypen",
        sa.Column(
            "aktiv",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("tickettypen", "aktiv")
