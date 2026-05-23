from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Projekt, Ticket


class ProjektNotFoundError(Exception):
    pass


_PROJEKT_LOAD_OPTIONS = (selectinload(Projekt.verantwortlich),)


async def list_projekte(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    status_filter: list[str] | None = None,
    include_deleted: bool = False,
) -> list[tuple[Projekt, int]]:
    base = select(Projekt).where(Projekt.mandant_id == mandant_id)
    if not include_deleted:
        base = base.where(Projekt.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        base = base.where(func.lower(Projekt.name).like(like))
    if status_filter:
        base = base.where(Projekt.status.in_(status_filter))

    items = (
        (await db.execute(base.options(*_PROJEKT_LOAD_OPTIONS).order_by(desc(Projekt.created_at))))
        .scalars()
        .all()
    )

    # Ticket-Count je Projekt
    count_stmt = (
        select(Ticket.projekt_id, func.count(Ticket.id))
        .where(
            Ticket.projekt_id.in_([p.id for p in items]),
            Ticket.deleted_at.is_(None),
        )
        .group_by(Ticket.projekt_id)
    )
    counts: dict[UUID, int] = {
        row[0]: row[1] for row in (await db.execute(count_stmt)).all() if row[0]
    }

    return [(p, counts.get(p.id, 0)) for p in items]


async def get_projekt(db: AsyncSession, mandant_id: UUID, projekt_id: UUID) -> tuple[Projekt, int]:
    stmt = (
        select(Projekt)
        .where(
            Projekt.id == projekt_id,
            Projekt.mandant_id == mandant_id,
            Projekt.deleted_at.is_(None),
        )
        .options(*_PROJEKT_LOAD_OPTIONS)
    )
    p = (await db.execute(stmt)).scalar_one_or_none()
    if p is None:
        raise ProjektNotFoundError(f"projekt {projekt_id} not found")
    count = (
        await db.execute(
            select(func.count(Ticket.id)).where(
                Ticket.projekt_id == projekt_id, Ticket.deleted_at.is_(None)
            )
        )
    ).scalar_one()
    return p, count


async def create_projekt(db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]) -> Projekt:
    p = Projekt(mandant_id=mandant_id, **payload)
    db.add(p)
    await db.flush()
    new_id = p.id
    db.expunge(p)
    fresh, _ = await get_projekt(db, mandant_id, new_id)
    return fresh


async def update_projekt(
    db: AsyncSession,
    mandant_id: UUID,
    projekt_id: UUID,
    updates: dict[str, Any],
) -> Projekt:
    p, _ = await get_projekt(db, mandant_id, projekt_id)
    for key, value in updates.items():
        if value is None and key in ("name",):
            continue
        setattr(p, key, value)
    await db.flush()
    # Reload mit eager-loaded relationships statt partial refresh — sonst
    # MissingGreenlet beim Pydantic-Validate auf den expired Attributen.
    db.expunge(p)
    fresh, _ = await get_projekt(db, mandant_id, projekt_id)
    return fresh


async def soft_delete_projekt(db: AsyncSession, mandant_id: UUID, projekt_id: UUID) -> None:
    p, _ = await get_projekt(db, mandant_id, projekt_id)
    p.deleted_at = datetime.now(UTC)
    await db.flush()
