"""Hotfix — Audit-Trigger für Junction-Tabellen reparieren

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-25

Latenter Bug aus 0005 + 0011: Junction-Tabellen wie `einheit_mieter`,
`stockwerk_mieter`, `haus_eigentuemer`, `haus_mieter`,
`stockwerk_eigentuemer`, `einheit_eigentuemer` haben einen Composite PK
(parent_id + partner_id) und keine eigene `id`-Spalte. Der Audit-Trigger
aus 0001 setzt aber `datensatz_id := to_jsonb(NEW) ->> 'id'`, was bei
diesen Tabellen NULL liefert — und `system_audit.datensatz_id` war
NOT NULL → IntegrityError beim INSERT/UPDATE/DELETE der Junction-Zeilen.

Praktischer Effekt vor diesem Fix: jeder Versuch, Mieter oder Eigentümer
einer Einheit / einem Stockwerk / einem Haus zuzuweisen, hat 500 geworfen.

Fix-Strategie:
1. `system_audit.datensatz_id` nullable machen — Junction-Audit-Zeilen
   tragen ihre Identität in `daten_nach` (JSONB mit beiden FK-Spalten).
2. Audit-Trigger anpassen, sodass bei fehlender `id`-Spalte ein
   synthetischer Schlüssel aus dem PK-Set gebaut wird (für Lesbarkeit
   in der Audit-Liste) — Fallback: NULL.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Spalte auf nullable umstellen.
    op.alter_column("system_audit", "datensatz_id", nullable=True)

    # 2. Trigger-Funktion erweitern: synthetischer Schlüssel aus PK-Spalten,
    #    falls keine `id`-Spalte existiert.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
        DECLARE
            v_mandant_id UUID;
            v_record_id  TEXT;
            v_pk_cols    TEXT[];
            v_pk_vals    TEXT[];
            v_col        TEXT;
            v_val        TEXT;
        BEGIN
            -- mandant_id only if the table has such a column
            BEGIN
                v_mandant_id := COALESCE(
                    (to_jsonb(NEW) ->> 'mandant_id')::UUID,
                    (to_jsonb(OLD) ->> 'mandant_id')::UUID
                );
            EXCEPTION WHEN OTHERS THEN
                v_mandant_id := NULL;
            END;

            -- Primary path: try to use the 'id' column.
            v_record_id := COALESCE(
                (to_jsonb(NEW) ->> 'id'),
                (to_jsonb(OLD) ->> 'id')
            );

            -- Fallback for composite-PK tables (junctions like einheit_mieter):
            -- build a deterministic key from the PK columns of the current table.
            IF v_record_id IS NULL THEN
                SELECT array_agg(a.attname ORDER BY a.attnum)
                INTO v_pk_cols
                FROM pg_index i
                JOIN pg_attribute a
                  ON a.attrelid = i.indrelid
                 AND a.attnum   = ANY(i.indkey)
                WHERE i.indrelid = TG_RELID
                  AND i.indisprimary;

                IF v_pk_cols IS NOT NULL AND array_length(v_pk_cols, 1) > 0 THEN
                    v_pk_vals := ARRAY[]::TEXT[];
                    FOREACH v_col IN ARRAY v_pk_cols LOOP
                        v_val := COALESCE(
                            (to_jsonb(NEW) ->> v_col),
                            (to_jsonb(OLD) ->> v_col)
                        );
                        v_pk_vals := v_pk_vals || COALESCE(v_val, 'NULL');
                    END LOOP;
                    v_record_id := array_to_string(v_pk_vals, ':');
                END IF;
            END IF;

            INSERT INTO system_audit (
                mandant_id, aktor_user_id, aktor_rolle_id,
                tabelle, datensatz_id, aktion,
                vorher, nachher, zeit
            )
            VALUES (
                v_mandant_id,
                NULLIF(current_setting('app.user_id', TRUE), '')::UUID,
                NULLIF(current_setting('app.rolle_id', TRUE), ''),
                TG_TABLE_NAME,
                v_record_id,
                LOWER(TG_OP),
                CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
                CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
                now()
            );

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # 3. Audit-Trigger auf den R5b-Junction-Tabellen anlegen, falls noch nicht
    #    vorhanden. Migration 0011 hat sie nicht eingetragen.
    for table in (
        "haus_eigentuemer",
        "haus_mieter",
        "stockwerk_eigentuemer",
        "einheit_eigentuemer",
    ):
        op.execute(
            f"""
            DROP TRIGGER IF EXISTS audit_{table} ON {table};
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger();
            """
        )


def downgrade() -> None:
    # Trigger auf neuen Junction-Tabellen entfernen.
    for table in (
        "einheit_eigentuemer",
        "stockwerk_eigentuemer",
        "haus_mieter",
        "haus_eigentuemer",
    ):
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")

    # Trigger-Funktion auf alten Stand zurück.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
        DECLARE
            v_mandant_id UUID;
            v_record_id  TEXT;
        BEGIN
            BEGIN
                v_mandant_id := COALESCE(
                    (to_jsonb(NEW) ->> 'mandant_id')::UUID,
                    (to_jsonb(OLD) ->> 'mandant_id')::UUID
                );
            EXCEPTION WHEN OTHERS THEN
                v_mandant_id := NULL;
            END;

            v_record_id := COALESCE(
                (to_jsonb(NEW) ->> 'id'),
                (to_jsonb(OLD) ->> 'id')
            );

            INSERT INTO system_audit (
                mandant_id, aktor_user_id, aktor_rolle_id,
                tabelle, datensatz_id, aktion,
                vorher, nachher, zeit
            )
            VALUES (
                v_mandant_id,
                NULLIF(current_setting('app.user_id', TRUE), '')::UUID,
                NULLIF(current_setting('app.rolle_id', TRUE), ''),
                TG_TABLE_NAME,
                v_record_id,
                LOWER(TG_OP),
                CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
                CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
                now()
            );

            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    # Spalte zurück auf NOT NULL. Vorher Nullen bereinigen, falls vorhanden.
    op.execute("DELETE FROM system_audit WHERE datensatz_id IS NULL;")
    op.alter_column("system_audit", "datensatz_id", nullable=False)
