"""Service-Layer für die vierstufige Objektstruktur.

Pragmatisch alles in einem Modul, weil eng gekoppelt (Tree-API liefert
Haus → Stockwerk → Einheit zusammen).
"""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.core.config import get_settings
from fm_api.models import (
    EinheitEigentuemer,
    EinheitMieter,
    Haus,
    HausEigentuemer,
    HausMieter,
    Objekt,
    ObjektStockwerk,
    StockwerkAusrichtung,
    StockwerkEigentuemer,
    StockwerkEinheit,
    StockwerkMieter,
)
from fm_api.services.photo_service import _ensure_dir, _upload_root  # reuse


class ObjektNotFoundError(Exception):
    pass


class HausNotFoundError(Exception):
    pass


class StockwerkNotFoundError(Exception):
    pass


class EinheitNotFoundError(Exception):
    pass


class UnsupportedMimeError(Exception):
    pass


_ALLOWED_GRUNDRISS_MIME = {"image/png", "image/jpeg", "image/webp", "application/pdf"}
_MIME_TO_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


# -------- Helpers ---------------------------------------------------------


async def _assert_objekt(db: AsyncSession, objekt_id: UUID, mandant_id: UUID) -> None:
    stmt = select(Objekt.id).where(
        Objekt.id == objekt_id,
        Objekt.mandant_id == mandant_id,
        Objekt.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise ObjektNotFoundError(f"objekt {objekt_id} not found")


# -------- Haus ------------------------------------------------------------


async def list_haus(db: AsyncSession, mandant_id: UUID, objekt_id: UUID) -> list[Haus]:
    await _assert_objekt(db, objekt_id, mandant_id)
    stmt = (
        select(Haus)
        .where(
            Haus.mandant_id == mandant_id,
            Haus.objekt_id == objekt_id,
            Haus.deleted_at.is_(None),
        )
        .options(
            selectinload(Haus.adresse),
            selectinload(Haus.stockwerke)
            .selectinload(ObjektStockwerk.einheiten)
            .options(
                selectinload(StockwerkEinheit.eigentuemer_links).selectinload(
                    EinheitEigentuemer.partner
                ),
                selectinload(StockwerkEinheit.mieter_links).selectinload(EinheitMieter.partner),
            ),
            selectinload(Haus.stockwerke)
            .selectinload(ObjektStockwerk.eigentuemer_links)
            .selectinload(StockwerkEigentuemer.partner),
            selectinload(Haus.stockwerke)
            .selectinload(ObjektStockwerk.mieter_links)
            .selectinload(StockwerkMieter.partner),
            selectinload(Haus.eigentuemer_links).selectinload(HausEigentuemer.partner),
            selectinload(Haus.mieter_links).selectinload(HausMieter.partner),
        )
        .order_by(Haus.reihenfolge, Haus.bezeichnung)
    )
    return list((await db.execute(stmt)).scalars().unique().all())


async def get_haus(db: AsyncSession, mandant_id: UUID, haus_id: UUID) -> Haus:
    stmt = (
        select(Haus)
        .where(
            Haus.id == haus_id,
            Haus.mandant_id == mandant_id,
            Haus.deleted_at.is_(None),
        )
        .options(
            selectinload(Haus.adresse),
            selectinload(Haus.stockwerke)
            .selectinload(ObjektStockwerk.einheiten)
            .options(
                selectinload(StockwerkEinheit.eigentuemer_links).selectinload(
                    EinheitEigentuemer.partner
                ),
                selectinload(StockwerkEinheit.mieter_links).selectinload(EinheitMieter.partner),
            ),
            selectinload(Haus.stockwerke)
            .selectinload(ObjektStockwerk.eigentuemer_links)
            .selectinload(StockwerkEigentuemer.partner),
            selectinload(Haus.stockwerke)
            .selectinload(ObjektStockwerk.mieter_links)
            .selectinload(StockwerkMieter.partner),
            selectinload(Haus.eigentuemer_links).selectinload(HausEigentuemer.partner),
            selectinload(Haus.mieter_links).selectinload(HausMieter.partner),
        )
    )
    haus = (await db.execute(stmt)).scalar_one_or_none()
    if haus is None:
        raise HausNotFoundError(f"haus {haus_id} not found")
    return haus


async def create_haus(
    db: AsyncSession,
    mandant_id: UUID,
    objekt_id: UUID,
    *,
    payload: dict[str, Any],
) -> Haus:
    await _assert_objekt(db, objekt_id, mandant_id)
    eigentuemer_ids: list[UUID] = payload.pop("eigentuemer_ids", []) or []
    mieter_ids: list[UUID] = payload.pop("mieter_ids", []) or []
    haus = Haus(mandant_id=mandant_id, objekt_id=objekt_id, **payload)
    db.add(haus)
    await db.flush()
    if eigentuemer_ids:
        await db.execute(
            insert(HausEigentuemer),
            [{"haus_id": haus.id, "partner_id": pid} for pid in eigentuemer_ids],
        )
    if mieter_ids:
        await db.execute(
            insert(HausMieter),
            [{"haus_id": haus.id, "partner_id": pid} for pid in mieter_ids],
        )
    await db.flush()
    return await get_haus(db, mandant_id, haus.id)


async def update_haus(
    db: AsyncSession,
    mandant_id: UUID,
    haus_id: UUID,
    updates: dict[str, Any],
) -> Haus:
    haus = await get_haus(db, mandant_id, haus_id)
    new_eigentuemer = updates.pop("eigentuemer_ids", None)
    new_mieter = updates.pop("mieter_ids", None)
    for key, value in updates.items():
        if value is None and key in ("bezeichnung",):
            continue
        setattr(haus, key, value)
    if new_eigentuemer is not None:
        await db.execute(delete(HausEigentuemer).where(HausEigentuemer.haus_id == haus.id))
        await db.flush()
        if new_eigentuemer:
            await db.execute(
                insert(HausEigentuemer),
                [{"haus_id": haus.id, "partner_id": pid} for pid in new_eigentuemer],
            )
    if new_mieter is not None:
        await db.execute(delete(HausMieter).where(HausMieter.haus_id == haus.id))
        await db.flush()
        if new_mieter:
            await db.execute(
                insert(HausMieter),
                [{"haus_id": haus.id, "partner_id": pid} for pid in new_mieter],
            )
    await db.flush()
    return await get_haus(db, mandant_id, haus_id)


async def delete_haus(db: AsyncSession, mandant_id: UUID, haus_id: UUID) -> None:
    haus = await get_haus(db, mandant_id, haus_id)
    from datetime import UTC, datetime

    haus.deleted_at = datetime.now(UTC)
    await db.flush()


# -------- Stockwerk -------------------------------------------------------


async def _assert_haus(db: AsyncSession, mandant_id: UUID, haus_id: UUID) -> None:
    stmt = select(Haus.id).where(
        Haus.id == haus_id,
        Haus.mandant_id == mandant_id,
        Haus.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise HausNotFoundError(f"haus {haus_id} not found")


async def get_stockwerk(db: AsyncSession, mandant_id: UUID, stockwerk_id: UUID) -> ObjektStockwerk:
    stmt = (
        select(ObjektStockwerk)
        .where(
            ObjektStockwerk.id == stockwerk_id,
            ObjektStockwerk.mandant_id == mandant_id,
            ObjektStockwerk.deleted_at.is_(None),
        )
        .options(
            selectinload(ObjektStockwerk.eigentuemer_links).selectinload(
                StockwerkEigentuemer.partner
            ),
            selectinload(ObjektStockwerk.einheiten).options(
                selectinload(StockwerkEinheit.eigentuemer_links).selectinload(
                    EinheitEigentuemer.partner
                ),
                selectinload(StockwerkEinheit.mieter_links).selectinload(EinheitMieter.partner),
            ),
            selectinload(ObjektStockwerk.mieter_links).selectinload(StockwerkMieter.partner),
        )
    )
    sw = (await db.execute(stmt)).scalar_one_or_none()
    if sw is None:
        raise StockwerkNotFoundError(f"stockwerk {stockwerk_id} not found")
    return sw


async def create_stockwerk(
    db: AsyncSession,
    mandant_id: UUID,
    haus_id: UUID,
    *,
    payload: dict[str, Any],
) -> ObjektStockwerk:
    await _assert_haus(db, mandant_id, haus_id)
    eigentuemer_ids: list[UUID] = payload.pop("eigentuemer_ids", []) or []
    mieter_ids: list[UUID] = payload.pop("mieter_ids", []) or []
    ausr_str = payload.pop("ausrichtung", None)
    sw = ObjektStockwerk(
        mandant_id=mandant_id,
        haus_id=haus_id,
        ausrichtung=StockwerkAusrichtung(ausr_str) if ausr_str else None,
        **payload,
    )
    db.add(sw)
    await db.flush()
    if eigentuemer_ids:
        await db.execute(
            insert(StockwerkEigentuemer),
            [{"stockwerk_id": sw.id, "partner_id": pid} for pid in eigentuemer_ids],
        )
    if mieter_ids:
        await db.execute(
            insert(StockwerkMieter),
            [{"stockwerk_id": sw.id, "partner_id": pid} for pid in mieter_ids],
        )
    await db.flush()
    return await get_stockwerk(db, mandant_id, sw.id)


async def update_stockwerk(
    db: AsyncSession,
    mandant_id: UUID,
    stockwerk_id: UUID,
    updates: dict[str, Any],
) -> ObjektStockwerk:
    sw = await get_stockwerk(db, mandant_id, stockwerk_id)
    new_eigentuemer = updates.pop("eigentuemer_ids", None)
    new_mieter = updates.pop("mieter_ids", None)
    ausr_str = updates.pop("ausrichtung", "__unset__")

    for key, value in updates.items():
        if value is None and key in ("bezeichnung",):
            continue
        setattr(sw, key, value)
    if ausr_str != "__unset__":
        sw.ausrichtung = StockwerkAusrichtung(ausr_str) if ausr_str else None

    if new_eigentuemer is not None:
        await db.execute(
            delete(StockwerkEigentuemer).where(StockwerkEigentuemer.stockwerk_id == sw.id)
        )
        await db.flush()
        if new_eigentuemer:
            await db.execute(
                insert(StockwerkEigentuemer),
                [{"stockwerk_id": sw.id, "partner_id": pid} for pid in new_eigentuemer],
            )
    if new_mieter is not None:
        await db.execute(delete(StockwerkMieter).where(StockwerkMieter.stockwerk_id == sw.id))
        await db.flush()
        if new_mieter:
            await db.execute(
                insert(StockwerkMieter),
                [{"stockwerk_id": sw.id, "partner_id": pid} for pid in new_mieter],
            )

    await db.flush()
    return await get_stockwerk(db, mandant_id, stockwerk_id)


async def delete_stockwerk(db: AsyncSession, mandant_id: UUID, stockwerk_id: UUID) -> None:
    sw = await get_stockwerk(db, mandant_id, stockwerk_id)
    from datetime import UTC, datetime

    sw.deleted_at = datetime.now(UTC)
    await db.flush()


async def store_grundriss(
    db: AsyncSession,
    mandant_id: UUID,
    stockwerk_id: UUID,
    *,
    filename: str,
    mime_type: str,
    content: bytes,
) -> ObjektStockwerk:
    if mime_type not in _ALLOWED_GRUNDRISS_MIME:
        raise UnsupportedMimeError(f"grundriss mime '{mime_type}' not supported (PNG/JPG/WEBP/PDF)")
    settings = get_settings()
    if len(content) > settings.upload_max_bytes:
        raise UnsupportedMimeError(
            f"grundriss too large: {len(content)} bytes (max {settings.upload_max_bytes})"
        )
    sw = await get_stockwerk(db, mandant_id, stockwerk_id)
    file_id = uuid4()
    ext = _MIME_TO_EXT.get(mime_type, ".bin")
    rel_path = f"grundrisse/{stockwerk_id}/{file_id}{ext}"
    abs_path = _upload_root() / rel_path
    _ensure_dir(abs_path.parent)
    abs_path.write_bytes(content)
    sw.grundriss_storage_path = rel_path
    sw.grundriss_mime = mime_type
    await db.flush()
    return await get_stockwerk(db, mandant_id, stockwerk_id)


def read_grundriss_bytes(stockwerk: ObjektStockwerk) -> bytes:
    if not stockwerk.grundriss_storage_path:
        raise FileNotFoundError("no grundriss for this stockwerk")
    abs_path = _upload_root() / stockwerk.grundriss_storage_path
    return abs_path.read_bytes()


async def delete_grundriss(
    db: AsyncSession,
    mandant_id: UUID,
    stockwerk_id: UUID,
) -> ObjektStockwerk:
    """Remove the grundriss file from disk and clear the DB-fields.
    Idempotent: no-op when no grundriss is set.
    """
    sw = await get_stockwerk(db, mandant_id, stockwerk_id)
    if sw.grundriss_storage_path:
        abs_path = _upload_root() / sw.grundriss_storage_path
        try:
            abs_path.unlink(missing_ok=True)
        except OSError:
            # Disk-failure ist nicht fatal — DB-Felder werden trotzdem geleert,
            # damit der Eintrag im UI verschwindet und neu hochgeladen werden kann.
            pass
        sw.grundriss_storage_path = None
        sw.grundriss_mime = None
        await db.flush()
    return await get_stockwerk(db, mandant_id, stockwerk_id)


# -------- Einheit ---------------------------------------------------------


async def _assert_stockwerk(db: AsyncSession, mandant_id: UUID, stockwerk_id: UUID) -> None:
    stmt = select(ObjektStockwerk.id).where(
        ObjektStockwerk.id == stockwerk_id,
        ObjektStockwerk.mandant_id == mandant_id,
        ObjektStockwerk.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise StockwerkNotFoundError(f"stockwerk {stockwerk_id} not found")


async def get_einheit(db: AsyncSession, mandant_id: UUID, einheit_id: UUID) -> StockwerkEinheit:
    stmt = (
        select(StockwerkEinheit)
        .where(
            StockwerkEinheit.id == einheit_id,
            StockwerkEinheit.mandant_id == mandant_id,
            StockwerkEinheit.deleted_at.is_(None),
        )
        .options(
            selectinload(StockwerkEinheit.eigentuemer_links).selectinload(
                EinheitEigentuemer.partner
            ),
            selectinload(StockwerkEinheit.mieter_links).selectinload(EinheitMieter.partner),
        )
    )
    e = (await db.execute(stmt)).scalar_one_or_none()
    if e is None:
        raise EinheitNotFoundError(f"einheit {einheit_id} not found")
    return e


async def create_einheit(
    db: AsyncSession,
    mandant_id: UUID,
    stockwerk_id: UUID,
    *,
    payload: dict[str, Any],
) -> StockwerkEinheit:
    await _assert_stockwerk(db, mandant_id, stockwerk_id)
    eigentuemer_ids: list[UUID] = payload.pop("eigentuemer_ids", []) or []
    mieter_ids: list[UUID] = payload.pop("mieter_ids", []) or []
    e = StockwerkEinheit(mandant_id=mandant_id, stockwerk_id=stockwerk_id, **payload)
    db.add(e)
    await db.flush()
    if eigentuemer_ids:
        await db.execute(
            insert(EinheitEigentuemer),
            [{"einheit_id": e.id, "partner_id": pid} for pid in eigentuemer_ids],
        )
    if mieter_ids:
        await db.execute(
            insert(EinheitMieter),
            [{"einheit_id": e.id, "partner_id": pid} for pid in mieter_ids],
        )
    await db.flush()
    return await get_einheit(db, mandant_id, e.id)


async def update_einheit(
    db: AsyncSession,
    mandant_id: UUID,
    einheit_id: UUID,
    updates: dict[str, Any],
) -> StockwerkEinheit:
    e = await get_einheit(db, mandant_id, einheit_id)
    new_eigentuemer = updates.pop("eigentuemer_ids", None)
    new_mieter = updates.pop("mieter_ids", None)
    for key, value in updates.items():
        if value is None and key in ("bezeichnung",):
            continue
        setattr(e, key, value)
    if new_eigentuemer is not None:
        await db.execute(delete(EinheitEigentuemer).where(EinheitEigentuemer.einheit_id == e.id))
        await db.flush()
        if new_eigentuemer:
            await db.execute(
                insert(EinheitEigentuemer),
                [{"einheit_id": e.id, "partner_id": pid} for pid in new_eigentuemer],
            )
    if new_mieter is not None:
        await db.execute(delete(EinheitMieter).where(EinheitMieter.einheit_id == e.id))
        await db.flush()
        if new_mieter:
            await db.execute(
                insert(EinheitMieter),
                [{"einheit_id": e.id, "partner_id": pid} for pid in new_mieter],
            )
    await db.flush()
    return await get_einheit(db, mandant_id, einheit_id)


async def delete_einheit(db: AsyncSession, mandant_id: UUID, einheit_id: UUID) -> None:
    e = await get_einheit(db, mandant_id, einheit_id)
    from datetime import UTC, datetime

    e.deleted_at = datetime.now(UTC)
    await db.flush()
