"""initial schema — mandanten, users, roles, tickets, system_audit + triggers

Revision ID: 0001
Revises:
Create Date: 2026-05-21

Slice 1 — Auth + User-CRUD + Tickets-CRUD.

Schicht 9 der Sicherheitsarchitektur: Audit-Log auf allen Schreib-Tabellen
über Postgres-Trigger. Aktor wird aus Session-Variablen 'app.user_id' und
'app.rolle_id' gelesen, die das Backend per Request setzt.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


AUDITED_TABLES = ("mandanten", "users", "roles", "tickets")


def upgrade() -> None:
    # ---------- extensions ----------
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # ---------- mandanten ----------
    op.create_table(
        "mandanten",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("slug", name="uq_mandanten_slug"),
    )
    op.create_index("ix_mandanten_slug", "mandanten", ["slug"])

    # ---------- users ----------
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_users_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("mandant_id", "email", name="uq_users_mandant_id_email"),
    )
    op.create_index("ix_users_mandant_id", "users", ["mandant_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # ---------- roles ----------
    op.create_table(
        "roles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("beschreibung", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_roles_mandant_id_mandanten",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("mandant_id", "name", name="uq_roles_mandant_id_name"),
    )
    op.create_index("ix_roles_mandant_id", "roles", ["mandant_id"])

    # ---------- user_roles (n:m) ----------
    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_roles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["roles.id"],
            name="fk_user_roles_role_id_roles",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
    )

    # ---------- ticket enums ----------
    op.execute(
        "CREATE TYPE ticket_status AS ENUM "
        "('neu','zugewiesen','in_arbeit','erledigt','geschlossen');"
    )
    op.execute("CREATE TYPE ticket_prioritaet AS ENUM ('niedrig','mittel','hoch','kritisch');")

    # ---------- tickets ----------
    op.create_table(
        "tickets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nummer", sa.Integer(), nullable=False),
        sa.Column("titel", sa.String(200), nullable=False),
        sa.Column("beschreibung", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "status",
            postgresql.ENUM(
                "neu",
                "zugewiesen",
                "in_arbeit",
                "erledigt",
                "geschlossen",
                name="ticket_status",
                create_type=False,
            ),
            nullable=False,
            server_default="neu",
        ),
        sa.Column(
            "prioritaet",
            postgresql.ENUM(
                "niedrig",
                "mittel",
                "hoch",
                "kritisch",
                name="ticket_prioritaet",
                create_type=False,
            ),
            nullable=False,
            server_default="mittel",
        ),
        sa.Column("eroeffnet_von_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zugewiesen_an_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("eroeffnet_am", sa.DateTime(timezone=True), nullable=False),
        sa.Column("zugewiesen_am", sa.DateTime(timezone=True), nullable=True),
        sa.Column("erledigt_am", sa.DateTime(timezone=True), nullable=True),
        sa.Column("geschlossen_am", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_tickets_mandant_id_mandanten",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["eroeffnet_von_id"],
            ["users.id"],
            name="fk_tickets_eroeffnet_von_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["zugewiesen_an_id"],
            ["users.id"],
            name="fk_tickets_zugewiesen_an_id_users",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("mandant_id", "nummer", name="uq_tickets_mandant_id_nummer"),
    )
    op.create_index("ix_tickets_mandant_id", "tickets", ["mandant_id"])
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("ix_tickets_prioritaet", "tickets", ["prioritaet"])
    op.create_index("ix_tickets_zugewiesen_an_id", "tickets", ["zugewiesen_an_id"])

    # ---------- ticket-nummer auto-increment per mandant ----------
    # Trigger BEFORE INSERT: if nummer is NULL/0, set MAX(nummer)+1 for the mandant.
    # Advisory lock on mandant_id prevents race-condition on concurrent inserts.
    op.execute("""
        CREATE OR REPLACE FUNCTION set_ticket_nummer() RETURNS TRIGGER AS $$
        DECLARE
            next_nummer INT;
        BEGIN
            IF NEW.nummer IS NULL OR NEW.nummer = 0 THEN
                PERFORM pg_advisory_xact_lock(hashtext(NEW.mandant_id::text));
                SELECT COALESCE(MAX(nummer), 0) + 1
                  INTO next_nummer
                  FROM tickets
                 WHERE mandant_id = NEW.mandant_id;
                NEW.nummer := next_nummer;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_tickets_set_nummer
        BEFORE INSERT ON tickets
        FOR EACH ROW EXECUTE FUNCTION set_ticket_nummer();
    """)

    # ---------- system_audit ----------
    op.create_table(
        "system_audit",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("mandant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aktor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aktor_rolle_id", sa.Text(), nullable=True),
        sa.Column("tabelle", sa.String(64), nullable=False),
        sa.Column("datensatz_id", sa.Text(), nullable=False),
        sa.Column("aktion", sa.String(16), nullable=False),
        sa.Column("vorher", postgresql.JSONB(), nullable=True),
        sa.Column("nachher", postgresql.JSONB(), nullable=True),
        sa.Column(
            "zeit",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["mandant_id"],
            ["mandanten.id"],
            name="fk_system_audit_mandant_id_mandanten",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["aktor_user_id"],
            ["users.id"],
            name="fk_system_audit_aktor_user_id_users",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_system_audit_tabelle", "system_audit", ["tabelle", "datensatz_id", "zeit"])
    op.create_index("ix_system_audit_mandant_zeit", "system_audit", ["mandant_id", "zeit"])
    op.create_index("ix_system_audit_aktor_user_id", "system_audit", ["aktor_user_id"])

    # ---------- audit trigger function ----------
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
        DECLARE
            v_mandant_id UUID;
            v_record_id  TEXT;
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
    """)

    # ---------- audit triggers on each table ----------
    for table in AUDITED_TABLES:
        op.execute(f"""
            CREATE TRIGGER audit_{table}
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger();
        """)


def downgrade() -> None:
    for table in AUDITED_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS audit_{table} ON {table};")
    op.execute("DROP FUNCTION IF EXISTS audit_trigger();")

    op.drop_table("system_audit")

    op.execute("DROP TRIGGER IF EXISTS trg_tickets_set_nummer ON tickets;")
    op.execute("DROP FUNCTION IF EXISTS set_ticket_nummer();")

    op.drop_table("tickets")
    op.execute("DROP TYPE IF EXISTS ticket_prioritaet;")
    op.execute("DROP TYPE IF EXISTS ticket_status;")

    op.drop_table("user_roles")
    op.drop_table("roles")
    op.drop_table("users")
    op.drop_table("mandanten")
