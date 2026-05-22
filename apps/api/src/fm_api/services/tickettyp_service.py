from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Tickettyp, TickettypFeld


class TickettypNotFoundError(Exception):
    pass


class SystemTickettypProtectedError(Exception):
    """Tickettyp mit ist_system=TRUE darf nicht gelöscht werden."""


class TickettypFeldNotFoundError(Exception):
    pass


_LOAD_OPTIONS = (selectinload(Tickettyp.felder),)


async def list_tickettypen(db: AsyncSession, mandant_id: UUID) -> list[Tickettyp]:
    stmt = (
        select(Tickettyp)
        .where(Tickettyp.mandant_id == mandant_id)
        .options(*_LOAD_OPTIONS)
        .order_by(Tickettyp.reihenfolge, Tickettyp.label)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_tickettyp(db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID) -> Tickettyp:
    stmt = (
        select(Tickettyp)
        .where(
            Tickettyp.id == tickettyp_id,
            Tickettyp.mandant_id == mandant_id,
        )
        .options(*_LOAD_OPTIONS)
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise TickettypNotFoundError(f"tickettyp {tickettyp_id} not found")
    return item


async def get_tickettyp_by_key(db: AsyncSession, mandant_id: UUID, key: str) -> Tickettyp | None:
    stmt = (
        select(Tickettyp)
        .where(
            Tickettyp.mandant_id == mandant_id,
            Tickettyp.key == key,
        )
        .options(*_LOAD_OPTIONS)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_tickettyp(
    db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]
) -> Tickettyp:
    item = Tickettyp(mandant_id=mandant_id, ist_system=False, **payload)
    db.add(item)
    await db.flush()
    return await get_tickettyp(db, mandant_id, item.id)


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
    return await get_tickettyp(db, mandant_id, item.id)


async def delete_tickettyp(db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID) -> None:
    item = await get_tickettyp(db, mandant_id, tickettyp_id)
    if item.ist_system:
        raise SystemTickettypProtectedError(
            f"tickettyp '{item.key}' is system-managed and cannot be deleted"
        )
    await db.delete(item)
    await db.flush()


# ---- Felder (System-Feld-Sichtbar/Pflicht/Reihenfolge je Vorlage) ----


async def update_tickettyp_feld(
    db: AsyncSession,
    mandant_id: UUID,
    tickettyp_id: UUID,
    feld_key: str,
    updates: dict[str, Any],
) -> TickettypFeld:
    # Authorize tickettyp belongs to mandant
    await get_tickettyp(db, mandant_id, tickettyp_id)
    stmt = select(TickettypFeld).where(
        TickettypFeld.tickettyp_id == tickettyp_id,
        TickettypFeld.feld_key == feld_key,
    )
    feld = (await db.execute(stmt)).scalar_one_or_none()
    if feld is None:
        raise TickettypFeldNotFoundError(f"feld '{feld_key}' not found on tickettyp {tickettyp_id}")
    for key, value in updates.items():
        if value is None:
            continue
        setattr(feld, key, value)
    await db.flush()
    return feld
