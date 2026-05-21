from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from fm_api.models import Adresse


class AdresseNotFoundError(Exception):
    pass


async def list_adressen(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Adresse], int]:
    base = select(Adresse).where(Adresse.mandant_id == mandant_id)
    if search:
        like = f"%{search.lower()}%"
        base = base.where(
            or_(
                func.lower(Adresse.strasse).like(like),
                func.lower(Adresse.ort).like(like),
                func.lower(Adresse.plz).like(like),
            )
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = base.order_by(desc(Adresse.created_at)).limit(limit).offset(offset)
    items = (await db.execute(items_stmt)).scalars().all()
    return list(items), total


async def get_adresse(db: AsyncSession, adresse_id: UUID, mandant_id: UUID) -> Adresse:
    stmt = select(Adresse).where(Adresse.id == adresse_id, Adresse.mandant_id == mandant_id)
    adresse = (await db.execute(stmt)).scalar_one_or_none()
    if adresse is None:
        raise AdresseNotFoundError(f"adresse {adresse_id} not found")
    return adresse


async def create_adresse(db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]) -> Adresse:
    adresse = Adresse(mandant_id=mandant_id, **payload)
    db.add(adresse)
    await db.flush()
    await db.refresh(adresse)
    return adresse


async def update_adresse(
    db: AsyncSession, adresse_id: UUID, mandant_id: UUID, updates: dict[str, Any]
) -> Adresse:
    adresse = await get_adresse(db, adresse_id, mandant_id)
    for key, value in updates.items():
        setattr(adresse, key, value)
    await db.flush()
    await db.refresh(adresse)
    return adresse


async def delete_adresse(db: AsyncSession, adresse_id: UUID, mandant_id: UUID) -> None:
    adresse = await get_adresse(db, adresse_id, mandant_id)
    await db.delete(adresse)
    await db.flush()
