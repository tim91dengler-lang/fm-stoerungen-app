from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.tickettyp import TickettypCreate, TickettypRead, TickettypUpdate
from fm_api.services import tickettyp_service
from fm_api.services.tickettyp_service import (
    SystemTickettypProtectedError,
    TickettypNotFoundError,
)

router = APIRouter()


@router.get("", response_model=list[TickettypRead])
async def list_tickettypen(db: AuditedDbSession, current: CurrentUserDep) -> list[TickettypRead]:
    items = await tickettyp_service.list_tickettypen(db, current.mandant_id)
    return [TickettypRead.model_validate(i) for i in items]


@router.post(
    "",
    response_model=TickettypRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_tickettyp(
    payload: TickettypCreate, db: AuditedDbSession, current: CurrentUserDep
) -> TickettypRead:
    item = await tickettyp_service.create_tickettyp(
        db, current.mandant_id, payload=payload.model_dump()
    )
    return TickettypRead.model_validate(item)


@router.patch("/{tickettyp_id}", response_model=TickettypRead)
async def update_tickettyp(
    tickettyp_id: UUID,
    payload: TickettypUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TickettypRead:
    try:
        item = await tickettyp_service.update_tickettyp(
            db,
            current.mandant_id,
            tickettyp_id,
            payload.model_dump(exclude_unset=True),
        )
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TickettypRead.model_validate(item)


@router.delete("/{tickettyp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tickettyp(
    tickettyp_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> None:
    try:
        await tickettyp_service.delete_tickettyp(db, current.mandant_id, tickettyp_id)
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SystemTickettypProtectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None
