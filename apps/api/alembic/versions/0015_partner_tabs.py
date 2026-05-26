"""Track 3 (Sub-PR A) — Partner mobil + telefax

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-26

Track 3 wird in zwei Sub-PRs gegliedert (Tim-Entscheidung 2026-04-20):
  A) Backend-Skelett — diese Migration: nur die zwei Kommunikations-Spalten
     plus die neuen Read-Endpoints (Hierarchie/Objekte/Projekte/Tickets).
  B) Frontend-Refactor mit typen-Umstellung — folgt in eigener Migration
     0016 zusammen mit dem UI-Refactor, damit Build/Anzeige atomar bleiben.

Damit bleibt der Backend-PR isoliert deploybar: Frontend baut weiter
(`PartnerTyp` als Enum-Slug bleibt), nur die zwei Felder + 4 Endpoints
sind neu.
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
        "geschaeftspartner",
        sa.Column("mobil", sa.String(64), nullable=True),
    )
    op.add_column(
        "geschaeftspartner",
        sa.Column("telefax", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("geschaeftspartner", "telefax")
    op.drop_column("geschaeftspartner", "mobil")
