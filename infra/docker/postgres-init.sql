-- Initial Postgres setup for dev — pgvector + pg_trgm extensions.
-- Schema/tables are managed by Alembic migrations, not here.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
