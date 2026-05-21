from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Ticket, User
from fm_api.models.ticket import TicketPrioritaet, TicketStatus


class TicketNotFoundError(Exception):
    pass


class AssigneeNotFoundError(Exception):
    pass


class InvalidStatusTransitionError(Exception):
    pass


# Status transitions are intentionally permissive in Slice 1.
# We block only the obvious mistakes; the workflow engine comes in Slice 2.
INVALID_TRANSITIONS: set[tuple[TicketStatus, TicketStatus]] = {
    (TicketStatus.GESCHLOSSEN, TicketStatus.NEU),
    (TicketStatus.GESCHLOSSEN, TicketStatus.ZUGEWIESEN),
    (TicketStatus.GESCHLOSSEN, TicketStatus.IN_ARBEIT),
}


async def _validate_assignee(
    db: AsyncSession,
    user_id: UUID,
    mandant_id: UUID,
) -> None:
    stmt = select(User.id).where(
        User.id == user_id,
        User.mandant_id == mandant_id,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise AssigneeNotFoundError(f"assignee {user_id} not found or inactive")


async def list_tickets(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    status_filter: list[TicketStatus] | None = None,
    prioritaet_filter: list[TicketPrioritaet] | None = None,
    zugewiesen_an_id: UUID | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Ticket], int]:
    base = select(Ticket).where(Ticket.mandant_id == mandant_id)
    if not include_deleted:
        base = base.where(Ticket.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        base = base.where(
            func.lower(Ticket.titel).like(like) | func.lower(Ticket.beschreibung).like(like)
        )
    if status_filter:
        base = base.where(Ticket.status.in_(status_filter))
    if prioritaet_filter:
        base = base.where(Ticket.prioritaet.in_(prioritaet_filter))
    if zugewiesen_an_id is not None:
        base = base.where(Ticket.zugewiesen_an_id == zugewiesen_an_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = (
        base.options(
            selectinload(Ticket.eroeffnet_von),
            selectinload(Ticket.zugewiesen_an),
        )
        .order_by(desc(Ticket.eroeffnet_am))
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(items_stmt)).scalars().unique().all()
    return list(items), total


async def get_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
) -> Ticket:
    stmt = (
        select(Ticket)
        .where(
            Ticket.id == ticket_id,
            Ticket.mandant_id == mandant_id,
            Ticket.deleted_at.is_(None),
        )
        .options(
            selectinload(Ticket.eroeffnet_von),
            selectinload(Ticket.zugewiesen_an),
        )
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if ticket is None:
        raise TicketNotFoundError(f"ticket {ticket_id} not found")
    return ticket


async def create_ticket(
    db: AsyncSession,
    mandant_id: UUID,
    eroeffnet_von_id: UUID,
    *,
    titel: str,
    beschreibung: str,
    prioritaet: TicketPrioritaet,
    zugewiesen_an_id: UUID | None = None,
) -> Ticket:
    now = datetime.now(UTC)
    initial_status = TicketStatus.NEU
    zugewiesen_am: datetime | None = None

    if zugewiesen_an_id is not None:
        await _validate_assignee(db, zugewiesen_an_id, mandant_id)
        initial_status = TicketStatus.ZUGEWIESEN
        zugewiesen_am = now

    ticket = Ticket(
        mandant_id=mandant_id,
        nummer=0,  # filled by Postgres trigger set_ticket_nummer()
        titel=titel,
        beschreibung=beschreibung,
        status=initial_status,
        prioritaet=prioritaet,
        eroeffnet_von_id=eroeffnet_von_id,
        zugewiesen_an_id=zugewiesen_an_id,
        eroeffnet_am=now,
        zugewiesen_am=zugewiesen_am,
    )
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket, ["eroeffnet_von", "zugewiesen_an"])
    return ticket


async def update_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],  # only keys the client explicitly set (model_dump(exclude_unset=True))
) -> Ticket:
    ticket = await get_ticket(db, ticket_id, mandant_id)
    now = datetime.now(UTC)

    if "titel" in updates:
        ticket.titel = updates["titel"]
    if "beschreibung" in updates:
        ticket.beschreibung = updates["beschreibung"]
    if "prioritaet" in updates:
        ticket.prioritaet = updates["prioritaet"]

    if "zugewiesen_an_id" in updates:
        new_assignee = updates["zugewiesen_an_id"]
        if new_assignee is not None:
            await _validate_assignee(db, new_assignee, mandant_id)
        ticket.zugewiesen_an_id = new_assignee
        if new_assignee is not None and ticket.zugewiesen_am is None:
            ticket.zugewiesen_am = now
            if ticket.status == TicketStatus.NEU:
                ticket.status = TicketStatus.ZUGEWIESEN

    if "status" in updates:
        new_status = updates["status"]
        if (ticket.status, new_status) in INVALID_TRANSITIONS:
            raise InvalidStatusTransitionError(
                f"cannot transition from {ticket.status} to {new_status}"
            )
        if new_status == TicketStatus.ERLEDIGT and ticket.erledigt_am is None:
            ticket.erledigt_am = now
        if new_status == TicketStatus.GESCHLOSSEN and ticket.geschlossen_am is None:
            ticket.geschlossen_am = now
        ticket.status = new_status

    await db.flush()
    await db.refresh(ticket, ["eroeffnet_von", "zugewiesen_an"])
    return ticket


async def soft_delete_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
) -> None:
    ticket = await get_ticket(db, ticket_id, mandant_id)
    ticket.deleted_at = datetime.now(UTC)
    await db.flush()
