import os
from collections.abc import AsyncGenerator
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# Test env must be set BEFORE app imports
os.environ.setdefault("ENV", "test")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/fm_stoerungen_test",
)
os.environ.setdefault(
    "JWT_SECRET",
    "test-secret-32-chars-long-not-for-prod",
)

from fm_api.core.config import get_settings
from fm_api.core.security import hash_password
from fm_api.db.base import Base
from fm_api.db.session import SessionLocal
from fm_api.main import create_app
from fm_api.models import Auswahlliste, AuswahllistenWert, Mandant, Role, User
from fm_api.services.auswahlliste_service import ensure_system_auswahllisten

# Partner-bezogene Auswahllisten werden in Production via Migration 0013
# pro Mandant geseedet. Im Test-Setup (Base.metadata.create_all umgeht die
# Alembic-Pipeline) müssen wir sie hier nachstellen. Bewusst minimal —
# Tests brauchen nur `partner_typ`-Werte.
_PARTNER_TYP_WERTE: list[tuple[str, str, int]] = [
    ("mieter", "Mieter", 10),
    ("eigentuemer", "Eigentümer", 20),
    ("auftraggeber", "Auftraggeber", 30),
    ("dienstleister", "Dienstleister", 40),
    ("nachunternehmer", "Nachunternehmer", 50),
    ("privatperson", "Privatperson", 60),
]


async def _seed_partner_typ_liste(db: AsyncSession, mandant_id: UUID) -> None:
    liste = Auswahlliste(
        mandant_id=mandant_id,
        key="partner_typ",
        label="Partner-Typ",
        beschreibung="Funktionale Rolle eines Geschäftspartners",
        ist_system=False,
    )
    db.add(liste)
    await db.flush()
    for wert_key, label, reihenfolge in _PARTNER_TYP_WERTE:
        db.add(
            AuswahllistenWert(
                auswahlliste_id=liste.id,
                key=wert_key,
                label=label,
                reihenfolge=reihenfolge,
                ist_system=False,
            )
        )
    await db.flush()


def _engine():
    return create_async_engine(
        str(get_settings().database_url),
        echo=False,
        future=True,
    )


@pytest.fixture(scope="session", autouse=True)
async def _prepare_schema():
    """Drop + recreate schema once per test session.

    Postgres ENUMs are dropped + recreated manually because SQLAlchemy's Enum
    columns are configured with ``create_type=False`` (Alembic migration owns
    the type lifecycle in production).
    """
    engine = _engine()
    async with engine.begin() as conn:
        await conn.execute(text("DROP TYPE IF EXISTS partner_typ CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS ticket_status CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS ticket_prioritaet CASCADE"))
        await conn.run_sync(Base.metadata.drop_all)

        await conn.execute(
            text(
                "CREATE TYPE partner_typ AS ENUM "
                "('mieter','eigentuemer','auftraggeber','nachunternehmer',"
                "'privatperson')"
            )
        )
        await conn.run_sync(Base.metadata.create_all)

        # Tickets-Nummer auto-increment per Mandant (Alembic owns this in production)
        await conn.execute(
            text("""
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
        )
        await conn.execute(
            text("""
            CREATE TRIGGER trg_tickets_set_nummer
            BEFORE INSERT ON tickets
            FOR EACH ROW EXECUTE FUNCTION set_ticket_nummer();
            """)
        )
    await engine.dispose()


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def mandant(db: AsyncSession) -> Mandant:
    m = Mandant(name="Test-Mandant", slug=f"test-{uuid4().hex[:8]}")
    db.add(m)
    await db.flush()
    await ensure_system_auswahllisten(db, m.id)
    await _seed_partner_typ_liste(db, m.id)
    await db.commit()
    await db.refresh(m)
    return m


@pytest.fixture
async def partner_typ_uuids(db: AsyncSession, mandant: Mandant) -> dict[str, UUID]:
    """Lookup-Dict slug → UUID für die `partner_typ`-Liste des Mandanten."""
    rows = (
        await db.execute(
            text(
                "SELECT w.key, w.id "
                "FROM auswahllisten_werte w "
                "JOIN auswahllisten l ON l.id = w.auswahlliste_id "
                "WHERE l.mandant_id = :mid AND l.key = 'partner_typ'"
            ).bindparams(mid=mandant.id)
        )
    ).all()
    return {r[0]: r[1] for r in rows}


@pytest.fixture
async def admin_role(db: AsyncSession, mandant: Mandant) -> Role:
    r = Role(mandant_id=mandant.id, name="admin", beschreibung="Admin")
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


@pytest.fixture
async def admin_user(db: AsyncSession, mandant: Mandant, admin_role: Role) -> tuple[User, str]:
    raw_pw = "TestPassword123!"
    u = User(
        mandant_id=mandant.id,
        email=f"admin-{uuid4().hex[:8]}@example.org",
        password_hash=hash_password(raw_pw),
        full_name="Test Admin",
        is_active=True,
        roles=[admin_role],
    )
    db.add(u)
    await db.commit()
    await db.refresh(u, ["roles"])
    return u, raw_pw


@pytest.fixture
async def techniker_user(db: AsyncSession, mandant: Mandant) -> tuple[User, str]:
    raw_pw = "TechPassword123!"
    u = User(
        mandant_id=mandant.id,
        email=f"tech-{uuid4().hex[:8]}@example.org",
        password_hash=hash_password(raw_pw),
        full_name="Test Techniker",
        is_active=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u, ["roles"])
    return u, raw_pw


async def login(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


__all__ = [
    "UUID",
    "auth_header",
    "login",
]
