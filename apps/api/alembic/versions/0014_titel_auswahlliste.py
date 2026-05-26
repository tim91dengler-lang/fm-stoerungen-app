"""R6c-Polish — Auswahlliste 'titel' seeden

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-26

Tim R6c-Polish: bisher war `partner_kontakt.titel` (und Partner-Titel) ein
freier String. Tim möchte das als Auswahlliste, die er pflegen kann
(Dr., Prof., Dipl.-Ing., …).

Wir lassen die Spalte als String, aber legen die Auswahlliste an —
das Frontend rendert das künftig als Dropdown, schreibt aber den
Label-Wert (z. B. "Dr.") in die Spalte. So bleibt die Spalte
zukunftssicher, falls jemand mal einen freien Wert braucht, und
die Migration ist trivial.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_LISTE = ("titel", "Titel", "Akademische und berufliche Titel")
_WERTE = [
    ("dr", "Dr.", 10),
    ("prof", "Prof.", 20),
    ("prof_dr", "Prof. Dr.", 30),
    ("dipl_ing", "Dipl.-Ing.", 40),
    ("dipl", "Dipl.", 50),
    ("m_sc", "M.Sc.", 60),
    ("b_sc", "B.Sc.", 70),
    ("m_a", "M.A.", 80),
    ("b_a", "B.A.", 90),
    ("ll_m", "LL.M.", 100),
    ("mag", "Mag.", 110),
    ("ing", "Ing.", 120),
]


def upgrade() -> None:
    key, label, beschreibung = _LISTE
    werte_sql = ", ".join(f"(v_titel, '{k}', '{lbl}', {ro}, NULL, FALSE)" for k, lbl, ro in _WERTE)
    op.execute(
        f"""
        DO $$
        DECLARE
            m RECORD;
            v_titel UUID;
        BEGIN
            FOR m IN SELECT id FROM mandanten LOOP
                INSERT INTO auswahllisten (mandant_id, key, label, beschreibung, ist_system)
                VALUES (m.id, '{key}', '{label}', '{beschreibung}', FALSE)
                ON CONFLICT (mandant_id, key) DO UPDATE SET label = EXCLUDED.label
                RETURNING id INTO v_titel;

                INSERT INTO auswahllisten_werte
                    (auswahlliste_id, key, label, reihenfolge, farbe, ist_system)
                VALUES {werte_sql}
                ON CONFLICT (auswahlliste_id, key) DO NOTHING;
            END LOOP;
        END $$;
        """  # noqa: S608 — module constants only
    )


def downgrade() -> None:
    op.execute("DELETE FROM auswahllisten WHERE key = 'titel'")
