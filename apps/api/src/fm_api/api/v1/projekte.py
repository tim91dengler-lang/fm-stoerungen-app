from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.projekt import ProjektCreate, ProjektRead, ProjektUpdate
from fm_api.schemas.ticket import UserRef
from fm_api.services import projekt_service
from fm_api.services.projekt_service import ProjektNotFoundError

router = APIRouter()


def _serialize(p: object, count: int) -> ProjektRead:
    from fm_api.models.projekt import Projekt

    if not isinstance(p, Projekt):
        raise TypeError(f"expected Projekt, got {type(p).__name__}")
    return ProjektRead.model_validate(
        {
            "id": p.id,
            "mandant_id": p.mandant_id,
            "name": p.name,
            "beschreibung": p.beschreibung,
            "objekt_id": p.objekt_id,
            "verantwortlich_user_id": p.verantwortlich_user_id,
            "start_am": p.start_am,
            "ende_am": p.ende_am,
            "status": p.status,
            "notizen": p.notizen,
            "verantwortlich": UserRef(id=p.verantwortlich.id, full_name=p.verantwortlich.full_name)
            if p.verantwortlich
            else None,
            "ticket_count": count,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
    )


@router.get("", response_model=list[ProjektRead])
async def list_projekte(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    include_deleted: bool = Query(default=False),
) -> list[ProjektRead]:
    items = await projekt_service.list_projekte(
        db,
        current.mandant_id,
        search=search,
        status_filter=status_filter,
        include_deleted=include_deleted,
    )
    return [_serialize(p, c) for p, c in items]


@router.get("/{projekt_id}", response_model=ProjektRead)
async def get_projekt(
    projekt_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> ProjektRead:
    try:
        p, count = await projekt_service.get_projekt(db, current.mandant_id, projekt_id)
    except ProjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize(p, count)


@router.post("", response_model=ProjektRead, status_code=status.HTTP_201_CREATED)
async def create_projekt(
    payload: ProjektCreate, db: AuditedDbSession, current: CurrentUserDep
) -> ProjektRead:
    p = await projekt_service.create_projekt(db, current.mandant_id, payload=payload.model_dump())
    return _serialize(p, 0)


@router.patch("/{projekt_id}", response_model=ProjektRead)
async def update_projekt(
    projekt_id: UUID,
    payload: ProjektUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> ProjektRead:
    try:
        p = await projekt_service.update_projekt(
            db,
            current.mandant_id,
            projekt_id,
            payload.model_dump(exclude_unset=True),
        )
        _, count = await projekt_service.get_projekt(db, current.mandant_id, projekt_id)
    except ProjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize(p, count)


@router.delete("/{projekt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_projekt(projekt_id: UUID, db: AuditedDbSession, current: CurrentUserDep) -> None:
    try:
        await projekt_service.soft_delete_projekt(db, current.mandant_id, projekt_id)
    except ProjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
