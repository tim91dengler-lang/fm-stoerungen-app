from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from fm_api.core.config import get_settings


def _make_engine() -> "async_sessionmaker[AsyncSession]":
    settings = get_settings()
    engine = create_async_engine(
        str(settings.database_url),
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


SessionLocal: "async_sessionmaker[AsyncSession]" = _make_engine()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
