"""Konfigurierbarer Status-Übergangs-Workflow für Tickets.

Die erlaubten Übergänge ("von Status X → erlaubte Ziel-Status") sind keine
Code-Konstante mehr, sondern frei in den Stammdaten pflegbar — gespeichert je
Status-Wert in ``AuswahllistenWert.meta.erlaubte_uebergaenge`` (Konzept
"Das Ticket" §6.1, Tim 2026-05-31, Entscheidung #1 + C).

Solange ein Mandant die Matrix nicht angepasst hat (meta leer), greift
``DEFAULT_UEBERGAENGE`` — bewusst verhaltenserhaltend zum bisherigen Stand:
alles erlaubt außer Übergängen aus "erledigt" (Wiedereröffnen ist ein
expliziter Admin-Schritt, per Matrix-UI aktivierbar). Damit ist keine
Daten-Migration nötig.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fm_api.models import Auswahlliste, AuswahllistenWert

LISTE_KEY_STATUS = "ticket_status"
META_KEY = "erlaubte_uebergaenge"

DEFAULT_UEBERGAENGE: dict[str, list[str]] = {
    "neu": ["pruefung", "bearbeitung", "wartet", "erledigt"],
    "pruefung": ["neu", "bearbeitung", "wartet", "erledigt"],
    "bearbeitung": ["neu", "pruefung", "wartet", "erledigt"],
    "wartet": ["neu", "pruefung", "bearbeitung", "erledigt"],
    "erledigt": [],
}


async def get_status_werte(db: AsyncSession, mandant_id: UUID) -> list[AuswahllistenWert]:
    stmt = (
        select(AuswahllistenWert)
        .join(Auswahlliste, AuswahllistenWert.auswahlliste_id == Auswahlliste.id)
        .where(
            Auswahlliste.mandant_id == mandant_id,
            Auswahlliste.key == LISTE_KEY_STATUS,
        )
        .order_by(AuswahllistenWert.reihenfolge)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_uebergaenge(db: AsyncSession, mandant_id: UUID) -> dict[str, list[str]]:
    """Erlaubte Ziel-Status je Quell-Status. Fallback auf DEFAULT_UEBERGAENGE,
    solange ``meta.erlaubte_uebergaenge`` nicht gesetzt ist."""
    werte = await get_status_werte(db, mandant_id)
    result: dict[str, list[str]] = {}
    for w in werte:
        meta = w.meta or {}
        roh = meta.get(META_KEY)
        if isinstance(roh, list):
            result[w.key] = [str(s) for s in roh]
        else:
            result[w.key] = list(DEFAULT_UEBERGAENGE.get(w.key, []))
    return result


async def is_transition_allowed(
    db: AsyncSession, mandant_id: UUID, from_slug: str, to_slug: str
) -> bool:
    if from_slug == to_slug:
        return True
    matrix = await get_uebergaenge(db, mandant_id)
    return to_slug in matrix.get(from_slug, [])


async def set_uebergaenge(
    db: AsyncSession, mandant_id: UUID, matrix: dict[str, list[str]]
) -> dict[str, list[str]]:
    """Schreibt die Matrix in ``meta.erlaubte_uebergaenge`` je Status-Wert.

    Beschreibt bewusst auch System-Werte (nur das meta-Feld) und geht daher
    NICHT über ``auswahlliste_service.update_wert`` (das System-Werte schützt).
    Selbst-Übergänge und unbekannte Keys werden herausgefiltert.
    """
    werte = await get_status_werte(db, mandant_id)
    gueltige_keys = {w.key for w in werte}
    for w in werte:
        if w.key not in matrix:
            # Nicht im Payload enthalten → unverändert lassen (partielles Update).
            continue
        ziele = [s for s in matrix[w.key] if s in gueltige_keys and s != w.key]
        # Neues Dict zuweisen, damit SQLAlchemy die JSONB-Änderung erkennt.
        new_meta = dict(w.meta or {})
        new_meta[META_KEY] = ziele
        w.meta = new_meta
    await db.flush()
    return await get_uebergaenge(db, mandant_id)
