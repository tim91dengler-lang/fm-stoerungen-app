"""R8 Vorlagen-Designer — Tickettyp.aktiv (deaktivierbare Vorlagen)

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-26

Tim 2026-05-26 (Track-2-Spec): Vorlagen sollen deaktivierbar sein.
System- und User-Vorlagen können auf inaktiv gesetzt werden. Deaktivierte
Vorlagen erscheinen nicht mehr im Tickettyp-Picker des TicketErfassenModal
(GET /tickettypen?aktiv_only=true), bleiben aber in der DB und in
bestehenden Tickets sichtbar (FK ON DELETE SET NULL bleibt unverändert).

Track-3-Hinweis (Sub-PR B): Ursprünglich als 0015 vergeben — kollidierte
mit Track 3's 0015_partner_tabs (beide parallel auf main gemerged) und
wurde in Sub-PR B auf 0016 umnummeriert. Auf Staging war die alte
0015-Version bereits gelaufen → `aktiv`-Spalte existiert dort schon,
aber `alembic_version` zeigt noch auf 0015. Die idempotente Form
(`IF NOT EXISTS`) lässt diese Migration auf solchen DBs als No-Op
durchlaufen und auf frischen Setups die Spalte korrekt anlegen.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Idempotent: PostgreSQL `IF NOT EXISTS` macht den Schritt auf frischer
    # DB zum echten ADD COLUMN, auf einer DB mit bereits angelegter Spalte
    # (Staging nach erstem Track-2-Deploy) zum No-Op.
    op.execute(
        "ALTER TABLE tickettypen ADD COLUMN IF NOT EXISTS aktiv BOOLEAN NOT NULL DEFAULT true"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE tickettypen DROP COLUMN IF EXISTS aktiv")
