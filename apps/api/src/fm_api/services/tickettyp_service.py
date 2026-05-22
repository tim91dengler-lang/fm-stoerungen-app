from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fm_api.models import Tickettyp


class TickettypNotFoundError(Exception):
    pass


class SystemTickettypProtectedError(Exception):
    """Tickettyp mit ist_system=TRUE darf nicht gelöscht werden."""


async def list_tickettypen(db: AsyncSession, mandant_id: UUID) -> list[Tickettyp]:
    stmt = (
        select(Tickettyp)
        .where(Tickettyp.mandant_id == mandant_id)
        .order_by(Tickettyp.reihenfolge, Tickettyp.label)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_tickettyp(db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID) -> Tickettyp:
    stmt = select(Tickettyp).where(
        Tickettyp.id == tickettyp_id,
        Tickettyp.mandant_id == mandant_id,
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise TickettypNotFoundError(f"tickettyp {tickettyp_id} not found")
    return item


async def get_tickettyp_by_key(db: AsyncSession, mandant_id: UUID, key: str) -> Tickettyp | None:
    stmt = select(Tickettyp).where(
        Tickettyp.mandant_id == mandant_id,
        Tickettyp.key == key,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_tickettyp(
    db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]
) -> Tickettyp:
    item = Tickettyp(mandant_id=mandant_id, ist_system=False, **payload)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def update_tickettyp(
    db: AsyncSession,
    mandant_id: UUID,
    tickettyp_id: UUID,
    updates: dict[str, Any],
) -> Tickettyp:
    item = await get_tickettyp(db, mandant_id, tickettyp_id)
    for key, value in updates.items():
        if value is None and key in ("label",):
            continue
        setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    return item


async def delete_tickettyp(db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID) -> None:
    item = await get_tickettyp(db, mandant_id, tickettyp_id)
    if item.ist_system:
        raise SystemTickettypProtectedError(
            f"tickettyp '{item.key}' is system-managed and cannot be deleted"
        )
    await db.delete(item)
    await db.flush()
