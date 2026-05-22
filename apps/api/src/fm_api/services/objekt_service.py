from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import GeschaeftsPartner, Objekt, ObjektPartner
from fm_api.models.partner import PartnerTyp


class ObjektNotFoundError(Exception):
    pass


class InvalidPartnerLinkError(Exception):
    pass


_OBJEKT_LOAD_OPTIONS = (
    selectinload(Objekt.adresse),
    selectinload(Objekt.partner_links).selectinload(ObjektPartner.partner),
)


async def list_objekte(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Objekt], int]:
    base = select(Objekt).where(Objekt.mandant_id == mandant_id)
    if not include_deleted:
        base = base.where(Objekt.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        base = base.where(or_(func.lower(Objekt.name).like(like)))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = (
        base.options(*_OBJEKT_LOAD_OPTIONS).order_by(Objekt.name).limit(limit).offset(offset)
    )
    items = (await db.execute(items_stmt)).scalars().unique().all()
    return list(items), total


async def get_objekt(db: AsyncSession, objekt_id: UUID, mandant_id: UUID) -> Objekt:
    stmt = (
        select(Objekt)
        .where(
            Objekt.id == objekt_id,
            Objekt.mandant_id == mandant_id,
            Objekt.deleted_at.is_(None),
        )
        .options(*_OBJEKT_LOAD_OPTIONS)
    )
    objekt = (await db.execute(stmt)).scalar_one_or_none()
    if objekt is None:
        raise ObjektNotFoundError(f"objekt {objekt_id} not found")
    return objekt


async def _validate_partner_links(
    db: AsyncSession,
    mandant_id: UUID,
    links: list[dict[str, Any]],
) -> None:
    if not links:
        return
    partner_ids = {link["partner_id"] for link in links}
    found = (
        (
            await db.execute(
                select(GeschaeftsPartner.id).where(
                    GeschaeftsPartner.id.in_(partner_ids),
                    GeschaeftsPartner.mandant_id == mandant_id,
                    GeschaeftsPartner.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    missing = partner_ids - set(found)
    if missing:
        raise InvalidPartnerLinkError(
            f"partner-ids not found for mandant: {sorted(str(m) for m in missing)}"
        )


async def create_objekt(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    payload: dict[str, Any],
) -> Objekt:
    links = payload.pop("partner_links", []) or []
    await _validate_partner_links(db, mandant_id, links)

    objekt = Objekt(mandant_id=mandant_id, **payload)
    db.add(objekt)
    await db.flush()

    for link in links:
        db.add(
            ObjektPartner(
                objekt_id=objekt.id,
                partner_id=link["partner_id"],
                rolle=PartnerTyp(link["rolle"]),
            )
        )
    await db.flush()
    # Reload mit allen Relationships (inkl. partner_links.partner für die
    # Response-Serialisierung), weil refresh() nur die explizit gelisteten
    # Felder lädt und partner_links.partner sonst lazy="raise" greifen würde.
    return await get_objekt(db, objekt.id, mandant_id)


async def update_objekt(
    db: AsyncSession,
    objekt_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
) -> Objekt:
    objekt = await get_objekt(db, objekt_id, mandant_id)
    new_links: list[dict[str, Any]] | None = updates.pop("partner_links", None)
    if new_links is not None:
        await _validate_partner_links(db, mandant_id, new_links)

    for key, value in updates.items():
        if value is None and key in ("name",):
            continue
        setattr(objekt, key, value)

    if new_links is not None:
        # Komplett ersetzen: erst Links via Core bulk-deleten, dann Session-Expire,
        # dann neue Links via INSERT (auch Core, vermeidet Cascade-/Cache-Konflikte).
        await db.execute(delete(ObjektPartner).where(ObjektPartner.objekt_id == objekt.id))
        await db.flush()
        if new_links:
            await db.execute(
                insert(ObjektPartner),
                [
                    {
                        "objekt_id": objekt.id,
                        "partner_id": link["partner_id"],
                        "rolle": PartnerTyp(link["rolle"]).value,
                    }
                    for link in new_links
                ],
            )
        # Session-Cache verwerfen, sonst liefert relationship-Load alte Werte
        db.expunge(objekt)

    await db.flush()
    # Reload für komplette Relationship-Tiefe (s. create_objekt)
    return await get_objekt(db, objekt.id, mandant_id)


async def soft_delete_objekt(db: AsyncSession, objekt_id: UUID, mandant_id: UUID) -> None:
    objekt = await get_objekt(db, objekt_id, mandant_id)
    objekt.deleted_at = datetime.now(UTC)
    await db.flush()
