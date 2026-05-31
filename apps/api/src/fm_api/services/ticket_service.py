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
    Projekt,
    Ticket,
    User,
)
from fm_api.models.ticket import TicketStatusSlug
from fm_api.services import status_workflow_service
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

_TICKET_LOAD_OPTIONS = (
    selectinload(Ticket.eroeffnet_von),
    selectinload(Ticket.zugewiesen_an),
    selectinload(Ticket.status_wert),
    selectinload(Ticket.prioritaet_wert),
    selectinload(Ticket.kategorie_wert),
    selectinload(Ticket.objekt),
    selectinload(Ticket.haus),
    selectinload(Ticket.stockwerk),
    selectinload(Ticket.einheit),
    selectinload(Ticket.partner),
    selectinload(Ticket.tickettyp),
    selectinload(Ticket.projekt).selectinload(Projekt.status_wert),
    selectinload(Ticket.quelle_wert),
    selectinload(Ticket.wartet_grund_wert),
    selectinload(Ticket.wartet_nachunternehmer),
    selectinload(Ticket.anlage),
    selectinload(Ticket.fehlercode),
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
    partner_id: UUID | None = None,
    objekt_id: UUID | None = None,
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

    if partner_id is not None:
        base = base.where(Ticket.partner_id == partner_id)

    if objekt_id is not None:
        base = base.where(Ticket.objekt_id == objekt_id)

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
    haus_id: UUID | None = None,
    stockwerk_id: UUID | None = None,
    einheit_id: UUID | None = None,
    pin_x: float | None = None,
    pin_y: float | None = None,
    partner_id: UUID | None = None,
    zugewiesen_an_id: UUID | None = None,
    tickettyp_id: UUID | None = None,
    projekt_id: UUID | None = None,
    anlage_id: UUID | None = None,
    fehlercode_id: UUID | None = None,
    quelle_slug: str | None = None,
    melder: str | None = None,
    faelligkeit_am: Any | None = None,
    wiederholung: str | None = None,
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

    quelle_wert = (
        await _resolve_slug(db, mandant_id, "eingangskanal", quelle_slug)
        if quelle_slug is not None
        else None
    )

    ticket = Ticket(
        mandant_id=mandant_id,
        nummer=0,  # filled by Postgres trigger set_ticket_nummer()
        titel=titel,
        beschreibung=beschreibung,
        status_id=status_wert.id,
        prioritaet_id=prioritaet_wert.id,
        kategorie_id=kategorie_wert.id if kategorie_wert is not None else None,
        objekt_id=objekt_id,
        haus_id=haus_id,
        stockwerk_id=stockwerk_id,
        einheit_id=einheit_id,
        pin_x=pin_x,
        pin_y=pin_y,
        partner_id=partner_id,
        tickettyp_id=tickettyp_id,
        projekt_id=projekt_id,
        anlage_id=anlage_id,
        fehlercode_id=fehlercode_id,
        quelle_id=quelle_wert.id if quelle_wert else None,
        melder=melder,
        eroeffnet_von_id=eroeffnet_von_id,
        zugewiesen_an_id=zugewiesen_an_id,
        eroeffnet_am=now,
        zugewiesen_am=zugewiesen_am,
        erledigt_am=erledigt_am,
        faelligkeit_am=faelligkeit_am,
        wiederholung=wiederholung,
    )
    db.add(ticket)
    await db.flush()
    # Trigger `set_ticket_nummer` (BEFORE INSERT) hat die nummer überschrieben —
    # ohne explizites refresh hätte SQLAlchemy noch den Python-Wert (0) gecached.
    # `db.refresh()` re-fetched aus der DB, dann liefert get_ticket sauber.
    await db.refresh(ticket, ["nummer"])
    return await get_ticket(db, ticket.id, mandant_id)


async def update_ticket(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
    *,
    actor_user_id: UUID | None = None,
) -> Ticket:
    from fm_api.services import notification_service as _notif

    ticket = await get_ticket(db, ticket_id, mandant_id)
    now = datetime.now(UTC)
    old_assignee_id = ticket.zugewiesen_an_id
    old_status_slug = ticket.status_wert.key

    # Direkte String-/UUID-Felder
    for direct in (
        "titel",
        "beschreibung",
        "melder",
        "wartet_kontakt_name",
        "wartet_kontakt_telefon",
        "wartet_kontakt_email",
        "wiederholung",
        "faelligkeit_am",
        "pin_x",
        "pin_y",
        "haus_id",
        "stockwerk_id",
        "einheit_id",
        "tickettyp_id",
        "projekt_id",
        "anlage_id",
        "fehlercode_id",
    ):
        if direct in updates:
            setattr(ticket, direct, updates[direct])

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

    if "quelle" in updates:
        if updates["quelle"] is None:
            ticket.quelle_id = None
        else:
            q_wert = await _resolve_slug(db, mandant_id, "eingangskanal", updates["quelle"])
            ticket.quelle_id = q_wert.id

    if "wartet_grund" in updates:
        if updates["wartet_grund"] is None:
            ticket.wartet_grund_id = None
        else:
            w_wert = await _resolve_slug(db, mandant_id, "wartet_grund", updates["wartet_grund"])
            ticket.wartet_grund_id = w_wert.id

    if "wartet_nachunternehmer_id" in updates:
        ticket.wartet_nachunternehmer_id = updates["wartet_nachunternehmer_id"]

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

    fire_zuweisung_notif: tuple[UUID, str] | None = None
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
        # Notification senden wenn neuer Bearbeiter ungleich altem + ungleich Aktor
        if (
            new_assignee is not None
            and new_assignee != old_assignee_id
            and new_assignee != actor_user_id
        ):
            fire_zuweisung_notif = (new_assignee, ticket.titel)

    fire_status_notif: tuple[UUID, str] | None = None
    if "status" in updates and updates["status"] is not None:
        new_status_slug = updates["status"]
        current_status_slug = ticket.status_wert.key
        if not await status_workflow_service.is_transition_allowed(
            db, mandant_id, current_status_slug, new_status_slug
        ):
            raise InvalidStatusTransitionError(
                f"cannot transition from '{current_status_slug}' to '{new_status_slug}'"
            )
        new_status_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_STATUS, new_status_slug)
        ticket.status_id = new_status_wert.id
        if new_status_wert.key == TicketStatusSlug.ERLEDIGT.value and ticket.erledigt_am is None:
            ticket.erledigt_am = now
        # Status-Notification an Bearbeiter + Erfasser (sofern nicht Aktor selbst)
        if old_status_slug != new_status_slug:
            for recipient in {ticket.zugewiesen_an_id, ticket.eroeffnet_von_id}:
                if recipient is None or recipient == actor_user_id:
                    continue
                if fire_status_notif is None:
                    fire_status_notif = (recipient, new_status_slug)
                else:
                    await _notif.fire(
                        db,
                        mandant_id=mandant_id,
                        user_id=recipient,
                        typ="status",
                        text=f"Status auf '{new_status_slug}' geändert: {ticket.titel}",
                        ticket_id=ticket.id,
                        ausloeser_user_id=actor_user_id,
                    )

    await db.flush()
    # Identity-Map invalidieren, sonst liefert get_ticket die alte Relationship-Cache
    # (status_wert, prioritaet_wert, …) zurück trotz änderter *_id.
    # `expunge` (statt `expire`) entfernt das Ticket-Objekt komplett aus der Session,
    # damit get_ticket alles frisch + eager (selectinload) lädt — wichtig im
    # async-Context, weil expire-Lazy-Loading sonst MissingGreenlet wirft.
    db.expunge(ticket)
    ticket_reloaded = await get_ticket(db, ticket.id, mandant_id)

    if fire_zuweisung_notif:
        recipient, titel = fire_zuweisung_notif
        await _notif.fire(
            db,
            mandant_id=mandant_id,
            user_id=recipient,
            typ="zuweisung",
            text=f"Ticket zugewiesen: {titel}",
            ticket_id=ticket.id,
            ausloeser_user_id=actor_user_id,
        )
    if fire_status_notif:
        recipient, slug = fire_status_notif
        await _notif.fire(
            db,
            mandant_id=mandant_id,
            user_id=recipient,
            typ="status",
            text=f"Status auf '{slug}' geändert: {ticket_reloaded.titel}",
            ticket_id=ticket.id,
            ausloeser_user_id=actor_user_id,
        )

    return ticket_reloaded


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
