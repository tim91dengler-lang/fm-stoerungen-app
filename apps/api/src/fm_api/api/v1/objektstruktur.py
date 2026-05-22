"""API für die vierstufige Objektstruktur (Haus → Stockwerk → Einheit)."""

from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.objektstruktur import (
    EinheitCreate,
    EinheitRead,
    EinheitUpdate,
    HausCreate,
    HausRead,
    HausUpdate,
    PartnerMini,
    StockwerkCreate,
    StockwerkRead,
    StockwerkUpdate,
)
from fm_api.services import objektstruktur_service
from fm_api.services.objektstruktur_service import (
    EinheitNotFoundError,
    HausNotFoundError,
    ObjektNotFoundError,
    StockwerkNotFoundError,
    UnsupportedMimeError,
)

router = APIRouter()


def _serialize_haus(h: object) -> HausRead:
    from fm_api.models.objektstruktur import Haus

    if not isinstance(h, Haus):
        raise TypeError(f"expected Haus, got {type(h).__name__}")
    return HausRead.model_validate(
        {
            "id": h.id,
            "objekt_id": h.objekt_id,
            "bezeichnung": h.bezeichnung,
            "notiz": h.notiz,
            "reihenfolge": h.reihenfolge,
            "adresse": h.adresse,
            "created_at": h.created_at,
            "updated_at": h.updated_at,
            "stockwerke": [_serialize_stockwerk(s) for s in h.stockwerke],
        }
    )


def _serialize_stockwerk(s: object) -> StockwerkRead:
    from fm_api.models.objektstruktur import ObjektStockwerk

    if not isinstance(s, ObjektStockwerk):
        raise TypeError(f"expected ObjektStockwerk, got {type(s).__name__}")
    return StockwerkRead.model_validate(
        {
            "id": s.id,
            "haus_id": s.haus_id,
            "bezeichnung": s.bezeichnung,
            "ausrichtung": s.ausrichtung.value if s.ausrichtung else None,
            "reihenfolge": s.reihenfolge,
            "has_grundriss": s.grundriss_storage_path is not None,
            "grundriss_mime": s.grundriss_mime,
            "eigentuemer": PartnerMini(id=s.eigentuemer.id, name=s.eigentuemer.name)
            if s.eigentuemer
            else None,
            "mieter": [PartnerMini(id=m.partner.id, name=m.partner.name) for m in s.mieter_links],
            "einheiten": [_serialize_einheit(e) for e in s.einheiten],
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }
    )


def _serialize_einheit(e: object) -> EinheitRead:
    from fm_api.models.objektstruktur import StockwerkEinheit

    if not isinstance(e, StockwerkEinheit):
        raise TypeError(f"expected StockwerkEinheit, got {type(e).__name__}")
    return EinheitRead.model_validate(
        {
            "id": e.id,
            "stockwerk_id": e.stockwerk_id,
            "bezeichnung": e.bezeichnung,
            "groesse_qm": e.groesse_qm,
            "reihenfolge": e.reihenfolge,
            "eigentuemer": PartnerMini(id=e.eigentuemer.id, name=e.eigentuemer.name)
            if e.eigentuemer
            else None,
            "mieter": [PartnerMini(id=m.partner.id, name=m.partner.name) for m in e.mieter_links],
            "created_at": e.created_at,
            "updated_at": e.updated_at,
        }
    )


# -------- Tree-Endpoint pro Objekt -----------------------------------------


@router.get(
    "/objekte/{objekt_id}/haus",
    response_model=list[HausRead],
    summary="Vollständiger Haus-Tree zum Objekt (mit Stockwerken + Einheiten + Mieter)",
)
async def list_haus_for_objekt(
    objekt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[HausRead]:
    try:
        items = await objektstruktur_service.list_haus(db, current.mandant_id, objekt_id)
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_serialize_haus(h) for h in items]


# -------- Haus -------------------------------------------------------------


@router.post(
    "/objekte/{objekt_id}/haus",
    response_model=HausRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_haus(
    objekt_id: UUID,
    payload: HausCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> HausRead:
    try:
        h = await objektstruktur_service.create_haus(
            db, current.mandant_id, objekt_id, payload=payload.model_dump()
        )
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_haus(h)


@router.patch("/haus/{haus_id}", response_model=HausRead)
async def update_haus(
    haus_id: UUID,
    payload: HausUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> HausRead:
    try:
        h = await objektstruktur_service.update_haus(
            db, current.mandant_id, haus_id, payload.model_dump(exclude_unset=True)
        )
    except HausNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_haus(h)


@router.delete("/haus/{haus_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_haus(
    haus_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await objektstruktur_service.delete_haus(db, current.mandant_id, haus_id)
    except HausNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


# -------- Stockwerk --------------------------------------------------------


@router.post(
    "/haus/{haus_id}/stockwerke",
    response_model=StockwerkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_stockwerk(
    haus_id: UUID,
    payload: StockwerkCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> StockwerkRead:
    try:
        s = await objektstruktur_service.create_stockwerk(
            db, current.mandant_id, haus_id, payload=payload.model_dump()
        )
    except HausNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_stockwerk(s)


@router.patch("/stockwerke/{stockwerk_id}", response_model=StockwerkRead)
async def update_stockwerk(
    stockwerk_id: UUID,
    payload: StockwerkUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> StockwerkRead:
    try:
        s = await objektstruktur_service.update_stockwerk(
            db,
            current.mandant_id,
            stockwerk_id,
            payload.model_dump(exclude_unset=True),
        )
    except StockwerkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_stockwerk(s)


@router.delete("/stockwerke/{stockwerk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stockwerk(
    stockwerk_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await objektstruktur_service.delete_stockwerk(db, current.mandant_id, stockwerk_id)
    except StockwerkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.post(
    "/stockwerke/{stockwerk_id}/grundriss",
    response_model=StockwerkRead,
    summary="Grundriss hochladen (PNG/JPG/WEBP/PDF, max 10 MB)",
)
async def upload_grundriss(
    stockwerk_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
    file: UploadFile = File(...),
) -> StockwerkRead:
    content = await file.read()
    try:
        s = await objektstruktur_service.store_grundriss(
            db,
            current.mandant_id,
            stockwerk_id,
            filename=file.filename or "grundriss",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
        )
    except StockwerkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedMimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)
        ) from exc
    return _serialize_stockwerk(s)


@router.get(
    "/stockwerke/{stockwerk_id}/grundriss/file",
    summary="Grundriss-Datei streamen",
)
async def stream_grundriss(
    stockwerk_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> Response:
    try:
        sw = await objektstruktur_service.get_stockwerk(db, current.mandant_id, stockwerk_id)
    except StockwerkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if not sw.grundriss_storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="kein Grundriss")
    content = objektstruktur_service.read_grundriss_bytes(sw)
    return Response(
        content=content,
        media_type=sw.grundriss_mime or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=3600"},
    )


# -------- Einheit ---------------------------------------------------------


@router.post(
    "/stockwerke/{stockwerk_id}/einheiten",
    response_model=EinheitRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_einheit(
    stockwerk_id: UUID,
    payload: EinheitCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> EinheitRead:
    try:
        e = await objektstruktur_service.create_einheit(
            db, current.mandant_id, stockwerk_id, payload=payload.model_dump()
        )
    except StockwerkNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_einheit(e)


@router.patch("/einheiten/{einheit_id}", response_model=EinheitRead)
async def update_einheit(
    einheit_id: UUID,
    payload: EinheitUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> EinheitRead:
    try:
        e = await objektstruktur_service.update_einheit(
            db,
            current.mandant_id,
            einheit_id,
            payload.model_dump(exclude_unset=True),
        )
    except EinheitNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_einheit(e)


@router.delete("/einheiten/{einheit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_einheit(
    einheit_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await objektstruktur_service.delete_einheit(db, current.mandant_id, einheit_id)
    except EinheitNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
