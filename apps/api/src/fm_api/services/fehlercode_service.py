from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import asc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Fehlercode, Ticket


class FehlercodeNotFoundError(Exception):
    pass


_LOAD_OPTIONS = (
    selectinload(Fehlercode.kategorie_wert),
    selectinload(Fehlercode.prio_default_wert),
    selectinload(Fehlercode.tickettyp_default),
    selectinload(Fehlercode.anlage),
)


async def list_fehlercodes(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    anlage_id: UUID | None = None,
    aktiv_only: bool = False,
    include_deleted: bool = False,
    limit: int | None = None,
) -> list[tuple[Fehlercode, int]]:
    stmt = select(Fehlercode).where(Fehlercode.mandant_id == mandant_id)
    if not include_deleted:
        stmt = stmt.where(Fehlercode.deleted_at.is_(None))
    if aktiv_only:
        stmt = stmt.where(Fehlercode.aktiv.is_(True))
    if anlage_id is not None:
        stmt = stmt.where(Fehlercode.anlage_id == anlage_id)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Fehlercode.code).like(like),
                func.lower(Fehlercode.titel).like(like),
            )
        )
    stmt = stmt.options(*_LOAD_OPTIONS).order_by(asc(Fehlercode.code))
    if limit is not None:
        stmt = stmt.limit(limit)
    items = list((await db.execute(stmt)).scalars().all())

    # Nutzungs-Statistik (wie oft als fehlercode_id an einem Ticket referenziert)
    if not items:
        return []
    count_stmt = (
        select(Ticket.fehlercode_id, func.count(Ticket.id))
        .where(
            Ticket.fehlercode_id.in_([f.id for f in items]),
            Ticket.deleted_at.is_(None),
        )
        .group_by(Ticket.fehlercode_id)
    )
    counts: dict[UUID, int] = {
        row[0]: row[1] for row in (await db.execute(count_stmt)).all() if row[0]
    }
    return [(f, counts.get(f.id, 0)) for f in items]


async def get_fehlercode(
    db: AsyncSession, mandant_id: UUID, fehlercode_id: UUID
) -> tuple[Fehlercode, int]:
    stmt = (
        select(Fehlercode)
        .where(
            Fehlercode.id == fehlercode_id,
            Fehlercode.mandant_id == mandant_id,
            Fehlercode.deleted_at.is_(None),
        )
        .options(*_LOAD_OPTIONS)
    )
    f = (await db.execute(stmt)).scalar_one_or_none()
    if f is None:
        raise FehlercodeNotFoundError(f"fehlercode {fehlercode_id} not found")
    count = (
        await db.execute(
            select(func.count(Ticket.id)).where(
                Ticket.fehlercode_id == fehlercode_id, Ticket.deleted_at.is_(None)
            )
        )
    ).scalar_one()
    return f, int(count)


async def create_fehlercode(
    db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]
) -> Fehlercode:
    f = Fehlercode(mandant_id=mandant_id, **payload)
    db.add(f)
    await db.flush()
    obj, _ = await get_fehlercode(db, mandant_id, f.id)
    return obj


async def update_fehlercode(
    db: AsyncSession,
    mandant_id: UUID,
    fehlercode_id: UUID,
    updates: dict[str, Any],
) -> Fehlercode:
    f, _ = await get_fehlercode(db, mandant_id, fehlercode_id)
    for key, value in updates.items():
        if value is None and key in ("code", "titel"):
            continue
        setattr(f, key, value)
    await db.flush()
    obj, _ = await get_fehlercode(db, mandant_id, f.id)
    return obj


async def soft_delete_fehlercode(db: AsyncSession, mandant_id: UUID, fehlercode_id: UUID) -> None:
    f, _ = await get_fehlercode(db, mandant_id, fehlercode_id)
    f.deleted_at = datetime.now(UTC)
    await db.flush()
