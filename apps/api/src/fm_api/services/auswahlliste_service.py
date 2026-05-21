from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Auswahlliste, AuswahllistenWert


class AuswahllisteNotFoundError(Exception):
    pass


class AuswahllistenWertNotFoundError(Exception):
    pass


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
