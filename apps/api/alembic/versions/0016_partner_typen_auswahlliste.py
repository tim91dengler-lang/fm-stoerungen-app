"""Track 3 (Sub-PR B) — Partner.typen auf Auswahlliste umstellen

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-26

Stellt `geschaeftspartner.typen` von einem Enum-Array (`partner_typ[]`)
auf ein UUID-Array auf die Auswahlliste `partner_typ` (Tim-Entscheidung
Variante A, 2026-04-20) um. Damit kann Tim selbst Typen pflegen
(z. B. `dienstleister`, das im Postgres-Enum nie existiert hat).

Backfill pro Mandant: für jeden bestehenden Enum-Wert wird die UUID des
passenden Auswahlliste-Wertes (gleiches `key`) gesucht. Mandant-Isolation
ist zwingend (Listen sind mandantengebunden).

Wichtig:
  Das Postgres-Enum `partner_typ` wird NICHT gedroppt, weil die Junction
  `objekt_partner.rolle` es weiter nutzt (semantisch andere Achse —
  Rolle des Partners AM Objekt, nicht globaler Partner-Typ).

Downgrade-Verlust:
  Auswahllisten-Werte, deren `key` nicht im Original-Enum existiert
  (insbesondere `dienstleister`), gehen beim Downgrade verloren.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ============================================================
    # 1) Neue Spalte typen_neu (UUID-Array auf Auswahlliste)
    # ============================================================
    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "typen_neu",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'::uuid[]"),
        ),
    )

    # ============================================================
    # 2) Backfill: Enum-Werte → Auswahllisten-Werte (pro Mandant)
    # ============================================================
    # Annahme: Migration 0013 hat die Liste `partner_typ` pro Mandant
    # angelegt; die Keys decken die Enum-Werte 1:1 ab.
    op.execute(
        """
        UPDATE geschaeftspartner gp
        SET typen_neu = COALESCE(
            (
                SELECT array_agg(w.id ORDER BY w.reihenfolge)
                FROM unnest(gp.typen) AS old_typ
                JOIN auswahllisten l
                    ON l.mandant_id = gp.mandant_id
                   AND l.key = 'partner_typ'
                JOIN auswahllisten_werte w
                    ON w.auswahlliste_id = l.id
                   AND w.key = old_typ::text
            ),
            '{}'::uuid[]
        )
        WHERE array_length(gp.typen, 1) IS NOT NULL
        """
    )

    # ============================================================
    # 3) Alte Spalte droppen, neue umbenennen
    # ============================================================
    op.drop_column("geschaeftspartner", "typen")
    op.alter_column("geschaeftspartner", "typen_neu", new_column_name="typen")

    # Enum `partner_typ` bleibt — wird von `objekt_partner.rolle` weiter
    # genutzt (Variante A, Tim-Entscheidung 2026-04-20).


def downgrade() -> None:
    # ============================================================
    # 1) typen wieder als Enum-Array — Best-effort
    # ============================================================
    op.add_column(
        "geschaeftspartner",
        sa.Column(
            "typen_alt",
            postgresql.ARRAY(
                postgresql.ENUM(name="partner_typ", create_type=False)
            ),
            nullable=False,
            server_default=sa.text("'{}'::partner_typ[]"),
        ),
    )
    # Nur Werte zurückübersetzen, die im Original-Enum existieren.
    op.execute(
        """
        UPDATE geschaeftspartner gp
        SET typen_alt = COALESCE(
            (
                SELECT array_agg(w.key::partner_typ ORDER BY w.reihenfolge)
                FROM auswahllisten_werte w
                WHERE w.id = ANY(gp.typen)
                  AND w.key IN (
                      'mieter', 'eigentuemer', 'auftraggeber',
                      'nachunternehmer', 'privatperson'
                  )
            ),
            '{}'::partner_typ[]
        )
        WHERE array_length(gp.typen, 1) IS NOT NULL
        """
    )
    op.drop_column("geschaeftspartner", "typen")
    op.alter_column("geschaeftspartner", "typen_alt", new_column_name="typen")
