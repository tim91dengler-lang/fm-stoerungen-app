from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.models import Tickettyp, TickettypBlock, TickettypFeld


class TickettypNotFoundError(Exception):
    pass


class SystemTickettypProtectedError(Exception):
    """Tickettyp mit ist_system=TRUE darf nicht gelöscht werden."""


class TickettypKeyConflictError(Exception):
    """Key ist bereits für einen anderen Tickettyp im Mandanten vergeben."""


class TickettypFeldNotFoundError(Exception):
    pass


class LayoutValidationError(Exception):
    """Ungültiges Layout (z.B. abhängiges Feld sichtbar, Eltern-Feld ausgeblendet)."""


# Geschützte Blöcke: nie löschbar (Stufe C, Tim-Entscheidung 2: System-Blöcke
# außer kopf/weitere sind frei löschbar). kopf trägt das Kernfeld, weitere ist
# der Auffang-Block.
PROTECTED_BLOCK_KEYS: frozenset[str] = frozenset({"kopf", "weitere"})
# Reservierter Key der selbst-wachsenden Alles-Vorlage. Darf nicht für eine
# User-Vorlage vergeben werden (Label „Alle Felder" slugt sonst dorthin und
# kollidiert beim Provisioning) — siehe create_tickettyp + ensure_alles_vorlage.
ALLES_VORLAGE_KEY = "alle-felder"

# Eltern-Sichtbarkeit (H4): ist ein abhängiges Feld sichtbar, müssen alle seine
# Eltern ebenfalls sichtbar sein — sonst entsteht eine unbedienbare Vorlage
# (z.B. Grundriss-Pin ohne sichtbares Stockwerk).
FELD_PARENTS: dict[str, tuple[str, ...]] = {
    "haus": ("objekt",),
    "stockwerk": ("objekt", "haus"),
    "einheit": ("objekt", "haus", "stockwerk"),
    "anlage": ("objekt",),
    "fehlercode": ("objekt", "anlage"),
    "pin": ("objekt", "haus", "stockwerk"),
}


# Kernfelder, die in jeder Vorlage fix bleiben (Konzept "Das Ticket",
# Tim 2026-05-31, Entscheidung A): Titel ist nicht abwählbar und immer
# Pflicht. Status ist kein Designer-Feld und damit ohnehin immer vorhanden.
# Synchron halten zu KERNFELD_KEYS im Frontend (VorlagePreviewFelder.tsx).
KERNFELD_KEYS: frozenset[str] = frozenset({"titel"})


# System-Tickettypen (Slice 1) — ursprünglich nur von Migration 0006 pro
# damals existierendem Mandanten geseedet. Als idempotenter Provisioning-
# Helper hier, damit auch neu (per seed_dev) angelegte Mandanten sie bekommen.
# Werte identisch zu 0006.
SYSTEM_TICKETTYPEN: list[dict[str, Any]] = [
    {
        "key": "reparatur",
        "label": "Reparatur",
        "beschreibung": "Standard-Reparatur-Ticket",
        "icon": "wrench",
        "farbe": "emerald",
        "pflichtfelder": ["titel"],
        "default_reminder_tage": 0,
        "reihenfolge": 0,
    },
    {
        "key": "wartung",
        "label": "Wartung",
        "beschreibung": "Geplante Wartung mit Fälligkeit",
        "icon": "calendar",
        "farbe": "blue",
        "pflichtfelder": ["titel", "faelligkeit_am"],
        "default_reminder_tage": 7,
        "reihenfolge": 1,
    },
    {
        "key": "baubegehung",
        "label": "Baubegehung",
        "beschreibung": "Termingebundene Begehung",
        "icon": "binoculars",
        "farbe": "amber",
        "pflichtfelder": ["titel", "faelligkeit_am"],
        "default_reminder_tage": 3,
        "reihenfolge": 2,
    },
]


async def ensure_system_tickettypen(db: AsyncSession, mandant_id: UUID) -> None:
    """Lege die System-Tickettypen (Reparatur/Wartung/Baubegehung) idempotent an.

    Ursprünglich nur von Migration 0006 für damals existierende Mandanten
    geseedet — neu angelegte Mandanten bekamen sie nicht. Wird daher beim
    Provisioning (seed_dev) und im Mockup-Seed aufgerufen.

    Stufe C (2026-06-01, H2): neu angelegte System-Vorlagen bekommen jetzt auch
    ihre Blöcke + die 19 Default-Felder — sonst kollabieren sie im datengetriebenen
    Renderer (alle Felder im Auffang-Block). Alt-Vorlagen ohne Felder werden über
    ``ensure_default_vorlagen`` / ``_reconcile_vorlage_layout`` nachgezogen.
    """
    existing_keys = set(
        (await db.execute(select(Tickettyp.key).where(Tickettyp.mandant_id == mandant_id)))
        .scalars()
        .all()
    )
    for cfg in SYSTEM_TICKETTYPEN:
        if cfg["key"] in existing_keys:
            continue
        tt = Tickettyp(mandant_id=mandant_id, ist_system=True, **cfg)
        db.add(tt)
        await db.flush()  # tt.id
        await _seed_bloecke_und_felder(db, tt.id)
    await db.flush()


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
    # Adresse-Feld (2026-06-01): steuert das frei wählbare Ticket-Adressfeld
    # (eigene/Objekt-Adresse + Maps). Reihenfolge 19 = ans Ende des Katalogs,
    # sortiert sich im Designer hinter die übrigen (Layout ist block-basiert).
    ("adresse", "Adresse", True, False, 19),
    ("anlage", "Anlage", True, False, 5),
    # feld_key bleibt "partner" (Bestandskompatibilität), steuert aber den
    # Beteiligte-Block (mehrere Kontakte) — daher Label "Beteiligte".
    ("partner", "Beteiligte", True, False, 6),
    ("kategorie", "Kategorie", True, False, 7),
    ("prio", "Priorität", True, False, 8),
    ("pin", "Foto-Pin", True, False, 9),
    # "melder" entfernt 2026-06-01: durch die Beteiligten-Liste abgelöst (Tim).
    ("quelle", "Eingangskanal", True, False, 11),
    ("beschreibung", "Beschreibung", True, True, 12),
    ("foto", "Foto", True, False, 13),
    ("dokumente", "Dokumente", True, False, 14),
    ("projekt", "Projekt", True, False, 15),
    ("faelligkeit_am", "Fälligkeitsdatum", True, False, 16),
    ("wiederholung", "Wiederholung", True, False, 17),
    ("fehlercode", "Fehlercode", True, False, 18),
]


# Stufe C: Default-Block-Layout je Vorlage. (block_key, label, region, reihenfolge,
# ist_system_block). Gespiegelt aus dem heutigen Ticket-Layout (TicketDetailPanel).
# kopf + weitere sind geschützt (nicht löschbar); chat ist ein fester Engine-Slot,
# kein Designer-Block. Reihenfolge ist je Region.
SYSTEM_BLOECKE: list[tuple[str, str, str, int, bool]] = [
    ("kopf", "Kopf", "links", 0, True),
    ("problem", "Problem & Bearbeitung", "links", 1, False),
    ("beteiligte", "Kontakt & Beteiligte", "links", 2, False),
    ("verortung", "Verortung", "links", 3, False),
    ("klassifizierung", "Klassifizierung", "links", 4, False),
    ("belege", "Belege & Kommunikation", "rechts", 0, False),
    ("weitere", "Weitere Felder", "links", 5, True),
]

# Default-Zuordnung feld_key → block_key. Ungemappte/Custom-Felder → "weitere".
FALLBACK_BLOCK_KEY = "weitere"
DEFAULT_FELD_BLOCK_MAP: dict[str, str] = {
    "titel": "kopf",
    "beschreibung": "problem",
    "faelligkeit_am": "problem",
    "wiederholung": "problem",
    "partner": "beteiligte",
    "objekt": "verortung",
    "haus": "verortung",
    "stockwerk": "verortung",
    "einheit": "verortung",
    "adresse": "verortung",
    "anlage": "verortung",
    "pin": "verortung",
    "prio": "klassifizierung",
    "kategorie": "klassifizierung",
    "quelle": "klassifizierung",
    "projekt": "klassifizierung",
    "fehlercode": "klassifizierung",
    "foto": "belege",
    "dokumente": "belege",
}


def _seed_bloecke(db: AsyncSession, tickettyp_id: UUID) -> dict[str, TickettypBlock]:
    """Legt die System-Blöcke für eine Vorlage an und gibt block_key→Block zurück."""
    by_key: dict[str, TickettypBlock] = {}
    for block_key, label, region, reihenfolge, ist_system in SYSTEM_BLOECKE:
        block = TickettypBlock(
            tickettyp_id=tickettyp_id,
            block_key=block_key,
            label=label,
            region=region,
            reihenfolge=reihenfolge,
            ist_system_block=ist_system,
        )
        db.add(block)
        by_key[block_key] = block
    return by_key


def _seed_default_felder(
    db: AsyncSession, tickettyp_id: UUID, block_by_key: dict[str, TickettypBlock]
) -> None:
    """Legt die 19 System-Felder block-lokal an (reihenfolge = Index im Block)."""
    block_counter: dict[str, int] = {}
    for feld_key, label, sichtbar, pflicht, _alt_reihenfolge in DEFAULT_SYSTEM_FELDER:
        block_key = DEFAULT_FELD_BLOCK_MAP.get(feld_key, FALLBACK_BLOCK_KEY)
        idx = block_counter.get(block_key, 0)
        block_counter[block_key] = idx + 1
        db.add(
            TickettypFeld(
                tickettyp_id=tickettyp_id,
                feld_key=feld_key,
                label=label,
                ist_system_feld=True,
                sichtbar=sichtbar,
                pflicht=pflicht,
                reihenfolge=idx,
                block_id=block_by_key[block_key].id,
            )
        )


async def _seed_bloecke_und_felder(db: AsyncSession, tickettyp_id: UUID) -> None:
    """System-Blöcke + 19 Default-Felder für eine frische Vorlage."""
    block_by_key = _seed_bloecke(db, tickettyp_id)
    await db.flush()  # block.id verfügbar
    _seed_default_felder(db, tickettyp_id, block_by_key)
    await db.flush()


_LOAD_OPTIONS = (selectinload(Tickettyp.felder), selectinload(Tickettyp.bloecke))


async def _reconcile_vorlage_layout(db: AsyncSession, tickettyp: Tickettyp) -> None:
    """Hebt eine Alt-Vorlage ohne Blöcke/Felder auf das Stufe-C-Layout (H2).

    Erwartet ``tickettyp`` mit geladenen ``felder``/``bloecke`` (via _LOAD_OPTIONS).
    Fehlende System-Blöcke werden ergänzt; eine felderlose Vorlage bekommt die 19
    Default-Felder.
    """
    block_by_key = {b.block_key: b for b in tickettyp.bloecke}
    seeded_block = False
    for block_key, label, region, reihenfolge, ist_system in SYSTEM_BLOECKE:
        if block_key not in block_by_key:
            nb = TickettypBlock(
                tickettyp_id=tickettyp.id,
                block_key=block_key,
                label=label,
                region=region,
                reihenfolge=reihenfolge,
                ist_system_block=ist_system,
            )
            db.add(nb)
            block_by_key[block_key] = nb
            seeded_block = True
    if seeded_block:
        await db.flush()

    # Fehlende Katalog-Felder ergänzen — NICHT nur 0-Feld-Vorlagen, auch teilbefüllte
    # Alt-Seeds (z.B. nur "titel") auf den vollen Katalog heben. Sonst rendert die
    # datengetriebene Engine die Vorlage sparse, während der Alt-Pfad (Default-sichtbar)
    # alle Felder zeigt. Block-lokale reihenfolge wird ans Ende des Blocks angehängt.
    have = {f.feld_key for f in tickettyp.felder}
    block_id_to_key = {b.id: b.block_key for b in block_by_key.values()}
    next_idx: dict[str, int] = {}
    for f in tickettyp.felder:
        if f.block_id is None:
            continue
        bk = block_id_to_key.get(f.block_id)
        if bk is not None:
            next_idx[bk] = max(next_idx.get(bk, -1), f.reihenfolge)
    changed = False
    for feld_key, label, sichtbar, pflicht, _alt in DEFAULT_SYSTEM_FELDER:
        if feld_key in have:
            continue
        target_key = DEFAULT_FELD_BLOCK_MAP.get(feld_key, FALLBACK_BLOCK_KEY)
        block = block_by_key.get(target_key) or block_by_key[FALLBACK_BLOCK_KEY]
        idx = next_idx.get(block.block_key, -1) + 1
        next_idx[block.block_key] = idx
        db.add(
            TickettypFeld(
                tickettyp_id=tickettyp.id,
                feld_key=feld_key,
                label=label,
                ist_system_feld=True,
                sichtbar=sichtbar,
                pflicht=pflicht,
                reihenfolge=idx,
                block_id=block.id,
            )
        )
        changed = True
    if changed:
        await db.flush()


async def ensure_alles_vorlage_vollstaendig(db: AsyncSession, mandant_id: UUID) -> bool:
    """Erzeugt/ergänzt die Alles-Vorlage des Mandanten — sie enthält ALLE
    Katalog-Felder und nimmt neue automatisch auf (Set-Diff, idempotent).

    Gibt True zurück, wenn etwas geändert wurde (für lazy-on-read-Reload).
    """
    stmt = (
        select(Tickettyp)
        .where(Tickettyp.mandant_id == mandant_id, Tickettyp.ist_alles_vorlage.is_(True))
        .options(*_LOAD_OPTIONS)
        # gegen stale identity-mapped Collections in derselben Session reconcilen.
        .execution_options(populate_existing=True)
    )
    av = (await db.execute(stmt)).scalar_one_or_none()
    if av is None:
        # Robust gegen eine bereits vorhandene Vorlage mit dem reservierten Key
        # (z. B. Alt-Daten): adoptieren statt blind INSERT — sonst IntegrityError
        # auf uq_tickettypen_mandant_id_key, der den ganzen Provision-Lauf killt.
        existing = await get_tickettyp_by_key(db, mandant_id, ALLES_VORLAGE_KEY)
        if existing is not None:
            existing.ist_alles_vorlage = True
            av = existing
            # fällt in den Reconcile-Zweig unten (ergänzt fehlende Blöcke/Felder)
        else:
            av = Tickettyp(
                mandant_id=mandant_id,
                key=ALLES_VORLAGE_KEY,
                label="Alle Felder",
                beschreibung="Enthält automatisch alle verfügbaren Felder.",
                ist_system=False,
                ist_alles_vorlage=True,
                aktiv=True,
            )
            db.add(av)
            await db.flush()
            await _seed_bloecke_und_felder(db, av.id)
            return True

    # Reconcile: fehlende System-Blöcke + fehlende Katalog-Felder ergänzen.
    block_by_key = {b.block_key: b for b in av.bloecke}
    seeded_block = False
    for block_key, label, region, reihenfolge, ist_system in SYSTEM_BLOECKE:
        if block_key not in block_by_key:
            nb = TickettypBlock(
                tickettyp_id=av.id,
                block_key=block_key,
                label=label,
                region=region,
                reihenfolge=reihenfolge,
                ist_system_block=ist_system,
            )
            db.add(nb)
            block_by_key[block_key] = nb
            seeded_block = True
    if seeded_block:
        await db.flush()

    have = {f.feld_key for f in av.felder}
    # block-lokaler Start-Index = aktueller Max-Wert je Block (Anhängen am Ende).
    block_id_to_key = {b.id: b.block_key for b in block_by_key.values()}
    next_idx: dict[str, int] = {}
    for f in av.felder:
        if f.block_id is None:
            continue
        bk = block_id_to_key.get(f.block_id)
        if bk is not None:
            next_idx[bk] = max(next_idx.get(bk, -1), f.reihenfolge)

    changed = False
    for feld_key, label, _sichtbar, pflicht, _alt in DEFAULT_SYSTEM_FELDER:
        if feld_key in have:
            continue
        target_key = DEFAULT_FELD_BLOCK_MAP.get(feld_key, FALLBACK_BLOCK_KEY)
        block = block_by_key.get(target_key) or block_by_key[FALLBACK_BLOCK_KEY]
        idx = next_idx.get(block.block_key, -1) + 1
        next_idx[block.block_key] = idx
        db.add(
            TickettypFeld(
                tickettyp_id=av.id,
                feld_key=feld_key,
                label=label,
                ist_system_feld=True,
                sichtbar=True,  # Alles-Vorlage: immer sichtbar (enthält-alles-Garantie)
                pflicht=pflicht,
                reihenfolge=idx,
                block_id=block.id,
            )
        )
        changed = True
    if changed:
        await db.flush()
    return changed


async def ensure_default_vorlagen(db: AsyncSession, mandant_id: UUID) -> None:
    """Provisioning-Einstieg (Stufe C): System-Vorlagen (mit Feldern/Blöcken) +
    Alles-Vorlage idempotent sicherstellen. In seed_dev/seed_mockup nach den
    Auswahllisten aufrufen (löst ``ensure_system_tickettypen`` als Einstieg ab).
    """
    await ensure_system_tickettypen(db, mandant_id)
    # Alt-Vorlagen ohne Blöcke/Felder nachziehen (H2).
    stmt = (
        select(Tickettyp)
        .where(Tickettyp.mandant_id == mandant_id)
        .options(*_LOAD_OPTIONS)
        .execution_options(populate_existing=True)
    )
    for tt in (await db.execute(stmt)).scalars().all():
        # Reconcile ist idempotent (ergänzt nur fehlende Blöcke/Felder) — auch
        # teilbefüllte Alt-Seeds (z.B. nur "titel") auf den vollen Katalog heben.
        await _reconcile_vorlage_layout(db, tt)
    await ensure_alles_vorlage_vollstaendig(db, mandant_id)


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
        # populate_existing: get_tickettyp ist der Post-Mutation-Read (create/update/
        # save_layout schreiben + lesen in DERSELBEN Session). Ohne Refresh lieferte
        # selectinload die stale identity-mapped felder/bloecke-Collection zurück.
        .execution_options(populate_existing=True)
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if item is None:
        raise TickettypNotFoundError(f"tickettyp {tickettyp_id} not found")
    # Lazy-on-read: die Alles-Vorlage nimmt fehlende Katalog-Felder beim Öffnen auf
    # (schreibt nur bei echtem Delta; danach neu laden).
    if item.ist_alles_vorlage and await ensure_alles_vorlage_vollstaendig(db, mandant_id):
        item = (
            await db.execute(stmt.execution_options(populate_existing=True))
        ).scalar_one_or_none()
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
    if payload.get("key") == ALLES_VORLAGE_KEY:
        raise TickettypKeyConflictError(
            f"Der Key '{ALLES_VORLAGE_KEY}' ist für die Alles-Vorlage reserviert."
        )
    item = Tickettyp(mandant_id=mandant_id, ist_system=False, **payload)
    db.add(item)
    try:
        await db.flush()
    except IntegrityError as exc:
        # Häufigster Fall: UniqueConstraint uq_tickettypen_mandant_id_key
        await db.rollback()
        raise TickettypKeyConflictError(
            f"Tickettyp-Key '{payload.get('key')}' ist bereits vergeben."
        ) from exc

    # Stufe C: System-Blöcke + 19 Default-Felder block-lokal anlegen.
    await _seed_bloecke_und_felder(db, item.id)
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

    # Stufe C: Blöcke der Quelle klonen (NEUE IDs) und die Feld→Block-Zuordnung
    # auf die neuen Blöcke remappen — nie auf die Block-IDs der Quelle zeigen.
    src_block_id_to_key = {b.id: b.block_key for b in source.bloecke}
    new_block_by_key: dict[str, TickettypBlock] = {}
    for src_block in source.bloecke:
        nb = TickettypBlock(
            tickettyp_id=item.id,
            block_key=src_block.block_key,
            label=src_block.label,
            region=src_block.region,
            reihenfolge=src_block.reihenfolge,
            ist_system_block=src_block.ist_system_block,
            collapsible_default_open=src_block.collapsible_default_open,
        )
        db.add(nb)
        new_block_by_key[src_block.block_key] = nb
    await db.flush()

    for src_feld in source.felder:
        src_key = src_block_id_to_key.get(src_feld.block_id) if src_feld.block_id else None
        new_block = new_block_by_key.get(src_key) if src_key else None
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
                block_id=new_block.id if new_block else None,
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
    if feld.feld_key in KERNFELD_KEYS:
        # Kernfeld: nie versteckt oder optional — unabhängig von der Payload.
        feld.sichtbar = True
        feld.pflicht = True
    await db.flush()
    return feld


# ---- Layout-Save (Stufe C: Blöcke + Feld→Block in einem Rutsch) ----


async def save_layout(
    db: AsyncSession, mandant_id: UUID, tickettyp_id: UUID, layout: dict[str, Any]
) -> Tickettyp:
    """Transaktionaler Designer-Save: Blöcke + Feld→Block-Zuordnung einer Vorlage.

    Identifikation über ``block_key``/``feld_key`` — NUR innerhalb dieser Vorlage
    aufgelöst (IDOR-sicher: kein Cross-Vorlage-/Cross-Mandant-Reparenting möglich,
    weil keine fremden IDs referenzierbar sind). Erzwungen werden: Kernfeld-Schutz
    (titel sichtbar+pflicht, Block kopf), Alles-Vorlage-Lock (alle Felder sichtbar)
    und die Eltern-Sichtbarkeits-Regel (H4).
    """
    tt = await get_tickettyp(db, mandant_id, tickettyp_id)
    is_alles = tt.ist_alles_vorlage
    bloecke = layout.get("bloecke", [])
    felder = layout.get("felder", [])

    # ---- Eltern-Sichtbarkeits-Validierung (H4) — vor jedem Schreiben ----
    known_feld_keys = {f.feld_key for f in tt.felder}
    sichtbar_map = {f.feld_key: f.sichtbar for f in tt.felder}
    for fw in felder:
        if fw["feld_key"] in known_feld_keys:
            sichtbar_map[fw["feld_key"]] = bool(fw["sichtbar"])
    if not is_alles:
        for child, parents in FELD_PARENTS.items():
            if sichtbar_map.get(child):
                missing = [p for p in parents if not sichtbar_map.get(p, False)]
                if missing:
                    raise LayoutValidationError(
                        f"Feld '{child}' ist sichtbar, benötigt aber sichtbare Felder: "
                        f"{', '.join(missing)}."
                    )

    # ---- Blöcke reconcilen (by block_key, scoped to this tickettyp) ----
    existing_blocks = {b.block_key: b for b in tt.bloecke}
    payload_keys = {b["block_key"] for b in bloecke}
    for bw in bloecke:
        blk = existing_blocks.get(bw["block_key"])
        if blk is None:
            blk = TickettypBlock(
                tickettyp_id=tt.id,
                block_key=bw["block_key"],
                label=bw["label"],
                region=bw["region"],
                reihenfolge=bw["reihenfolge"],
                ist_system_block=False,
                collapsible_default_open=bw.get("collapsible_default_open", True),
            )
            db.add(blk)
            existing_blocks[bw["block_key"]] = blk
        else:
            # Geschützte System-Blöcke (kopf/weitere) sind Anker: Label/Region/
            # Reihenfolge bleiben fix, egal was der Payload schickt. Nur das
            # Aufklapp-Verhalten ist anpassbar.
            if bw["block_key"] not in PROTECTED_BLOCK_KEYS:
                blk.label = bw["label"]
                blk.region = bw["region"]
                blk.reihenfolge = bw["reihenfolge"]
            blk.collapsible_default_open = bw.get("collapsible_default_open", True)
    # Nicht mehr enthaltene Blöcke löschen (außer geschützt).
    for bkey, blk in list(existing_blocks.items()):
        if bkey not in payload_keys and bkey not in PROTECTED_BLOCK_KEYS:
            await db.delete(blk)
            del existing_blocks[bkey]
    # Geschützte Blöcke immer vorhalten (Fallback-Ziele für Kernfeld + Auffang).
    for pkey, plabel, preg, prh in (
        ("kopf", "Kopf", "links", 0),
        ("weitere", "Weitere Felder", "links", 99),
    ):
        if pkey not in existing_blocks:
            blk = TickettypBlock(
                tickettyp_id=tt.id,
                block_key=pkey,
                label=plabel,
                region=preg,
                reihenfolge=prh,
                ist_system_block=True,
            )
            db.add(blk)
            existing_blocks[pkey] = blk
    await db.flush()  # ids für neue Blöcke

    # ---- Felder reconcilen ----
    existing_felder = {f.feld_key: f for f in tt.felder}
    for fw in felder:
        feld = existing_felder.get(fw["feld_key"])
        if feld is None:
            continue  # unbekannter feld_key → ignorieren (keine neuen System-Felder)
        target = existing_blocks.get(fw["block_key"]) or existing_blocks["weitere"]
        feld.block_id = target.id
        feld.reihenfolge = fw["reihenfolge"]
        feld.sichtbar = True if is_alles else bool(fw["sichtbar"])
        feld.pflicht = bool(fw["pflicht"])
        if fw.get("label"):
            feld.label = fw["label"]
        if feld.feld_key in KERNFELD_KEYS:
            feld.sichtbar = True
            feld.pflicht = True
            feld.block_id = existing_blocks["kopf"].id
    await db.flush()
    return await get_tickettyp(db, mandant_id, tt.id)
