from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from fm_api import __version__
from fm_api.core.deps import DbSession

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": __version__,
        "now": datetime.now(UTC).isoformat(),
    }


@router.get("/health/db", summary="Readiness probe (DB connectivity)")
async def health_db(db: DbSession) -> dict[str, Any]:
    result = await db.execute(text("SELECT 1"))
    return {
        "status": "ok" if result.scalar_one() == 1 else "fail",
        "db": "reachable",
    }
