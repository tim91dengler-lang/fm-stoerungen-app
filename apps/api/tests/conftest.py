import asyncio
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
from fm_api.models import Mandant, Role, User


def _engine():
    return create_async_engine(
        str(get_settings().database_url),
        echo=False,
        future=True,
    )


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def _prepare_schema():
    """Drop + recreate schema once per test session.

    Postgres ENUMs are dropped + recreated manually because SQLAlchemy's Enum
    columns are configured with ``create_type=False`` (Alembic migration owns
    the type lifecycle in production).
    """
    engine = _engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(text("DROP TYPE IF EXISTS ticket_status CASCADE"))
        await conn.execute(text("DROP TYPE IF EXISTS ticket_prioritaet CASCADE"))
        await conn.execute(
            text(
                "CREATE TYPE ticket_status AS ENUM "
                "('neu','zugewiesen','in_arbeit','erledigt','geschlossen')"
            )
        )
        await conn.execute(
            text("CREATE TYPE ticket_prioritaet AS ENUM ('niedrig','mittel','hoch','kritisch')")
        )
        await conn.run_sync(Base.metadata.create_all)
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
    await db.commit()
    await db.refresh(m)
    return m


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
        email="admin@example.org",
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
        email="tech@example.org",
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
