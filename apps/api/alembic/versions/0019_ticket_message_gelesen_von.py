"""Read-Receipts — gelesen_von am Chat (Konzept §5.6)

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-31

Fügt ``ticket_messages.gelesen_von`` (JSONB, Liste der User-IDs, die die
Nachricht gelesen haben) hinzu. Idempotent (``ADD COLUMN IF NOT EXISTS``),
damit ein bereits manuell angelegtes Feld auf Staging kein Hindernis ist.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ticket_messages "
        "ADD COLUMN IF NOT EXISTS gelesen_von JSONB NOT NULL DEFAULT '[]'::jsonb"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE ticket_messages DROP COLUMN IF EXISTS gelesen_von")
