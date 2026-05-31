from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Ticket, TicketMessage


class MessageNotFoundError(Exception):
    pass


class TicketNotFoundError(Exception):
    pass


async def _assert_ticket(db: AsyncSession, ticket_id: UUID, mandant_id: UUID) -> None:
    stmt = select(Ticket.id).where(
        Ticket.id == ticket_id,
        Ticket.mandant_id == mandant_id,
        Ticket.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise TicketNotFoundError(f"ticket {ticket_id} not found")


async def list_messages(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
) -> list[TicketMessage]:
    await _assert_ticket(db, ticket_id, mandant_id)
    stmt = (
        select(TicketMessage)
        .where(
            TicketMessage.ticket_id == ticket_id,
            TicketMessage.deleted_at.is_(None),
        )
        .options(selectinload(TicketMessage.autor))
        .order_by(TicketMessage.created_at)
    )
    return list((await db.execute(stmt)).scalars().all())


async def create_message(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
    autor_user_id: UUID,
    *,
    text: str,
    mentions: list[str],
) -> TicketMessage:
    from fm_api.services import notification_service as _notif

    await _assert_ticket(db, ticket_id, mandant_id)
    message = TicketMessage(
        ticket_id=ticket_id,
        autor_user_id=autor_user_id,
        text=text,
        mentions=mentions,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message, ["autor"])

    # Notifications für jeden erwähnten User
    for mention_id in mentions:
        try:
            uid = UUID(mention_id)
        except (TypeError, ValueError):
            continue
        if uid == autor_user_id:
            continue
        await _notif.fire(
            db,
            mandant_id=mandant_id,
            user_id=uid,
            typ="mention",
            text=text[:200],
            ticket_id=ticket_id,
            ref_message_id=message.id,
            ausloeser_user_id=autor_user_id,
        )

    # Notification an den zugewiesenen Bearbeiter (sofern nicht Autor selbst
    # und nicht bereits als Mention adressiert)
    ticket_owner_stmt = select(Ticket.zugewiesen_an_id).where(Ticket.id == ticket_id)
    owner_id = (await db.execute(ticket_owner_stmt)).scalar_one_or_none()
    mention_set = {str(m) for m in mentions if m}
    if owner_id is not None and owner_id != autor_user_id and str(owner_id) not in mention_set:
        await _notif.fire(
            db,
            mandant_id=mandant_id,
            user_id=owner_id,
            typ="chat",
            text=text[:200],
            ticket_id=ticket_id,
            ref_message_id=message.id,
            ausloeser_user_id=autor_user_id,
        )

    return message


async def soft_delete_message(
    db: AsyncSession,
    message_id: UUID,
    ticket_id: UUID,
    mandant_id: UUID,
    actor_user_id: UUID,
) -> None:
    await _assert_ticket(db, ticket_id, mandant_id)
    stmt = (
        select(TicketMessage)
        .where(
            TicketMessage.id == message_id,
            TicketMessage.ticket_id == ticket_id,
            TicketMessage.deleted_at.is_(None),
        )
        .options(selectinload(TicketMessage.autor))
    )
    message = (await db.execute(stmt)).scalar_one_or_none()
    if message is None:
        raise MessageNotFoundError(f"message {message_id} not found")
    # nur der Autor darf seine eigene Nachricht löschen (Slice 2 — Slice 3: Admins
    # können fremde Nachrichten löschen)
    if message.autor_user_id != actor_user_id:
        raise PermissionError("only the author can delete this message")
    message.deleted_at = datetime.now(UTC)
    await db.flush()


async def mark_read(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
    user_id: UUID,
) -> None:
    """Markiert alle fremden Nachrichten des Tickets als von ``user_id`` gelesen
    (Read-Receipts, Konzept §5.6). Eigene Nachrichten werden übersprungen."""
    await _assert_ticket(db, ticket_id, mandant_id)
    stmt = select(TicketMessage).where(
        TicketMessage.ticket_id == ticket_id,
        TicketMessage.deleted_at.is_(None),
    )
    uid = str(user_id)
    for message in (await db.execute(stmt)).scalars().all():
        if message.autor_user_id == user_id or uid in message.gelesen_von:
            continue
        # Neue Liste zuweisen, damit SQLAlchemy die JSONB-Änderung erkennt.
        message.gelesen_von = [*message.gelesen_von, uid]
    await db.flush()
