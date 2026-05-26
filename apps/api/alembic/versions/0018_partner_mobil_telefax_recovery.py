"""Track 3 (Recovery) — mobil + telefax am Geschäftspartner nachholen

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-26

Migration 0015 (`0015_partner_tabs`) hat `mobil` + `telefax` am Partner
ergänzen sollen — wurde auf Staging aber nie ausgeführt, weil Track 2
parallel eine zweite Migration mit derselben revision="0015"
(`0015_tickettyp_aktiv`) in main gemerged hatte. Alembic erkennt
revision-IDs eindeutig und hat 0015 nur einmal angewendet (die
Tickettyp-Variante); die Partner-Variante wurde stillschweigend
übergangen.

Konsequenz: `geschaeftspartner.mobil` / `.telefax` existierten in der
DB nicht, Backend-ORM fragte sie aber an → `column does not exist`
→ 500 beim GET /partner → leere Liste im UI.

Dieser Hotfix legt die Spalten nachträglich an, idempotent
(`IF NOT EXISTS`). Auf Staging holt er nach, was 0015 hätte tun sollen;
auf frischen Setups, auf denen 0015 sauber gelaufen ist, ist er ein
No-Op.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE geschaeftspartner "
        "ADD COLUMN IF NOT EXISTS mobil VARCHAR(64), "
        "ADD COLUMN IF NOT EXISTS telefax VARCHAR(64)"
    )


def downgrade() -> None:
    # Bewusst kein DROP: die Spalten gehören semantisch zu 0015. Wer
    # zurück will, geht über 0014 (dann werden mobil/telefax mit 0015's
    # downgrade entfernt).
    pass
