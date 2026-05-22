from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Auswahlliste, AuswahllistenWert


class AuswahllisteNotFoundError(Exception):
    pass


class AuswahllistenWertNotFoundError(Exception):
    pass


class DuplicateAuswahllisteError(Exception):
    pass


class DuplicateAuswahllistenWertError(Exception):
    pass


class SystemEntryProtectedError(Exception):
    """ist_system=TRUE Listen/Werte dürfen nicht gelöscht oder umbenannt werden."""


async def get_liste_by_key(db: AsyncSession, mandant_id: UUID, liste_key: str) -> Auswahlliste:
    stmt = (
        select(Auswahlliste)
        .where(
            Auswahlliste.mandant_id == mandant_id,
            Auswahlliste.key == liste_key,
        )
        .options(selectinload(Auswahlliste.werte))
    )
    liste = (await db.execute(stmt)).scalar_one_or_none()
    if liste is None:
        raise AuswahllisteNotFoundError(
            f"auswahlliste '{liste_key}' for mandant {mandant_id} not found"
        )
    return liste


async def get_liste_by_id(db: AsyncSession, mandant_id: UUID, liste_id: UUID) -> Auswahlliste:
    stmt = (
        select(Auswahlliste)
        .where(
            Auswahlliste.id == liste_id,
            Auswahlliste.mandant_id == mandant_id,
        )
        .options(selectinload(Auswahlliste.werte))
    )
    liste = (await db.execute(stmt)).scalar_one_or_none()
    if liste is None:
        raise AuswahllisteNotFoundError(f"auswahlliste {liste_id} not found")
    return liste


async def get_wert_by_key(
    db: AsyncSession, mandant_id: UUID, liste_key: str, wert_key: str
) -> AuswahllistenWert:
    """Lookup eines konkreten Werts über (mandant, liste_key, wert_key).

    Tolerant gegen Groß-/Kleinschreibung, da die DB-Slugs lowercased sind.
    """
    stmt = (
        select(AuswahllistenWert)
        .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
        .where(
            Auswahlliste.mandant_id == mandant_id,
            Auswahlliste.key == liste_key,
            AuswahllistenWert.key == wert_key.lower(),
        )
    )
    wert = (await db.execute(stmt)).scalar_one_or_none()
    if wert is None:
        raise AuswahllistenWertNotFoundError(
            f"wert '{wert_key}' in liste '{liste_key}' for mandant {mandant_id} not found"
        )
    return wert


async def get_wert_by_id(
    db: AsyncSession, mandant_id: UUID, wert_id: UUID, expected_liste_key: str
) -> AuswahllistenWert:
    """Hole einen Wert via id; verifiziere dass er zur erwarteten Liste + zum Mandanten gehört."""
    stmt = (
        select(AuswahllistenWert)
        .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
        .where(
            AuswahllistenWert.id == wert_id,
            Auswahlliste.mandant_id == mandant_id,
            Auswahlliste.key == expected_liste_key,
        )
    )
    wert = (await db.execute(stmt)).scalar_one_or_none()
    if wert is None:
        raise AuswahllistenWertNotFoundError(
            f"wert {wert_id} not found in liste '{expected_liste_key}' for mandant {mandant_id}"
        )
    return wert


async def list_listen(
    db: AsyncSession, mandant_id: UUID, *, search: str | None = None
) -> list[Auswahlliste]:
    base = (
        select(Auswahlliste)
        .where(Auswahlliste.mandant_id == mandant_id)
        .options(selectinload(Auswahlliste.werte))
    )
    if search:
        like = f"%{search.lower()}%"
        base = base.where(
            func.lower(Auswahlliste.key).like(like) | func.lower(Auswahlliste.label).like(like)
        )
    base = base.order_by(desc(Auswahlliste.ist_system), Auswahlliste.label)
    return list((await db.execute(base)).scalars().unique().all())


async def create_liste(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    key: str,
    label: str,
    beschreibung: str | None,
) -> Auswahlliste:
    liste = Auswahlliste(
        mandant_id=mandant_id,
        key=key.lower(),
        label=label,
        beschreibung=beschreibung,
        ist_system=False,
    )
    db.add(liste)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise DuplicateAuswahllisteError(
            f"auswahlliste with key '{key}' already exists for mandant {mandant_id}"
        ) from exc
    await db.refresh(liste, ["werte"])
    return liste


async def update_liste(
    db: AsyncSession,
    mandant_id: UUID,
    liste_id: UUID,
    updates: dict[str, Any],
) -> Auswahlliste:
    liste = await get_liste_by_id(db, mandant_id, liste_id)
    if liste.ist_system:
        raise SystemEntryProtectedError(
            f"auswahlliste '{liste.key}' is system-managed and cannot be modified"
        )
    if "label" in updates and updates["label"] is not None:
        liste.label = updates["label"]
    if "beschreibung" in updates:
        liste.beschreibung = updates["beschreibung"]
    await db.flush()
    await db.refresh(liste, ["werte"])
    return liste


async def delete_liste(db: AsyncSession, mandant_id: UUID, liste_id: UUID) -> None:
    liste = await get_liste_by_id(db, mandant_id, liste_id)
    if liste.ist_system:
        raise SystemEntryProtectedError(
            f"auswahlliste '{liste.key}' is system-managed and cannot be deleted"
        )
    await db.delete(liste)
    await db.flush()


async def add_wert(
    db: AsyncSession,
    mandant_id: UUID,
    liste_id: UUID,
    *,
    key: str,
    label: str,
    reihenfolge: int = 0,
    farbe: str | None = None,
    ist_aktiv: bool = True,
    meta: dict[str, Any] | None = None,
) -> AuswahllistenWert:
    # Liste-Zugehörigkeit + Mandanten-Scoping prüfen
    await get_liste_by_id(db, mandant_id, liste_id)

    wert = AuswahllistenWert(
        auswahlliste_id=liste_id,
        key=key.lower(),
        label=label,
        reihenfolge=reihenfolge,
        farbe=farbe,
        ist_aktiv=ist_aktiv,
        ist_system=False,
        meta=meta,
    )
    db.add(wert)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise DuplicateAuswahllistenWertError(
            f"wert with key '{key}' already exists in liste {liste_id}"
        ) from exc
    await db.refresh(wert)
    return wert


async def update_wert(
    db: AsyncSession,
    mandant_id: UUID,
    wert_id: UUID,
    updates: dict[str, Any],
) -> AuswahllistenWert:
    # Scoping: Wert über Join auf Auswahlliste mit mandant_id-Filter ermitteln
    stmt = (
        select(AuswahllistenWert)
        .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
        .where(
            AuswahllistenWert.id == wert_id,
            Auswahlliste.mandant_id == mandant_id,
        )
    )
    wert = (await db.execute(stmt)).scalar_one_or_none()
    if wert is None:
        raise AuswahllistenWertNotFoundError(f"wert {wert_id} not found")
    if wert.ist_system:
        raise SystemEntryProtectedError(
            f"wert '{wert.key}' is system-managed and cannot be modified"
        )
    if "label" in updates and updates["label"] is not None:
        wert.label = updates["label"]
    if "reihenfolge" in updates and updates["reihenfolge"] is not None:
        wert.reihenfolge = updates["reihenfolge"]
    if "farbe" in updates:
        wert.farbe = updates["farbe"]
    if "ist_aktiv" in updates and updates["ist_aktiv"] is not None:
        wert.ist_aktiv = updates["ist_aktiv"]
    if "meta" in updates:
        wert.meta = updates["meta"]
    await db.flush()
    await db.refresh(wert)
    return wert


async def delete_wert(db: AsyncSession, mandant_id: UUID, wert_id: UUID) -> None:
    stmt = (
        select(AuswahllistenWert)
        .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
        .where(
            AuswahllistenWert.id == wert_id,
            Auswahlliste.mandant_id == mandant_id,
        )
    )
    wert = (await db.execute(stmt)).scalar_one_or_none()
    if wert is None:
        raise AuswahllistenWertNotFoundError(f"wert {wert_id} not found")
    if wert.ist_system:
        raise SystemEntryProtectedError(
            f"wert '{wert.key}' is system-managed and cannot be deleted"
        )
    await db.delete(wert)
    await db.flush()


# ---------------------------------------------------------------------------
# System-Seed (idempotent) — wird sowohl von der Alembic-Migration als auch
# vom seed_dev-Skript bei Anlage eines neuen Mandanten verwendet.
# ---------------------------------------------------------------------------

SYSTEM_AUSWAHLLISTEN_SEED: dict[str, dict[str, Any]] = {
    "ticket_status": {
        "label": "Ticket-Status",
        "beschreibung": "Status-Werte für Tickets",
        "ist_system": True,
        "werte": [
            ("neu", "Neu", 0, "slate", True),
            ("pruefung", "In Prüfung", 1, "amber", True),
            ("bearbeitung", "In Bearbeitung", 2, "blue", True),
            ("wartet", "Wartet", 3, "orange", True),
            ("erledigt", "Erledigt", 4, "emerald", True),
        ],
    },
    "ticket_prioritaet": {
        "label": "Ticket-Priorität",
        "beschreibung": "Prioritäten für Tickets",
        "ist_system": True,
        "werte": [
            ("niedrig", "Niedrig", 0, "slate", True),
            ("mittel", "Mittel", 1, "blue", True),
            ("hoch", "Hoch", 2, "orange", True),
            ("kritisch", "Kritisch", 3, "red", True),
        ],
    },
    "ticket_kategorie": {
        "label": "Ticket-Kategorie",
        "beschreibung": "Gewerk / Kategorie der Störung",
        "ist_system": False,
        "werte": [
            ("heizung", "Heizung", 0, "red", False),
            ("sanitaer", "Sanitär", 1, "cyan", False),
            ("elektro", "Elektro", 2, "yellow", False),
            ("aufzug", "Aufzug", 3, "purple", False),
            ("sicherheit", "Sicherheit", 4, "rose", False),
            ("allgemein", "Allgemein", 5, "slate", False),
        ],
    },
    "wartet_grund": {
        "label": "Wartet-auf-Sub-Status",
        "beschreibung": "Sub-Status wenn Ticket auf etwas wartet",
        "ist_system": True,
        "werte": [
            ("material", "Wartet auf Material", 0, "orange", True),
            ("mieter", "Wartet auf Mieter", 1, "amber", True),
            ("freigabe", "Wartet auf Freigabe", 2, "sky", True),
            ("extern", "Wartet auf Externen", 3, "red", True),
        ],
    },
    "eingangskanal": {
        "label": "Eingangskanal",
        "beschreibung": "Quelle der Ticket-Erfassung",
        "ist_system": True,
        "werte": [
            ("manuell", "Manuell", 0, "slate", True),
            ("telefon", "Telefon", 1, "blue", True),
            ("web", "Web-Formular", 2, "emerald", True),
            ("mieter", "Mieter-Portal", 3, "violet", True),
            ("ebo", "EBO / GLT", 4, "orange", True),
        ],
    },
}


async def ensure_system_auswahllisten(db: AsyncSession, mandant_id: UUID) -> None:
    """Lege die drei Standard-Auswahllisten (Status/Priorität/Kategorie) idempotent an.

    Wird beim ersten Anlegen eines Mandanten aufgerufen — und schadet auch
    danach nichts, weil pro existierender Liste/Wert die ON CONFLICT-Logik
    via DB-Constraint die Duplikate verhindert (wir machen einen vorgelagerten
    SELECT für den Häufigfall, dass bereits geseeded wurde).
    """
    existing_keys = set(
        (await db.execute(select(Auswahlliste.key).where(Auswahlliste.mandant_id == mandant_id)))
        .scalars()
        .all()
    )

    for liste_key, cfg in SYSTEM_AUSWAHLLISTEN_SEED.items():
        if liste_key in existing_keys:
            continue
        liste = Auswahlliste(
            mandant_id=mandant_id,
            key=liste_key,
            label=cfg["label"],
            beschreibung=cfg["beschreibung"],
            ist_system=cfg["ist_system"],
        )
        db.add(liste)
        await db.flush()
        for wert_key, label, reihenfolge, farbe, ist_system in cfg["werte"]:
            db.add(
                AuswahllistenWert(
                    auswahlliste_id=liste.id,
                    key=wert_key,
                    label=label,
                    reihenfolge=reihenfolge,
                    farbe=farbe,
                    ist_system=ist_system,
                )
            )
    await db.flush()
