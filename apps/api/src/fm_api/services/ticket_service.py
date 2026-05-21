from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import (
    Auswahlliste,
    AuswahllistenWert,
    GeschaeftsPartner,
    Objekt,
    Ticket,
    User,
)
from fm_api.models.ticket import TicketStatusSlug
from fm_api.services.auswahlliste_service import (
    AuswahllistenWertNotFoundError,
    get_wert_by_id,
    get_wert_by_key,
)


class TicketNotFoundError(Exception):
    pass


class AssigneeNotFoundError(Exception):
    pass


class InvalidStatusTransitionError(Exception):
    pass


class ObjektNotFoundError(Exception):
    pass


class PartnerNotFoundError(Exception):
    pass


class UnknownAuswahlSlugError(Exception):
    pass


LISTE_KEY_STATUS = "ticket_status"
LISTE_KEY_PRIORITAET = "ticket_prioritaet"
LISTE_KEY_KATEGORIE = "ticket_kategorie"

# Status-Workflow-Regeln (slug-basiert, ADR 0004).
# In Slice 2 bewusst permissiv: nur „erledigt → nicht-erledigt" wird blockiert,
# damit das Wiedereröffnen ein expliziter Re-Open-Flow in Slice 3 wird.
INVALID_TRANSITIONS: set[tuple[str, str]] = {
    (TicketStatusSlug.ERLEDIGT.value, TicketStatusSlug.NEU.value),
    (TicketStatusSlug.ERLEDIGT.value, TicketStatusSlug.PRUEFUNG.value),
    (TicketStatusSlug.ERLEDIGT.value, TicketStatusSlug.BEARBEITUNG.value),
    (TicketStatusSlug.ERLEDIGT.value, TicketStatusSlug.WARTET.value),
}

_TICKET_LOAD_OPTIONS = (
    selectinload(Ticket.eroeffnet_von),
    selectinload(Ticket.zugewiesen_an),
    selectinload(Ticket.status_wert),
    selectinload(Ticket.prioritaet_wert),
    selectinload(Ticket.kategorie_wert),
    selectinload(Ticket.objekt),
    selectinload(Ticket.partner),
)


async def _validate_assignee(db: AsyncSession, user_id: UUID, mandant_id: UUID) -> None:
    stmt = select(User.id).where(
        User.id == user_id,
        User.mandant_id == mandant_id,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise AssigneeNotFoundError(f"assignee {user_id} not found or inactive")


async def _validate_objekt(db: AsyncSession, objekt_id: UUID, mandant_id: UUID) -> None:
    stmt = select(Objekt.id).where(
        Objekt.id == objekt_id,
        Objekt.mandant_id == mandant_id,
        Objekt.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise ObjektNotFoundError(f"objekt {objekt_id} not found")


async def _validate_partner(db: AsyncSession, partner_id: UUID, mandant_id: UUID) -> None:
    stmt = select(GeschaeftsPartner.id).where(
        GeschaeftsPartner.id == partner_id,
        GeschaeftsPartner.mandant_id == mandant_id,
        GeschaeftsPartner.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise PartnerNotFoundError(f"partner {partner_id} not found")


async def _resolve_slug(
    db: AsyncSession, mandant_id: UUID, liste_key: str, slug: str
) -> AuswahllistenWert:
    try:
        return await get_wert_by_key(db, mandant_id, liste_key, slug)
    except AuswahllistenWertNotFoundError as exc:
        raise UnknownAuswahlSlugError(
            f"slug '{slug}' not configured in liste '{liste_key}'"
        ) from exc


async def list_tickets(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    status_filter: list[str] | None = None,
    prioritaet_filter: list[str] | None = None,
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
        status_ids_subq = (
            select(AuswahllistenWert.id)
            .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
            .where(
                Auswahlliste.mandant_id == mandant_id,
                Auswahlliste.key == LISTE_KEY_STATUS,
                AuswahllistenWert.key.in_([s.lower() for s in status_filter]),
            )
            .scalar_subquery()
        )
        base = base.where(Ticket.status_id.in_(status_ids_subq))

    if prioritaet_filter:
        prio_ids_subq = (
            select(AuswahllistenWert.id)
            .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
            .where(
                Auswahlliste.mandant_id == mandant_id,
                Auswahlliste.key == LISTE_KEY_PRIORITAET,
                AuswahllistenWert.key.in_([s.lower() for s in prioritaet_filter]),
            )
            .scalar_subquery()
        )
        base = base.where(Ticket.prioritaet_id.in_(prio_ids_subq))

    if zugewiesen_an_id is not None:
        base = base.where(Ticket.zugewiesen_an_id == zugewiesen_an_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = (
        base.options(*_TICKET_LOAD_OPTIONS)
        .order_by(desc(Ticket.eroeffnet_am))
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(items_stmt)).scalars().unique().all()
    return list(items), total


async def get_ticket(db: AsyncSession, ticket_id: UUID, mandant_id: UUID) -> Ticket:
    stmt = (
        select(Ticket)
        .where(
            Ticket.id == ticket_id,
            Ticket.mandant_id == mandant_id,
            Ticket.deleted_at.is_(None),
        )
        .options(*_TICKET_LOAD_OPTIONS)
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
    beschreibung: str = "",
    status_slug: str | None = None,
    prioritaet_slug: str = "mittel",
    kategorie_slug: str | None = None,
    objekt_id: UUID | None = None,
    partner_id: UUID | None = None,
    zugewiesen_an_id: UUID | None = None,
) -> Ticket:
    now = datetime.now(UTC)

    # Status: explizit angegeben oder „neu"; wenn zugewiesen → „bearbeitung"
    if status_slug is None:
        effective_status = (
            TicketStatusSlug.BEARBEITUNG.value
            if zugewiesen_an_id is not None
            else TicketStatusSlug.NEU.value
        )
    else:
        effective_status = status_slug

    status_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_STATUS, effective_status)
    prioritaet_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_PRIORITAET, prioritaet_slug)
    kategorie_wert = (
        await _resolve_slug(db, mandant_id, LISTE_KEY_KATEGORIE, kategorie_slug)
        if kategorie_slug is not None
        else None
    )

    if zugewiesen_an_id is not None:
        await _validate_assignee(db, zugewiesen_an_id, mandant_id)
    if objekt_id is not None:
        await _validate_objekt(db, objekt_id, mandant_id)
    if partner_id is not None:
        await _validate_partner(db, partner_id, mandant_id)

    zugewiesen_am = now if zugewiesen_an_id is not None else None
    erledigt_am = now if status_wert.key == TicketStatusSlug.ERLEDIGT.value else None

    ticket = Ticket(
        mandant_id=mandant_id,
        nummer=0,  # filled by Postgres trigger set_ticket_nummer()
        titel=titel,
        beschreibung=beschreibung,
        status_id=status_wert.id,
        prioritaet_id=prioritaet_wert.id,
        kategorie_id=kategorie_wert.id if kategorie_wert is not None else None,
        objekt_id=objekt_id,
        partner_id=partner_id,
        eroeffnet_von_id=eroeffnet_von_id,
        zugewiesen_an_id=zugewiesen_an_id,
        eroeffnet_am=now,
        zugewiesen_am=zugewiesen_am,
        erledigt_am=erledigt_am,
    )
    db.add(ticket)
    await db.flush()
    # Refresh nummer (Trigger set_ticket_nummer überschreibt 0) und Relationships
    # für die anschließende Serialisierung.
    await db.refresh(
        ticket,
        [
            "nummer",
            "eroeffnet_von",
            "zugewiesen_an",
            "status_wert",
            "prioritaet_wert",
            "kategorie_wert",
            "objekt",
            "partner",
        ],
    )
    return ticket


async def update_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
) -> Ticket:
    ticket = await get_ticket(db, ticket_id, mandant_id)
    now = datetime.now(UTC)

    if "titel" in updates:
        ticket.titel = updates["titel"]
    if "beschreibung" in updates:
        ticket.beschreibung = updates["beschreibung"]

    if "prioritaet" in updates and updates["prioritaet"] is not None:
        prio_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_PRIORITAET, updates["prioritaet"])
        ticket.prioritaet_id = prio_wert.id

    if "kategorie" in updates:
        if updates["kategorie"] is None:
            ticket.kategorie_id = None
        else:
            kat_wert = await _resolve_slug(
                db, mandant_id, LISTE_KEY_KATEGORIE, updates["kategorie"]
            )
            ticket.kategorie_id = kat_wert.id

    if "objekt_id" in updates:
        new_objekt = updates["objekt_id"]
        if new_objekt is not None:
            await _validate_objekt(db, new_objekt, mandant_id)
        ticket.objekt_id = new_objekt

    if "partner_id" in updates:
        new_partner = updates["partner_id"]
        if new_partner is not None:
            await _validate_partner(db, new_partner, mandant_id)
        ticket.partner_id = new_partner

    if "zugewiesen_an_id" in updates:
        new_assignee = updates["zugewiesen_an_id"]
        if new_assignee is not None:
            await _validate_assignee(db, new_assignee, mandant_id)
        ticket.zugewiesen_an_id = new_assignee
        if new_assignee is not None and ticket.zugewiesen_am is None:
            ticket.zugewiesen_am = now
            current_status_slug = ticket.status_wert.key
            if current_status_slug == TicketStatusSlug.NEU.value:
                bearbeitung_wert = await _resolve_slug(
                    db, mandant_id, LISTE_KEY_STATUS, TicketStatusSlug.BEARBEITUNG.value
                )
                ticket.status_id = bearbeitung_wert.id

    if "status" in updates and updates["status"] is not None:
        new_status_slug = updates["status"]
        current_status_slug = ticket.status_wert.key
        if (current_status_slug, new_status_slug) in INVALID_TRANSITIONS:
            raise InvalidStatusTransitionError(
                f"cannot transition from '{current_status_slug}' to '{new_status_slug}'"
            )
        new_status_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_STATUS, new_status_slug)
        ticket.status_id = new_status_wert.id
        if new_status_wert.key == TicketStatusSlug.ERLEDIGT.value and ticket.erledigt_am is None:
            ticket.erledigt_am = now

    await db.flush()
    await db.refresh(
        ticket,
        [
            "updated_at",
            "eroeffnet_von",
            "zugewiesen_an",
            "status_wert",
            "prioritaet_wert",
            "kategorie_wert",
            "objekt",
            "partner",
        ],
    )
    return ticket


async def soft_delete_ticket(db: AsyncSession, ticket_id: UUID, mandant_id: UUID) -> None:
    ticket = await get_ticket(db, ticket_id, mandant_id)
    ticket.deleted_at = datetime.now(UTC)
    await db.flush()


async def resolve_status_id(db: AsyncSession, mandant_id: UUID, slug: str) -> UUID:
    """Hilfs-Funktion für andere Services / Skripte."""
    wert = await _resolve_slug(db, mandant_id, LISTE_KEY_STATUS, slug)
    return wert.id


async def resolve_prioritaet_id(db: AsyncSession, mandant_id: UUID, slug: str) -> UUID:
    wert = await _resolve_slug(db, mandant_id, LISTE_KEY_PRIORITAET, slug)
    return wert.id


async def assert_wert_belongs_to(
    db: AsyncSession, mandant_id: UUID, wert_id: UUID, liste_key: str
) -> AuswahllistenWert:
    return await get_wert_by_id(db, mandant_id, wert_id, liste_key)
