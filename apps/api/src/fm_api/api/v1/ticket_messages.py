from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.ticket_message import TicketMessageCreate, TicketMessageRead
from fm_api.services import chat_service
from fm_api.services.chat_service import (
    MessageNotFoundError,
    TicketNotFoundError,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[TicketMessageRead],
    summary="Chat-Nachrichten zum Ticket",
)
async def list_messages(
    ticket_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[TicketMessageRead]:
    try:
        messages = await chat_service.list_messages(db, ticket_id, current.mandant_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [TicketMessageRead.model_validate(m) for m in messages]


@router.post(
    "",
    response_model=TicketMessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Chat-Nachricht senden",
)
async def create_message(
    ticket_id: UUID,
    payload: TicketMessageCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TicketMessageRead:
    try:
        message = await chat_service.create_message(
            db,
            ticket_id,
            current.mandant_id,
            current.user_id,
            text=payload.text,
            mentions=payload.mentions,
        )
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TicketMessageRead.model_validate(message)


@router.post(
    "/mark-read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Alle Nachrichten des Tickets als gelesen markieren",
)
async def mark_messages_read(
    ticket_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await chat_service.mark_read(db, ticket_id, current.mandant_id, current.user_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.delete(
    "/{message_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eigene Chat-Nachricht löschen (soft-delete)",
)
async def delete_message(
    ticket_id: UUID,
    message_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await chat_service.soft_delete_message(
            db, message_id, ticket_id, current.mandant_id, current.user_id
        )
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except MessageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None
