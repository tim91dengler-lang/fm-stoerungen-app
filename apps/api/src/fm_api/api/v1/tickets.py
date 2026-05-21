from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.models.ticket import TicketPrioritaet, TicketStatus
from fm_api.schemas.common import PaginatedResponse
from fm_api.schemas.ticket import TicketCreate, TicketRead, TicketUpdate
from fm_api.services import ticket_service
from fm_api.services.ticket_service import (
    AssigneeNotFoundError,
    InvalidStatusTransitionError,
    TicketNotFoundError,
)

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[TicketRead],
    summary="Tickets-Liste (Power-Layout-kompatibel)",
)
async def list_tickets(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    status_filter: list[TicketStatus] | None = Query(default=None, alias="status"),
    prioritaet_filter: list[TicketPrioritaet] | None = Query(default=None, alias="prioritaet"),
    zugewiesen_an_id: UUID | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[TicketRead]:
    tickets, total = await ticket_service.list_tickets(
        db,
        current.mandant_id,
        search=search,
        status_filter=status_filter,
        prioritaet_filter=prioritaet_filter,
        zugewiesen_an_id=zugewiesen_an_id,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse[TicketRead](
        items=[TicketRead.model_validate(t) for t in tickets],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=TicketRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ticket anlegen",
)
async def create_ticket(
    payload: TicketCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TicketRead:
    try:
        ticket = await ticket_service.create_ticket(
            db,
            current.mandant_id,
            current.user_id,
            titel=payload.titel,
            beschreibung=payload.beschreibung,
            prioritaet=payload.prioritaet,
            zugewiesen_an_id=payload.zugewiesen_an_id,
        )
    except AssigneeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TicketRead.model_validate(ticket)


@router.get(
    "/{ticket_id}",
    response_model=TicketRead,
    summary="Ticket-Detail",
)
async def get_ticket(
    ticket_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TicketRead:
    try:
        ticket = await ticket_service.get_ticket(db, ticket_id, current.mandant_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TicketRead.model_validate(ticket)


@router.patch(
    "/{ticket_id}",
    response_model=TicketRead,
    summary="Ticket bearbeiten",
)
async def update_ticket(
    ticket_id: UUID,
    payload: TicketUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TicketRead:
    updates = payload.model_dump(exclude_unset=True)
    try:
        ticket = await ticket_service.update_ticket(db, ticket_id, current.mandant_id, updates)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AssigneeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidStatusTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return TicketRead.model_validate(ticket)


@router.delete(
    "/{ticket_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Ticket soft-delete",
)
async def delete_ticket(
    ticket_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await ticket_service.soft_delete_ticket(db, ticket_id, current.mandant_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
