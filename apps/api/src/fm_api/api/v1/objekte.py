from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.common import PaginatedResponse
from fm_api.schemas.objekt import (
    BeteiligterSummary,
    ObjektCreate,
    ObjektPartnerLinkRead,
    ObjektRead,
    ObjektUpdate,
)
from fm_api.services import objekt_service, objektstruktur_service
from fm_api.services.objekt_service import (
    InvalidPartnerLinkError,
    ObjektNotFoundError,
)

router = APIRouter()


def _serialize_objekt(
    o: object, beteiligte_summary: list[dict[str, Any]] | None = None
) -> ObjektRead:
    from fm_api.models.objekt import Objekt as ObjektModel

    if not isinstance(o, ObjektModel):
        raise TypeError(f"expected Objekt, got {type(o).__name__}")
    base = ObjektRead.model_validate(
        {
            "id": o.id,
            "mandant_id": o.mandant_id,
            "name": o.name,
            "adresse_id": o.adresse_id,
            "notiz": o.notiz,
            "gesperrt": o.gesperrt,
            "adresse": o.adresse,
            "created_at": o.created_at,
            "updated_at": o.updated_at,
            "partner_links": [],
        }
    )
    base.partner_links = [
        ObjektPartnerLinkRead(
            partner_id=link.partner_id,
            rolle=link.rolle.value,
            partner_name=link.partner.name,
        )
        for link in o.partner_links
    ]
    base.beteiligte_summary = [BeteiligterSummary(**b) for b in (beteiligte_summary or [])]
    return base


@router.get(
    "",
    response_model=PaginatedResponse[ObjektRead],
    summary="Objekte-Liste",
)
async def list_objekte(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    include_deleted: bool = Query(default=False),
    gesperrt_filter: str = Query(default="aktiv", pattern="^(aktiv|gesperrt|alle)$"),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[ObjektRead]:
    items, total = await objekt_service.list_objekte(
        db,
        current.mandant_id,
        search=search,
        include_deleted=include_deleted,
        gesperrt_filter=gesperrt_filter,
        limit=limit,
        offset=offset,
    )
    summary = await objektstruktur_service.summarize_struktur_beteiligte(
        db, current.mandant_id, [o.id for o in items]
    )
    return PaginatedResponse[ObjektRead](
        items=[_serialize_objekt(o, summary.get(o.id)) for o in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ObjektRead,
    status_code=status.HTTP_201_CREATED,
    summary="Objekt anlegen",
)
async def create_objekt(
    payload: ObjektCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> ObjektRead:
    try:
        objekt = await objekt_service.create_objekt(
            db, current.mandant_id, payload=payload.model_dump()
        )
    except InvalidPartnerLinkError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _serialize_objekt(objekt)


@router.get(
    "/{objekt_id}",
    response_model=ObjektRead,
    summary="Objekt-Detail",
)
async def get_objekt(
    objekt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> ObjektRead:
    try:
        objekt = await objekt_service.get_objekt(db, objekt_id, current.mandant_id)
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_objekt(objekt)


@router.patch(
    "/{objekt_id}",
    response_model=ObjektRead,
    summary="Objekt bearbeiten",
)
async def update_objekt(
    objekt_id: UUID,
    payload: ObjektUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> ObjektRead:
    try:
        objekt = await objekt_service.update_objekt(
            db, objekt_id, current.mandant_id, payload.model_dump(exclude_unset=True)
        )
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidPartnerLinkError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _serialize_objekt(objekt)


@router.delete(
    "/{objekt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Objekt soft-delete",
)
async def delete_objekt(
    objekt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await objekt_service.soft_delete_objekt(db, objekt_id, current.mandant_id)
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.post(
    "/{objekt_id}/sperren",
    response_model=ObjektRead,
    summary="Objekt sperren (Soft-Sperre, R6c-Konvention)",
)
async def sperren_objekt(
    objekt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> ObjektRead:
    try:
        objekt = await objekt_service.sperren_objekt(
            db, objekt_id, current.mandant_id, gesperrt=True
        )
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_objekt(objekt)


@router.post(
    "/{objekt_id}/entsperren",
    response_model=ObjektRead,
    summary="Objekt entsperren",
)
async def entsperren_objekt(
    objekt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> ObjektRead:
    try:
        objekt = await objekt_service.sperren_objekt(
            db, objekt_id, current.mandant_id, gesperrt=False
        )
    except ObjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize_objekt(objekt)
