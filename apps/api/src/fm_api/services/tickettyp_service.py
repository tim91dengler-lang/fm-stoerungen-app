from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Tickettyp, TickettypFeld


class TickettypNotFoundError(Exception):
    pass


class SystemTickettypProtectedError(Exception):
    """Tickettyp mit ist_system=TRUE darf nicht gelöscht werden."""


class TickettypFeldNotFoundError(Exception):
    pass


# Default-Konfiguration der 19 System-Felder für neue User-Vorlagen.
# Tim 2026-05-26 (Track-2-Spec §4.1): alle sichtbar, nur Titel +
# Beschreibung sind Pflicht — der Admin entscheidet im Designer den Rest
# pro Vorlage. Reihenfolge orientiert sich an der reparatur-Vorlage aus
# Migration 0009 (sinnvolle Default-Anordnung).
DEFAULT_SYSTEM_FELDER: list[tuple[str, str, bool, bool, int]] = [
    # (feld_key, label, sichtbar, pflicht, reihenfolge)
    ("titel", "Titel", True, True, 0),
    ("objekt", "Objekt", True, False, 1),
    ("haus", "Haus", True, False, 2),
    ("stockwerk", "Stockwerk", True, False, 3),
    ("einheit", "Einheit", True, False, 4),
    ("anlage", "Anlage", True, False, 5),
    ("partner", "Partner", True, False, 6),
    ("kategorie", "Kategorie", True, False, 7),
    ("prio", "Priorität", True, False, 8),
    ("pin", "Foto-Pin", True, False, 9),
    ("melder", "Melder", True, False, 10),
    ("quelle", "Eingangskanal", True, False, 11),
    ("beschreibung", "Beschreibung", True, True, 12),
    ("foto", "Foto", True, False, 13),
    ("dokumente", "Dokumente", True, False, 14),
    ("projekt", "Projekt", True, False, 15),
    ("faelligkeit_am", "Fälligkeitsdatum", True, False, 16),
    ("wiederholung", "Wiederholung", True, False, 17),
    ("fehlercode", "Fehlercode", True, False, 18),
]


_LOAD_OPTIONS = (selectinload(Tickettyp.felder),)


async def list_tickettypen(
    db: AsyncSession, mandant_id: UUID, *, aktiv_only: bool = False
) -> list[Tickettyp]:
    stmt = (
        select(Tickettyp)
        .where(Tickettyp.mandant_id == mandant_id)
        .options(*_LOAD_OPTIONS)
        .order_by(Tickettyp.reihenfolge, Tickettyp.label)
    )
    if aktiv_only:
        stmt = stmt.where(Tickettyp.aktiv.is_(True))
    return list((await db.execute(stmt)).scalars().all())


async def get_tickettyp(db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID) -> Tickettyp:
    stmt = (
        select(Tickettyp)
        .where(
            Tickettyp.id == tickettyp_id,
            Tickettyp.mandant_id == mandant_id,
        )
        .options(*_LOAD_OPTIONS)
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise TickettypNotFoundError(f"tickettyp {tickettyp_id} not found")
    return item


async def get_tickettyp_by_key(db: AsyncSession, mandant_id: UUID, key: str) -> Tickettyp | None:
    stmt = (
        select(Tickettyp)
        .where(
            Tickettyp.mandant_id == mandant_id,
            Tickettyp.key == key,
        )
        .options(*_LOAD_OPTIONS)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_tickettyp(
    db: AsyncSession, mandant_id: UUID, *, payload: dict[str, Any]
) -> Tickettyp:
    item = Tickettyp(mandant_id=mandant_id, ist_system=False, **payload)
    db.add(item)
    await db.flush()

    # Seed 19 System-Felder mit Default-Konfiguration (Spec §4.1)
    for feld_key, label, sichtbar, pflicht, reihenfolge in DEFAULT_SYSTEM_FELDER:
        db.add(
            TickettypFeld(
                tickettyp_id=item.id,
                feld_key=feld_key,
                label=label,
                ist_system_feld=True,
                sichtbar=sichtbar,
                pflicht=pflicht,
                reihenfolge=reihenfolge,
            )
        )
    await db.flush()
    return await get_tickettyp(db, mandant_id, item.id)


async def update_tickettyp(
    db: AsyncSession,
    mandant_id: UUID,
    tickettyp_id: UUID,
    updates: dict[str, Any],
) -> Tickettyp:
    item = await get_tickettyp(db, mandant_id, tickettyp_id)
    for key, value in updates.items():
        if value is None and key in ("label",):
            continue
        setattr(item, key, value)
    await db.flush()
    return await get_tickettyp(db, mandant_id, item.id)


async def delete_tickettyp(db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID) -> None:
    item = await get_tickettyp(db, mandant_id, tickettyp_id)
    if item.ist_system:
        raise SystemTickettypProtectedError(
            f"tickettyp '{item.key}' is system-managed and cannot be deleted"
        )
    await db.delete(item)
    await db.flush()


async def duplicate_tickettyp(db: AsyncSession, mandant_id: UUID, source_id: UUID) -> Tickettyp:
    """Klont eine bestehende Vorlage 1:1, inkl. aller Feld-Configs.

    Tim 2026-05-26 (Track-2-Spec §4.2). Neuer Key wird mit kleinstem
    freien Suffix erzeugt (`<src.key>-kopie-1`, `-kopie-2`, …). Label
    erhält " (Kopie)"-Suffix. Kopie ist immer `ist_system=False` und
    `aktiv=True`, unabhängig von der Quelle.
    """
    source = await get_tickettyp(db, mandant_id, source_id)

    new_key = await _next_kopie_key(db, mandant_id, source.key)

    item = Tickettyp(
        mandant_id=mandant_id,
        key=new_key,
        label=f"{source.label} (Kopie)",
        beschreibung=source.beschreibung,
        icon=source.icon,
        farbe=source.farbe,
        pflichtfelder=list(source.pflichtfelder),
        default_reminder_tage=source.default_reminder_tage,
        reihenfolge=source.reihenfolge,
        ist_system=False,
        aktiv=True,
    )
    db.add(item)
    await db.flush()

    for src_feld in source.felder:
        db.add(
            TickettypFeld(
                tickettyp_id=item.id,
                feld_key=src_feld.feld_key,
                label=src_feld.label,
                ist_system_feld=src_feld.ist_system_feld,
                sichtbar=src_feld.sichtbar,
                pflicht=src_feld.pflicht,
                nur_admin_sichtbar=src_feld.nur_admin_sichtbar,
                reihenfolge=src_feld.reihenfolge,
            )
        )
    await db.flush()
    return await get_tickettyp(db, mandant_id, item.id)


async def _next_kopie_key(db: AsyncSession, mandant_id: UUID, source_key: str) -> str:
    """Findet den kleinsten freien `<source_key>-kopie-N`-Slug."""
    n = 1
    while True:
        candidate = f"{source_key}-kopie-{n}"
        existing = await get_tickettyp_by_key(db, mandant_id, candidate)
        if existing is None:
            return candidate
        n += 1


# ---- Felder (System-Feld-Sichtbar/Pflicht/Reihenfolge je Vorlage) ----


async def update_tickettyp_feld(
    db: AsyncSession,
    mandant_id: UUID,
    tickettyp_id: UUID,
    feld_key: str,
    updates: dict[str, Any],
) -> TickettypFeld:
    # Authorize tickettyp belongs to mandant
    await get_tickettyp(db, mandant_id, tickettyp_id)
    stmt = select(TickettypFeld).where(
        TickettypFeld.tickettyp_id == tickettyp_id,
        TickettypFeld.feld_key == feld_key,
    )
    feld = (await db.execute(stmt)).scalar_one_or_none()
    if feld is None:
        raise TickettypFeldNotFoundError(f"feld '{feld_key}' not found on tickettyp {tickettyp_id}")
    for key, value in updates.items():
        if value is None:
            continue
        setattr(feld, key, value)
    await db.flush()
    return feld
