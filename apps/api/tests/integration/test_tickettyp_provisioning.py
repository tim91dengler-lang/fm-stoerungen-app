"""Stufe C C2: Provisioning der Default-Vorlagen + Alles-Vorlage-Mechanik.

Deckt H1 (Provisioning verdrahtet) und H2 (System-Vorlagen bekommen Felder/Blöcke)
sowie die Auto-Mitführung neuer Felder durch die Alles-Vorlage ab.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from fm_api.models import Tickettyp, TickettypFeld
from fm_api.services import tickettyp_service as svc


async def _load_vorlagen(db, mandant_id) -> list[Tickettyp]:
    rows = (
        await db.execute(
            select(Tickettyp)
            .where(Tickettyp.mandant_id == mandant_id)
            .options(selectinload(Tickettyp.felder), selectinload(Tickettyp.bloecke))
            .execution_options(populate_existing=True)
        )
    ).scalars()
    return list(rows)


async def _load_alles(db, mandant_id) -> Tickettyp:
    return (
        await db.execute(
            select(Tickettyp)
            .where(Tickettyp.mandant_id == mandant_id, Tickettyp.ist_alles_vorlage.is_(True))
            .options(selectinload(Tickettyp.felder), selectinload(Tickettyp.bloecke))
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


@pytest.mark.integration
async def test_alles_vorlage_adoptiert_vorhandenen_key(db, mandant) -> None:
    # Alt-Daten/Slug-Kollision: eine Vorlage trägt bereits key='alle-felder', ist
    # aber NICHT als Alles-Vorlage markiert. ensure_alles darf NICHT crashen
    # (IntegrityError auf uq_tickettypen_mandant_id_key), sondern adoptieren.
    existing = Tickettyp(
        mandant_id=mandant.id,
        key=svc.ALLES_VORLAGE_KEY,
        label="Alle Felder",
        ist_system=False,
        ist_alles_vorlage=False,
        aktiv=True,
    )
    db.add(existing)
    await db.flush()

    await svc.ensure_alles_vorlage_vollstaendig(db, mandant.id)

    alles = await _load_alles(db, mandant.id)  # scalar_one → es darf genau eine geben
    assert alles.key == svc.ALLES_VORLAGE_KEY
    assert alles.ist_alles_vorlage is True
    assert len(alles.felder) > 0  # leer adoptiert → Reconcile füllt den Katalog


@pytest.mark.integration
async def test_ensure_default_vorlagen_seedet_system_mit_feldern_und_bloecken(db, mandant) -> None:
    await svc.ensure_default_vorlagen(db, mandant.id)
    rows = await _load_vorlagen(db, mandant.id)
    by_key = {t.key: t for t in rows}

    # Die 3 System-Vorlagen existieren UND haben jetzt Felder + Blöcke (H2).
    for k in ("reparatur", "wartung", "baubegehung"):
        assert k in by_key, k
        assert len(by_key[k].felder) == 19, k
        assert len(by_key[k].bloecke) == 7, k

    # Genau eine Alles-Vorlage.
    alles = [t for t in rows if t.ist_alles_vorlage]
    assert len(alles) == 1


@pytest.mark.integration
async def test_alles_vorlage_enthaelt_alle_felder_sichtbar(db, mandant) -> None:
    await svc.ensure_default_vorlagen(db, mandant.id)
    alles = await _load_alles(db, mandant.id)

    katalog_keys = {fk for fk, *_ in svc.DEFAULT_SYSTEM_FELDER}
    assert {f.feld_key for f in alles.felder} == katalog_keys
    # Alles-Vorlage: jedes Feld sichtbar (enthält-alles-Garantie).
    assert all(f.sichtbar for f in alles.felder)
    # Jedes Feld einem Block zugeordnet.
    assert all(f.block_id is not None for f in alles.felder)


@pytest.mark.integration
async def test_alles_vorlage_reconcile_fuellt_fehlendes_feld(db, mandant) -> None:
    """Proxy für 'neues Katalog-Feld': ein entferntes Feld wird beim Reconcile
    automatisch wieder aufgenommen; zweiter Lauf ändert nichts (idempotent)."""
    await svc.ensure_default_vorlagen(db, mandant.id)
    alles = await _load_alles(db, mandant.id)

    target = next(f for f in alles.felder if f.feld_key == "fehlercode")
    await db.delete(target)
    await db.flush()

    changed = await svc.ensure_alles_vorlage_vollstaendig(db, mandant.id)
    assert changed is True
    alles2 = await _load_alles(db, mandant.id)
    assert "fehlercode" in {f.feld_key for f in alles2.felder}

    # Zweiter Reconcile: kein Delta.
    changed_again = await svc.ensure_alles_vorlage_vollstaendig(db, mandant.id)
    assert changed_again is False


@pytest.mark.integration
async def test_ensure_default_vorlagen_idempotent(db, mandant) -> None:
    await svc.ensure_default_vorlagen(db, mandant.id)
    await svc.ensure_default_vorlagen(db, mandant.id)
    rows = await _load_vorlagen(db, mandant.id)

    # Keine Duplikate: 3 System + 1 Alles.
    assert len([t for t in rows if t.ist_alles_vorlage]) == 1
    by_key = {t.key: t for t in rows}
    assert len(by_key["reparatur"].felder) == 19
    assert len(by_key["reparatur"].bloecke) == 7


@pytest.mark.integration
async def test_reconcile_hebt_felderlose_altvorlage(db, mandant) -> None:
    """H2: eine vor Stufe C ohne Felder angelegte Vorlage bekommt Felder + Blöcke."""
    legacy = Tickettyp(
        mandant_id=mandant.id, key="legacy", label="Legacy", ist_system=True, aktiv=True
    )
    db.add(legacy)
    await db.flush()
    legacy_id = legacy.id

    await svc.ensure_default_vorlagen(db, mandant.id)

    reloaded = (
        await db.execute(
            select(Tickettyp)
            .where(Tickettyp.id == legacy_id)
            .options(selectinload(Tickettyp.felder), selectinload(Tickettyp.bloecke))
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert len(reloaded.felder) == 19
    assert len(reloaded.bloecke) == 7


@pytest.mark.integration
async def test_reconcile_fuellt_teilbefuellte_altvorlage(db, mandant) -> None:
    """H2-Folge: eine Vorlage mit nur 1 Feld (Alt-Seed) wird auf den vollen Katalog
    gehoben — sonst rendert die datengetriebene Engine sparse."""
    legacy = Tickettyp(
        mandant_id=mandant.id, key="legacy1", label="Legacy1", ist_system=True, aktiv=True
    )
    db.add(legacy)
    await db.flush()
    db.add(
        TickettypFeld(
            tickettyp_id=legacy.id,
            feld_key="titel",
            label="Titel",
            ist_system_feld=True,
            sichtbar=True,
            pflicht=True,
            reihenfolge=0,
        )
    )
    await db.flush()
    legacy_id = legacy.id

    await svc.ensure_default_vorlagen(db, mandant.id)

    reloaded = (
        await db.execute(
            select(Tickettyp)
            .where(Tickettyp.id == legacy_id)
            .options(selectinload(Tickettyp.felder), selectinload(Tickettyp.bloecke))
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert len(reloaded.felder) == 19
    assert len(reloaded.bloecke) == 7
    # titel bleibt erhalten (nicht dupliziert)
    assert sum(1 for f in reloaded.felder if f.feld_key == "titel") == 1
