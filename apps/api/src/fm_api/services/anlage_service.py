from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import asc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Anlage, Objekt
from fm_api.models.objektstruktur import ObjektStockwerk
from fm_api.services.auswahlliste_service import (
    AuswahllistenWertNotFoundError,
    get_wert_by_id,
)


class AnlageNotFoundError(Exception):
    pass


class AnlageValidationError(Exception):
    """Ungültiger/fremder referenzierter FK (Kategorie-Wert/Objekt/Stockwerk) — IDOR-Schutz."""


async def _validate_anlage_fks(db: AsyncSession, mandant_id: UUID, data: dict[str, Any]) -> None:
    """Mandantengebundene Validierung der user-gelieferten FKs (create + update)."""
    if data.get("kategorie_wert_id") is not None:
        try:
            await get_wert_by_id(db, mandant_id, data["kategorie_wert_id"], "ticket_kategorie")
        except AuswahllistenWertNotFoundError as exc:
            raise AnlageValidationError(str(exc)) from exc
    if data.get("objekt_id") is not None:
        ok = (
            await db.execute(
                select(Objekt.id).where(
                    Objekt.id == data["objekt_id"],
                    Objekt.mandant_id == mandant_id,
                    Objekt.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if ok is None:
            raise AnlageValidationError(f"objekt {data['objekt_id']} not in mandant")
    if data.get("stockwerk_id") is not None:
        ok = (
            await db.execute(
                select(ObjektStockwerk.id).where(
                    ObjektStockwerk.id == data["stockwerk_id"],
                    ObjektStockwerk.mandant_id == mandant_id,
                )
            )
        ).scalar_one_or_none()
        if ok is None:
            raise AnlageValidationError(f"stockwerk {data['stockwerk_id']} not in mandant")


_LOAD_OPTIONS = (
    selectinload(Anlage.kategorie_wert),
    selectinload(Anlage.objekt),
    selectinload(Anlage.stockwerk),
)


async def list_anlagen(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    objekt_id: UUID | None = None,
    aktiv_only: bool = False,
    include_deleted: bool = False,
    limit: int | None = None,
) -> list[Anlage]:
    stmt = select(Anlage).where(Anlage.mandant_id == mandant_id)
    if not include_deleted:
        stmt = stmt.where(Anlage.deleted_at.is_(None))
    if aktiv_only:
        stmt = stmt.where(Anlage.aktiv.is_(True))
    if objekt_id is not None:
        stmt = stmt.where(Anlage.objekt_id == objekt_id)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(func.lower(Anlage.bezeichnung).like(like))
    stmt = stmt.options(*_LOAD_OPTIONS).order_by(asc(Anlage.reihenfolge), asc(Anlage.bezeichnung))
    if limit is not None:
        stmt = stmt.limit(limit)
    return list((await db.execute(stmt)).scalars().all())


async def get_anlage(db: AsyncSession, mandant_id: UUID, anlage_id: UUID) -> Anlage:
    stmt = (
        select(Anlage)
        .where(
            Anlage.id == anlage_id,
            Anlage.mandant_id == mandant_id,
            Anlage.deleted_at.is_(None),
        )
        .options(*_LOAD_OPTIONS)
    )
    a = (await db.execute(stmt)).scalar_one_or_none()
    if a is None:
        raise AnlageNotFoundError(f"anlage {anlage_id} not found")
    return a


async def create_anlage(db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]) -> Anlage:
    await _validate_anlage_fks(db, mandant_id, payload)
    a = Anlage(mandant_id=mandant_id, **payload)
    db.add(a)
    await db.flush()
    return await get_anlage(db, mandant_id, a.id)


async def update_anlage(
    db: AsyncSession,
    mandant_id: UUID,
    anlage_id: UUID,
    updates: dict[str, Any],
) -> Anlage:
    a = await get_anlage(db, mandant_id, anlage_id)
    await _validate_anlage_fks(db, mandant_id, updates)
    for key, value in updates.items():
        if value is None and key == "bezeichnung":
            continue
        setattr(a, key, value)
    await db.flush()
    return await get_anlage(db, mandant_id, a.id)


async def soft_delete_anlage(db: AsyncSession, mandant_id: UUID, anlage_id: UUID) -> None:
    a = await get_anlage(db, mandant_id, anlage_id)
    a.deleted_at = datetime.now(UTC)
    await db.flush()
