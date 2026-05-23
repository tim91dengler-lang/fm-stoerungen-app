from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.common import PaginatedResponse
from fm_api.schemas.partner import PartnerCreate, PartnerRead, PartnerUpdate
from fm_api.services import partner_service
from fm_api.services.partner_service import PartnerNotFoundError

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[PartnerRead],
    summary="Geschäftspartner-Liste",
)
async def list_partner(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    typ: list[str] | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[PartnerRead]:
    items, total = await partner_service.list_partner(
        db,
        current.mandant_id,
        search=search,
        typ_filter=typ,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse[PartnerRead](
        items=[PartnerRead.model_validate(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=PartnerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Partner anlegen",
)
async def create_partner(
    payload: PartnerCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerRead:
    partner = await partner_service.create_partner(
        db, current.mandant_id, payload=payload.model_dump()
    )
    return PartnerRead.model_validate(partner)


@router.get(
    "/{partner_id}",
    response_model=PartnerRead,
    summary="Partner-Detail",
)
async def get_partner(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerRead:
    try:
        partner = await partner_service.get_partner(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerRead.model_validate(partner)


@router.patch(
    "/{partner_id}",
    response_model=PartnerRead,
    summary="Partner bearbeiten",
)
async def update_partner(
    partner_id: UUID,
    payload: PartnerUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerRead:
    try:
        partner = await partner_service.update_partner(
            db, partner_id, current.mandant_id, payload.model_dump(exclude_unset=True)
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerRead.model_validate(partner)


@router.delete(
    "/{partner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Partner soft-delete",
)
async def delete_partner(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await partner_service.soft_delete_partner(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
