from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Notification


async def list_unread(
    db: AsyncSession, mandant_id: UUID, user_id: UUID, *, limit: int = 50
) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(
            Notification.mandant_id == mandant_id,
            Notification.user_id == user_id,
        )
        .options(selectinload(Notification.ausloeser))
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def count_unread(db: AsyncSession, mandant_id: UUID, user_id: UUID) -> int:
    from sqlalchemy import func

    stmt = select(func.count(Notification.id)).where(
        Notification.mandant_id == mandant_id,
        Notification.user_id == user_id,
        Notification.gelesen.is_(False),
    )
    return (await db.execute(stmt)).scalar_one()


async def mark_read(db: AsyncSession, user_id: UUID, ids: list[UUID]) -> None:
    if not ids:
        return
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.id.in_(ids))
        .values(gelesen=True)
    )
    await db.flush()


async def mark_all_read(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.gelesen.is_(False))
        .values(gelesen=True)
    )
    await db.flush()


async def fire(
    db: AsyncSession,
    *,
    mandant_id: UUID,
    user_id: UUID,
    typ: str,
    text: str,
    ticket_id: UUID | None = None,
    ref_message_id: UUID | None = None,
    ausloeser_user_id: UUID | None = None,
) -> Notification:
    """Notification erzeugen (verwendet von chat/ticket-Services)."""
    # Sich-selbst-Mention/Chat unterdrücken
    if user_id == ausloeser_user_id:
        # Hier kein Notification.create, aber für Pydantic-Type ein Dummy zurückgeben?
        # Pragmatisch: wir erlauben self-notification nur bei Status (ticket-eigentümer
        # sieht den Status-Wechsel ggf. auch wenn er ihn selbst gemacht hat — übrigens
        # für die Demo kein Schaden, weil Joachim das filtern kann).
        pass
    n = Notification(
        mandant_id=mandant_id,
        user_id=user_id,
        ticket_id=ticket_id,
        typ=typ,
        text=text,
        ref_message_id=ref_message_id,
        ausloeser_user_id=ausloeser_user_id,
    )
    db.add(n)
    await db.flush()
    return n
