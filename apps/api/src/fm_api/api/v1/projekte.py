from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.common import PaginatedResponse
from fm_api.schemas.projekt import ProjektCreate, ProjektRead, ProjektUpdate
from fm_api.schemas.ticket import AuswahlWertRef, ObjektRef, TicketRead, UserRef
from fm_api.services import projekt_service
from fm_api.services.projekt_service import (
    ObjektNotFoundError,
    ProjektNotFoundError,
    UnknownAuswahlSlugError,
)

router = APIRouter()


def _serialize(p: object, count: int) -> ProjektRead:
    from fm_api.models.projekt import Projekt, ProjektObjektLink

    if not isinstance(p, Projekt):
        raise TypeError(f"expected Projekt, got {type(p).__name__}")

    objekte_refs: list[ObjektRef] = []
    for link in p.objekt_links:
        if not isinstance(link, ProjektObjektLink):
            continue
        objekt = link.objekt
        if objekt is None:
            continue
        objekte_refs.append(ObjektRef(id=objekt.id, name=objekt.name))

    return ProjektRead(
        id=p.id,
        mandant_id=p.mandant_id,
        name=p.name,
        beschreibung=p.beschreibung,
        projekttyp=AuswahlWertRef(
            id=p.projekttyp_wert.id,
            key=p.projekttyp_wert.key,
            label=p.projekttyp_wert.label,
            farbe=p.projekttyp_wert.farbe,
        ),
        status=AuswahlWertRef(
            id=p.status_wert.id,
            key=p.status_wert.key,
            label=p.status_wert.label,
            farbe=p.status_wert.farbe,
        ),
        verantwortlich=(
            UserRef(id=p.verantwortlich.id, full_name=p.verantwortlich.full_name)
            if p.verantwortlich is not None
            else None
        ),
        start_am=p.start_am,
        ende_am=p.ende_am,
        notizen=p.notizen,
        objekte=objekte_refs,
        ticket_count=count,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.get("", response_model=list[ProjektRead])
async def list_projekte(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    status_filter: list[str] | None = Query(default=None, alias="status"),
    projekttyp_filter: list[str] | None = Query(default=None, alias="projekttyp"),
    include_deleted: bool = Query(default=False),
) -> list[ProjektRead]:
    items = await projekt_service.list_projekte(
        db,
        current.mandant_id,
        search=search,
        status_filter=status_filter,
        projekttyp_filter=projekttyp_filter,
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
    try:
        p = await projekt_service.create_projekt(
            db,
            current.mandant_id,
            name=payload.name,
            beschreibung=payload.beschreibung,
            projekttyp_slug=payload.projekttyp_slug,
            status_slug=payload.status_slug,
            verantwortlich_user_id=payload.verantwortlich_user_id,
            start_am=payload.start_am,
            ende_am=payload.ende_am,
            notizen=payload.notizen,
            objekt_ids=payload.objekt_ids,
        )
    except UnknownAuswahlSlugError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except ObjektNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
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
    except UnknownAuswahlSlugError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except ObjektNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return _serialize(p, count)


@router.delete("/{projekt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_projekt(projekt_id: UUID, db: AuditedDbSession, current: CurrentUserDep) -> None:
    try:
        await projekt_service.soft_delete_projekt(db, current.mandant_id, projekt_id)
    except ProjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.get(
    "/{projekt_id}/tickets",
    response_model=PaginatedResponse[TicketRead],
    summary="Tickets dieses Projekts",
)
async def list_projekt_tickets(
    projekt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[TicketRead]:
    try:
        tickets, total = await projekt_service.list_tickets_for_projekt(
            db,
            current.mandant_id,
            projekt_id,
            include_deleted=include_deleted,
            limit=limit,
            offset=offset,
        )
    except ProjektNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PaginatedResponse[TicketRead](
        items=[TicketRead.from_orm_ticket(t) for t in tickets],
        total=total,
        limit=limit,
        offset=offset,
    )
