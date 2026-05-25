"""Geschäftspartner-Service.

R6c-Refactor: Partner hat jetzt Hierarchie (parent_partner_id), mehrere
Kontakte (partner_kontakte), mehrere Adressen über Junction (partner_adressen).
Soft-Sperre über `gesperrt`-Spalte (statt Hard-Delete) — Sperren wirkt
rekursiv auf alle Filialen.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import (
    DokumentLink,
    GeschaeftsPartner,
    ObjektPartner,
    PartnerAdresse,
    PartnerKontakt,
    Ticket,
)
from fm_api.models.objektstruktur import (
    EinheitEigentuemer,
    EinheitMieter,
    HausEigentuemer,
    HausMieter,
    StockwerkEigentuemer,
    StockwerkMieter,
)
from fm_api.models.partner import PartnerTyp


class PartnerNotFoundError(Exception):
    pass


class PartnerKontaktNotFoundError(Exception):
    pass


class PartnerAdresseNotFoundError(Exception):
    pass


class PartnerHasReferencesError(Exception):
    """Hard-Delete blockiert: Partner ist noch verknüpft."""

    def __init__(self, references: dict[str, int]) -> None:
        self.references = references
        super().__init__(
            "Partner hat noch Referenzen: "
            + ", ".join(f"{n} {k}" for k, n in references.items() if n > 0)
        )


class PartnerCircularHierarchyError(Exception):
    """parent_partner_id würde einen Zirkel verursachen."""


_PARTNER_LOAD_OPTIONS = (
    selectinload(GeschaeftsPartner.kontakte),
    selectinload(GeschaeftsPartner.adress_links).selectinload(PartnerAdresse.adresse),
)


async def list_partner(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    typ_filter: list[str] | None = None,
    gesperrt_filter: str = "aktiv",  # 'aktiv' | 'gesperrt' | 'alle'
    parent_partner_id: UUID | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[GeschaeftsPartner], int]:
    base = select(GeschaeftsPartner).where(GeschaeftsPartner.mandant_id == mandant_id)
    if not include_deleted:
        base = base.where(GeschaeftsPartner.deleted_at.is_(None))

    if gesperrt_filter == "aktiv":
        base = base.where(GeschaeftsPartner.gesperrt.is_(False))
    elif gesperrt_filter == "gesperrt":
        base = base.where(GeschaeftsPartner.gesperrt.is_(True))
    # 'alle' = kein zusätzlicher Filter

    if search:
        like = f"%{search.lower()}%"
        base = base.where(
            or_(
                func.lower(GeschaeftsPartner.name).like(like),
                func.lower(func.coalesce(GeschaeftsPartner.nachname, "")).like(like),
                func.lower(func.coalesce(GeschaeftsPartner.vorname, "")).like(like),
                func.lower(func.coalesce(GeschaeftsPartner.email, "")).like(like),
            )
        )
    if typ_filter:
        valid = [PartnerTyp(t) for t in typ_filter if t in PartnerTyp.__members__.values()]
        if valid:
            base = base.where(GeschaeftsPartner.typen.op("&&")(valid))

    if parent_partner_id is not None:
        base = base.where(GeschaeftsPartner.parent_partner_id == parent_partner_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = (
        base.options(*_PARTNER_LOAD_OPTIONS)
        .order_by(GeschaeftsPartner.name)
        .limit(limit)
        .offset(offset)
    )
    items = (await db.execute(items_stmt)).scalars().all()
    return list(items), total


async def get_partner(db: AsyncSession, partner_id: UUID, mandant_id: UUID) -> GeschaeftsPartner:
    stmt = (
        select(GeschaeftsPartner)
        .where(
            GeschaeftsPartner.id == partner_id,
            GeschaeftsPartner.mandant_id == mandant_id,
            GeschaeftsPartner.deleted_at.is_(None),
        )
        .options(*_PARTNER_LOAD_OPTIONS)
    )
    partner = (await db.execute(stmt)).scalar_one_or_none()
    if partner is None:
        raise PartnerNotFoundError(f"partner {partner_id} not found")
    return partner


async def _check_circular_hierarchy(
    db: AsyncSession,
    mandant_id: UUID,
    partner_id: UUID,
    new_parent_id: UUID | None,
) -> None:
    """Stellt sicher, dass das Setzen von parent_partner_id keinen Zirkel ergibt."""
    if new_parent_id is None:
        return
    if new_parent_id == partner_id:
        raise PartnerCircularHierarchyError("Partner kann sich nicht selbst als Mutter haben.")
    # Wandere die Vorfahren-Kette des neuen Parents hoch. Findet sich
    # partner_id darin, wäre ein Zirkel.
    current: UUID | None = new_parent_id
    visited: set[UUID] = set()
    while current is not None:
        if current in visited:
            # Defensiv: bestehende Zirkel im DB-Stand verhindern Endlos-Schleife.
            break
        visited.add(current)
        if current == partner_id:
            raise PartnerCircularHierarchyError("Diese Hierarchie würde einen Zirkel erzeugen.")
        row = (
            await db.execute(
                select(GeschaeftsPartner.parent_partner_id).where(
                    GeschaeftsPartner.id == current,
                    GeschaeftsPartner.mandant_id == mandant_id,
                )
            )
        ).scalar_one_or_none()
        current = row


async def create_partner(
    db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]
) -> GeschaeftsPartner:
    typen_str = payload.pop("typen", []) or []
    typen = [PartnerTyp(t) for t in typen_str]
    parent_id = payload.get("parent_partner_id")
    if parent_id is not None:
        # Beim Anlegen: temporärer Self-Check entfällt (Partner hat noch keine ID),
        # nur prüfen, dass Parent existiert und im Mandanten ist.
        parent_exists = (
            await db.execute(
                select(GeschaeftsPartner.id).where(
                    GeschaeftsPartner.id == parent_id,
                    GeschaeftsPartner.mandant_id == mandant_id,
                )
            )
        ).scalar_one_or_none()
        if parent_exists is None:
            raise PartnerNotFoundError(f"parent {parent_id} not found")

    partner = GeschaeftsPartner(mandant_id=mandant_id, typen=typen, **payload)
    db.add(partner)
    await db.flush()
    new_id = partner.id
    db.expunge(partner)
    return await get_partner(db, new_id, mandant_id)


async def update_partner(
    db: AsyncSession,
    partner_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
) -> GeschaeftsPartner:
    partner = await get_partner(db, partner_id, mandant_id)
    if "parent_partner_id" in updates:
        new_parent = updates["parent_partner_id"]
        await _check_circular_hierarchy(db, mandant_id, partner_id, new_parent)

    if "typen" in updates and updates["typen"] is not None:
        partner.typen = [PartnerTyp(t) for t in updates.pop("typen")]
    elif "typen" in updates and updates["typen"] is None:
        updates.pop("typen")

    for key, value in updates.items():
        if value is None and key == "name":
            continue
        setattr(partner, key, value)
    await db.flush()
    db.expunge(partner)
    return await get_partner(db, partner_id, mandant_id)


async def _collect_descendants(db: AsyncSession, mandant_id: UUID, root_id: UUID) -> list[UUID]:
    """Sammelt root_id + alle direkten + transitiven Kinder per BFS."""
    collected: list[UUID] = [root_id]
    frontier: list[UUID] = [root_id]
    while frontier:
        rows = (
            await db.execute(
                select(GeschaeftsPartner.id).where(
                    GeschaeftsPartner.parent_partner_id.in_(frontier),
                    GeschaeftsPartner.mandant_id == mandant_id,
                )
            )
        ).all()
        next_ids = [r[0] for r in rows]
        if not next_ids:
            break
        collected.extend(next_ids)
        frontier = next_ids
    return collected


async def sperren_partner(
    db: AsyncSession, partner_id: UUID, mandant_id: UUID, *, gesperrt: bool = True
) -> list[UUID]:
    """Setzt `gesperrt` auf root + alle Nachfahren. Gibt die betroffenen IDs zurück."""
    # Stellt sicher, dass der Wurzel-Partner überhaupt existiert.
    await get_partner(db, partner_id, mandant_id)
    ids = await _collect_descendants(db, mandant_id, partner_id)
    await db.execute(
        update(GeschaeftsPartner)
        .where(
            GeschaeftsPartner.id.in_(ids),
            GeschaeftsPartner.mandant_id == mandant_id,
        )
        .values(gesperrt=gesperrt)
    )
    await db.flush()
    return ids


async def _count_partner_references(db: AsyncSession, partner_id: UUID) -> dict[str, int]:
    """Zählt alle Stellen, an denen dieser Partner verknüpft ist."""

    async def count(stmt) -> int:  # type: ignore[no-untyped-def]
        return (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    return {
        "Tickets": await count(select(Ticket).where(Ticket.partner_id == partner_id)),
        "Objekt-Verknüpfungen": await count(
            select(ObjektPartner).where(ObjektPartner.partner_id == partner_id)
        ),
        "Haus-Eigentümer": await count(
            select(HausEigentuemer).where(HausEigentuemer.partner_id == partner_id)
        ),
        "Haus-Mieter": await count(select(HausMieter).where(HausMieter.partner_id == partner_id)),
        "Stockwerk-Eigentümer": await count(
            select(StockwerkEigentuemer).where(StockwerkEigentuemer.partner_id == partner_id)
        ),
        "Stockwerk-Mieter": await count(
            select(StockwerkMieter).where(StockwerkMieter.partner_id == partner_id)
        ),
        "Einheit-Eigentümer": await count(
            select(EinheitEigentuemer).where(EinheitEigentuemer.partner_id == partner_id)
        ),
        "Einheit-Mieter": await count(
            select(EinheitMieter).where(EinheitMieter.partner_id == partner_id)
        ),
        "Filialen": await count(
            select(GeschaeftsPartner).where(
                GeschaeftsPartner.parent_partner_id == partner_id,
                GeschaeftsPartner.deleted_at.is_(None),
            )
        ),
        "Dokumente": await count(
            select(DokumentLink).where(
                DokumentLink.target_type == "partner",
                DokumentLink.target_id == partner_id,
            )
        ),
    }


async def hard_delete_partner(db: AsyncSession, partner_id: UUID, mandant_id: UUID) -> None:
    """Hard-Delete; blockiert mit `PartnerHasReferencesError` wenn Referenzen bestehen."""
    await get_partner(db, partner_id, mandant_id)  # NotFound-Check
    refs = await _count_partner_references(db, partner_id)
    if any(n > 0 for n in refs.values()):
        raise PartnerHasReferencesError(refs)
    await db.execute(
        delete(GeschaeftsPartner).where(
            GeschaeftsPartner.id == partner_id,
            GeschaeftsPartner.mandant_id == mandant_id,
        )
    )
    await db.flush()


async def soft_delete_partner(db: AsyncSession, partner_id: UUID, mandant_id: UUID) -> None:
    """Backward-Compat: alter DELETE-Endpoint, jetzt = sperren rekursiv."""
    await sperren_partner(db, partner_id, mandant_id, gesperrt=True)
    partner = await get_partner(db, partner_id, mandant_id)
    partner.deleted_at = datetime.now(UTC)
    await db.flush()


# ----- Kontakt-Service ------------------------------------------------------


async def list_kontakte(
    db: AsyncSession, partner_id: UUID, mandant_id: UUID
) -> list[PartnerKontakt]:
    # Partner-Existenz prüfen
    await get_partner(db, partner_id, mandant_id)
    stmt = (
        select(PartnerKontakt)
        .where(
            PartnerKontakt.partner_id == partner_id,
            PartnerKontakt.mandant_id == mandant_id,
            PartnerKontakt.deleted_at.is_(None),
        )
        .order_by(PartnerKontakt.ist_hauptkontakt.desc(), PartnerKontakt.nachname)
    )
    return list((await db.execute(stmt)).scalars().all())


async def create_kontakt(
    db: AsyncSession,
    partner_id: UUID,
    mandant_id: UUID,
    *,
    payload: dict[str, Any],
) -> PartnerKontakt:
    await get_partner(db, partner_id, mandant_id)
    if payload.get("ist_hauptkontakt"):
        # Andere Hauptkontakte zurücksetzen
        await db.execute(
            update(PartnerKontakt)
            .where(
                PartnerKontakt.partner_id == partner_id,
                PartnerKontakt.mandant_id == mandant_id,
            )
            .values(ist_hauptkontakt=False)
        )
    kontakt = PartnerKontakt(
        mandant_id=mandant_id,
        partner_id=partner_id,
        **payload,
    )
    db.add(kontakt)
    await db.flush()
    new_id = kontakt.id
    db.expunge(kontakt)
    return await get_kontakt(db, new_id, mandant_id)


async def get_kontakt(db: AsyncSession, kontakt_id: UUID, mandant_id: UUID) -> PartnerKontakt:
    stmt = select(PartnerKontakt).where(
        PartnerKontakt.id == kontakt_id,
        PartnerKontakt.mandant_id == mandant_id,
        PartnerKontakt.deleted_at.is_(None),
    )
    kontakt = (await db.execute(stmt)).scalar_one_or_none()
    if kontakt is None:
        raise PartnerKontaktNotFoundError(f"kontakt {kontakt_id} not found")
    return kontakt


async def update_kontakt(
    db: AsyncSession,
    kontakt_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
) -> PartnerKontakt:
    kontakt = await get_kontakt(db, kontakt_id, mandant_id)
    if updates.get("ist_hauptkontakt") is True:
        await db.execute(
            update(PartnerKontakt)
            .where(
                PartnerKontakt.partner_id == kontakt.partner_id,
                PartnerKontakt.mandant_id == mandant_id,
                PartnerKontakt.id != kontakt_id,
            )
            .values(ist_hauptkontakt=False)
        )
    for key, value in updates.items():
        if value is not None or key in (
            "anrede_id",
            "titel",
            "vorname",
            "nachname",
            "email",
            "telefon",
            "mobil",
            "notiz",
        ):
            setattr(kontakt, key, value)
    await db.flush()
    return kontakt


async def delete_kontakt(db: AsyncSession, kontakt_id: UUID, mandant_id: UUID) -> None:
    await get_kontakt(db, kontakt_id, mandant_id)
    await db.execute(
        delete(PartnerKontakt).where(
            PartnerKontakt.id == kontakt_id,
            PartnerKontakt.mandant_id == mandant_id,
        )
    )
    await db.flush()


# ----- Adress-Junction-Service ----------------------------------------------


async def list_adressen(
    db: AsyncSession, partner_id: UUID, mandant_id: UUID
) -> list[PartnerAdresse]:
    await get_partner(db, partner_id, mandant_id)
    stmt = (
        select(PartnerAdresse)
        .where(
            PartnerAdresse.partner_id == partner_id,
            PartnerAdresse.mandant_id == mandant_id,
        )
        .options(selectinload(PartnerAdresse.adresse))
        .order_by(PartnerAdresse.ist_primaer.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def create_partner_adresse(
    db: AsyncSession,
    partner_id: UUID,
    mandant_id: UUID,
    *,
    payload: dict[str, Any],
) -> PartnerAdresse:
    await get_partner(db, partner_id, mandant_id)
    if payload.get("ist_primaer"):
        await db.execute(
            update(PartnerAdresse)
            .where(
                PartnerAdresse.partner_id == partner_id,
                PartnerAdresse.mandant_id == mandant_id,
            )
            .values(ist_primaer=False)
        )
    link = PartnerAdresse(
        mandant_id=mandant_id,
        partner_id=partner_id,
        **payload,
    )
    db.add(link)
    await db.flush()
    new_id = link.id
    db.expunge(link)
    return await get_partner_adresse(db, new_id, mandant_id)


async def get_partner_adresse(db: AsyncSession, link_id: UUID, mandant_id: UUID) -> PartnerAdresse:
    stmt = (
        select(PartnerAdresse)
        .where(
            PartnerAdresse.id == link_id,
            PartnerAdresse.mandant_id == mandant_id,
        )
        .options(selectinload(PartnerAdresse.adresse))
    )
    link = (await db.execute(stmt)).scalar_one_or_none()
    if link is None:
        raise PartnerAdresseNotFoundError(f"partner_adresse {link_id} not found")
    return link


async def update_partner_adresse(
    db: AsyncSession,
    link_id: UUID,
    mandant_id: UUID,
    updates: dict[str, Any],
) -> PartnerAdresse:
    link = await get_partner_adresse(db, link_id, mandant_id)
    if updates.get("ist_primaer") is True:
        await db.execute(
            update(PartnerAdresse)
            .where(
                PartnerAdresse.partner_id == link.partner_id,
                PartnerAdresse.mandant_id == mandant_id,
                PartnerAdresse.id != link_id,
            )
            .values(ist_primaer=False)
        )
    for key, value in updates.items():
        if value is not None:
            setattr(link, key, value)
    await db.flush()
    return link


async def delete_partner_adresse(db: AsyncSession, link_id: UUID, mandant_id: UUID) -> None:
    await get_partner_adresse(db, link_id, mandant_id)
    await db.execute(
        delete(PartnerAdresse).where(
            PartnerAdresse.id == link_id,
            PartnerAdresse.mandant_id == mandant_id,
        )
    )
    await db.flush()
