from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import (
    Auswahlliste,
    AuswahllistenWert,
    Objekt,
    Projekt,
    ProjektObjektLink,
    Ticket,
    User,
)
from fm_api.services.auswahlliste_service import (
    AuswahllistenWertNotFoundError,
    get_wert_by_key,
)


class ProjektNotFoundError(Exception):
    pass


class UnknownAuswahlSlugError(Exception):
    """Slug konnte nicht auf einen Auswahllisten-Wert aufgelöst werden."""


class ObjektNotFoundError(Exception):
    pass


class VerantwortlichNotFoundError(Exception):
    """Verantwortlicher gehört nicht zum Mandanten oder ist inaktiv (Cross-Mandant-Schutz)."""


LISTE_KEY_PROJEKTTYP = "projekttyp"
LISTE_KEY_PROJEKTSTATUS = "projektstatus"


_PROJEKT_LOAD_OPTIONS = (
    selectinload(Projekt.projekttyp_wert),
    selectinload(Projekt.status_wert),
    selectinload(Projekt.verantwortlich),
    selectinload(Projekt.objekt_links).selectinload(ProjektObjektLink.objekt),
)


async def _resolve_slug(
    db: AsyncSession, mandant_id: UUID, liste_key: str, slug: str
) -> AuswahllistenWert:
    try:
        return await get_wert_by_key(db, mandant_id, liste_key, slug)
    except AuswahllistenWertNotFoundError as exc:
        raise UnknownAuswahlSlugError(
            f"slug '{slug}' not configured in liste '{liste_key}'"
        ) from exc


async def _validate_objekte(
    db: AsyncSession, mandant_id: UUID, objekt_ids: list[UUID]
) -> list[UUID]:
    """Stelle sicher, dass alle objekt_ids zum Mandanten gehören + nicht gelöscht sind.

    Gibt die deduplizierte Liste zurück (in eingegebener Reihenfolge).
    """
    if not objekt_ids:
        return []

    # Duplikate raus, Reihenfolge behalten
    seen: set[UUID] = set()
    deduped: list[UUID] = []
    for oid in objekt_ids:
        if oid not in seen:
            seen.add(oid)
            deduped.append(oid)

    stmt = select(Objekt.id).where(
        Objekt.id.in_(deduped),
        Objekt.mandant_id == mandant_id,
        Objekt.deleted_at.is_(None),
    )
    valid_ids = set((await db.execute(stmt)).scalars().all())
    missing = [oid for oid in deduped if oid not in valid_ids]
    if missing:
        raise ObjektNotFoundError(
            f"objekte not found or not in mandant: {[str(m) for m in missing]}"
        )
    return deduped


async def _validate_verantwortlich(
    db: AsyncSession, user_id: UUID | None, mandant_id: UUID
) -> None:
    """Verantwortlicher muss ein aktiver User DESSELBEN Mandanten sein.

    Schützt vor IDOR/Cross-Mandant-Zuweisung (user-gelieferter FK), analog zur
    Assignee-Prüfung im Ticket-Service.
    """
    if user_id is None:
        return
    stmt = select(User.id).where(
        User.id == user_id,
        User.mandant_id == mandant_id,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise VerantwortlichNotFoundError(
            f"verantwortlich user {user_id} not found or not in mandant"
        )


async def list_projekte(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    status_filter: list[str] | None = None,
    projekttyp_filter: list[str] | None = None,
    include_deleted: bool = False,
    limit: int | None = None,
) -> list[tuple[Projekt, int]]:
    base = select(Projekt).where(Projekt.mandant_id == mandant_id)
    if not include_deleted:
        base = base.where(Projekt.deleted_at.is_(None))
    if search:
        like = f"%{search.lower()}%"
        base = base.where(func.lower(Projekt.name).like(like))

    if status_filter:
        status_ids_subq = (
            select(AuswahllistenWert.id)
            .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
            .where(
                Auswahlliste.mandant_id == mandant_id,
                Auswahlliste.key == LISTE_KEY_PROJEKTSTATUS,
                AuswahllistenWert.key.in_([s.lower() for s in status_filter]),
            )
            .scalar_subquery()
        )
        base = base.where(Projekt.status_id.in_(status_ids_subq))

    if projekttyp_filter:
        typ_ids_subq = (
            select(AuswahllistenWert.id)
            .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
            .where(
                Auswahlliste.mandant_id == mandant_id,
                Auswahlliste.key == LISTE_KEY_PROJEKTTYP,
                AuswahllistenWert.key.in_([s.lower() for s in projekttyp_filter]),
            )
            .scalar_subquery()
        )
        base = base.where(Projekt.projekttyp_id.in_(typ_ids_subq))

    items_stmt = base.options(*_PROJEKT_LOAD_OPTIONS).order_by(desc(Projekt.created_at))
    if limit is not None:
        items_stmt = items_stmt.limit(limit)
    items = (await db.execute(items_stmt)).scalars().unique().all()

    # Ticket-Count je Projekt
    counts: dict[UUID, int] = {}
    if items:
        count_stmt = (
            select(Ticket.projekt_id, func.count(Ticket.id))
            .where(
                Ticket.projekt_id.in_([p.id for p in items]),
                Ticket.deleted_at.is_(None),
            )
            .group_by(Ticket.projekt_id)
        )
        counts = {row[0]: row[1] for row in (await db.execute(count_stmt)).all() if row[0]}

    return [(p, counts.get(p.id, 0)) for p in items]


async def get_projekt(db: AsyncSession, mandant_id: UUID, projekt_id: UUID) -> tuple[Projekt, int]:
    stmt = (
        select(Projekt)
        .where(
            Projekt.id == projekt_id,
            Projekt.mandant_id == mandant_id,
            Projekt.deleted_at.is_(None),
        )
        .options(*_PROJEKT_LOAD_OPTIONS)
    )
    p = (await db.execute(stmt)).unique().scalar_one_or_none()
    if p is None:
        raise ProjektNotFoundError(f"projekt {projekt_id} not found")
    count = (
        await db.execute(
            select(func.count(Ticket.id)).where(
                Ticket.projekt_id == projekt_id, Ticket.deleted_at.is_(None)
            )
        )
    ).scalar_one()
    return p, count


async def create_projekt(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    name: str,
    projekttyp_slug: str,
    status_slug: str = "geplant",
    beschreibung: str | None = None,
    verantwortlich_user_id: UUID | None = None,
    start_am: Any | None = None,
    ende_am: Any | None = None,
    notizen: str | None = None,
    objekt_ids: list[UUID] | None = None,
) -> Projekt:
    projekttyp_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_PROJEKTTYP, projekttyp_slug)
    status_wert = await _resolve_slug(db, mandant_id, LISTE_KEY_PROJEKTSTATUS, status_slug)

    await _validate_verantwortlich(db, verantwortlich_user_id, mandant_id)
    valid_objekt_ids = await _validate_objekte(db, mandant_id, objekt_ids or [])

    p = Projekt(
        mandant_id=mandant_id,
        name=name,
        beschreibung=beschreibung,
        projekttyp_id=projekttyp_wert.id,
        status_id=status_wert.id,
        verantwortlich_user_id=verantwortlich_user_id,
        start_am=start_am,
        ende_am=ende_am,
        notizen=notizen,
    )
    db.add(p)
    await db.flush()

    for oid in valid_objekt_ids:
        db.add(
            ProjektObjektLink(
                projekt_id=p.id,
                objekt_id=oid,
                mandant_id=mandant_id,
            )
        )
    await db.flush()

    new_id = p.id
    db.expunge(p)
    fresh, _ = await get_projekt(db, mandant_id, new_id)
    return fresh


async def update_projekt(
    db: AsyncSession,
    mandant_id: UUID,
    projekt_id: UUID,
    updates: dict[str, Any],
) -> Projekt:
    p, _ = await get_projekt(db, mandant_id, projekt_id)

    if "verantwortlich_user_id" in updates:
        await _validate_verantwortlich(db, updates["verantwortlich_user_id"], mandant_id)

    # Direkte Felder
    for direct in (
        "name",
        "beschreibung",
        "verantwortlich_user_id",
        "start_am",
        "ende_am",
        "notizen",
    ):
        if direct in updates:
            value = updates[direct]
            if value is None and direct == "name":
                # name darf nicht auf None gesetzt werden
                continue
            setattr(p, direct, value)

    if "projekttyp_slug" in updates and updates["projekttyp_slug"] is not None:
        typ_wert = await _resolve_slug(
            db, mandant_id, LISTE_KEY_PROJEKTTYP, updates["projekttyp_slug"]
        )
        p.projekttyp_id = typ_wert.id

    if "status_slug" in updates and updates["status_slug"] is not None:
        status_wert = await _resolve_slug(
            db, mandant_id, LISTE_KEY_PROJEKTSTATUS, updates["status_slug"]
        )
        p.status_id = status_wert.id

    # Objekt-Links: replace-Strategie
    if "objekt_ids" in updates and updates["objekt_ids"] is not None:
        new_objekt_ids = await _validate_objekte(db, mandant_id, list(updates["objekt_ids"]))
        # bestehende Links abrufen und droppen
        existing_links = (
            (
                await db.execute(
                    select(ProjektObjektLink).where(ProjektObjektLink.projekt_id == projekt_id)
                )
            )
            .scalars()
            .all()
        )
        for link in existing_links:
            await db.delete(link)
        # neue Links setzen
        for oid in new_objekt_ids:
            db.add(
                ProjektObjektLink(
                    projekt_id=projekt_id,
                    objekt_id=oid,
                    mandant_id=mandant_id,
                )
            )

    await db.flush()
    # Reload mit eager-loaded relationships statt partial refresh — sonst
    # MissingGreenlet beim Pydantic-Validate auf den expired Attributen.
    db.expunge(p)
    fresh, _ = await get_projekt(db, mandant_id, projekt_id)
    return fresh


async def soft_delete_projekt(db: AsyncSession, mandant_id: UUID, projekt_id: UUID) -> None:
    p, _ = await get_projekt(db, mandant_id, projekt_id)
    p.deleted_at = datetime.now(UTC)
    await db.flush()


async def list_tickets_for_projekt(
    db: AsyncSession,
    mandant_id: UUID,
    projekt_id: UUID,
    *,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Ticket], int]:
    """Tickets, die diesem Projekt zugeordnet sind.

    Stellt sicher, dass das Projekt zum Mandanten gehört (sonst NotFound).
    """
    # Projekt-Existenz/Mandant prüfen — sonst kann jeder Tickets fremder Mandanten ziehen
    await get_projekt(db, mandant_id, projekt_id)

    from fm_api.services.ticket_service import _TICKET_LOAD_OPTIONS

    base = select(Ticket).where(
        Ticket.mandant_id == mandant_id,
        Ticket.projekt_id == projekt_id,
    )
    if not include_deleted:
        base = base.where(Ticket.deleted_at.is_(None))

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
