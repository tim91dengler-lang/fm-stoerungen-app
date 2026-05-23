from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import GeschaeftsPartner
from fm_api.models.partner import PartnerTyp


class PartnerNotFoundError(Exception):
    pass


_PARTNER_LOAD_OPTIONS = (selectinload(GeschaeftsPartner.adresse),)


async def list_partner(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    typ_filter: list[str] | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[GeschaeftsPartner], int]:
    base = select(GeschaeftsPartner).where(GeschaeftsPartner.mandant_id == mandant_id)
    if not include_deleted:
        base = base.where(GeschaeftsPartner.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        base = base.where(
            or_(
                func.lower(GeschaeftsPartner.name).like(like),
                func.lower(GeschaeftsPartner.ansprechpartner).like(like),
                func.lower(GeschaeftsPartner.email).like(like),
            )
        )
    if typ_filter:
        # ARRAY overlap: partner.typen && ARRAY['mieter','eigentuemer']
        valid = [PartnerTyp(t) for t in typ_filter if t in PartnerTyp.__members__.values()]
        if valid:
            base = base.where(GeschaeftsPartner.typen.op("&&")(valid))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = (
        base.options(*_PARTNER_LOAD_OPTIONS)
        .order_by(GeschaeftsPartner.name)
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(items_stmt)).scalars().all()
    return list(items), total


async def get_partner(db: AsyncSession, partner_id: UUID, mandant_id: UUID) -> GeschaeftsPartner:
    stmt = (
        select(GeschaeftsPartner)
        .where(
            GeschaeftsPartner.id == partner_id,
            GeschaeftsPartner.mandant_id == mandant_id,
            GeschaeftsPartner.deleted_at.is_(None),
        )
        .options(*_PARTNER_LOAD_OPTIONS)
    )
    partner = (await db.execute(stmt)).scalar_one_or_none()
    if partner is None:
        raise PartnerNotFoundError(f"partner {partner_id} not found")
    return partner


async def create_partner(
    db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]
) -> GeschaeftsPartner:
    typen_str = payload.pop("typen", [])
    typen = [PartnerTyp(t) for t in typen_str]
    partner = GeschaeftsPartner(mandant_id=mandant_id, typen=typen, **payload)
    db.add(partner)
    await db.flush()
    new_id = partner.id
    db.expunge(partner)
    return await get_partner(db, new_id, mandant_id)


async def update_partner(
    db: AsyncSession,
    partner_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
) -> GeschaeftsPartner:
    partner = await get_partner(db, partner_id, mandant_id)
    if "typen" in updates and updates["typen"] is not None:
        partner.typen = [PartnerTyp(t) for t in updates.pop("typen")]
    for key, value in updates.items():
        if value is None and key in ("name",):
            # name darf nicht auf None gesetzt werden — überspringen
            continue
        setattr(partner, key, value)
    await db.flush()
    # Nach flush sind alle Attribute expired. Statt nur `adresse` zu refreshen,
    # neu laden mit eager-loading — sonst MissingGreenlet beim Pydantic-Validate.
    db.expunge(partner)
    return await get_partner(db, partner_id, mandant_id)


async def soft_delete_partner(db: AsyncSession, partner_id: UUID, mandant_id: UUID) -> None:
    partner = await get_partner(db, partner_id, mandant_id)
    partner.deleted_at = datetime.now(UTC)
    await db.flush()
