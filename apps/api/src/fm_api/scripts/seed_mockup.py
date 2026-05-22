"""Mockup seed — generiert realistische Demo-Daten für die Joachim-Vorstellung.

Idempotent: Re-Runs sind sicher; existierende Daten werden anhand
einer eindeutigen Bezeichnung erkannt und übersprungen / aktualisiert.

Was wird angelegt (pro Default-Mandant):
- 3 Adressen
- 3 Objekte mit Adresse + 4-stufiger Struktur (Haus → Stockwerk → Einheit)
- 5 Partner (Mieter / Eigentümer / Auftraggeber / Nachunternehmer)
- 2 Techniker-User (max + lisa)
- 2 Projekte
- ca. 15 Tickets mit realistischen Stati, Prios, Fälligkeiten, Wartet-Sub

Usage (im API-Container):
    python -m fm_api.scripts.seed_mockup
"""

import asyncio
import os
import sys
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select

from fm_api.core.security import hash_password
from fm_api.db.session import SessionLocal
from fm_api.models import (
    Adresse,
    Auswahlliste,
    GeschaeftsPartner,
    Haus,
    Mandant,
    Objekt,
    ObjektStockwerk,
    PartnerTyp,
    Projekt,
    Role,
    StockwerkAusrichtung,
    StockwerkEinheit,
    Tickettyp,
    User,
)
from fm_api.models.ticket import Ticket

DEFAULT_TENANT_SLUG = os.environ.get("DEV_TENANT_SLUG", "fm-staging-default")


async def _get_or_create(
    db: Any,
    model: type[Any],
    match: dict[str, Any],
    defaults: dict[str, Any] | None = None,
) -> Any:
    stmt = select(model)
    for k, v in match.items():
        stmt = stmt.where(getattr(model, k) == v)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing
    fields = {**match, **(defaults or {})}
    obj = model(**fields)
    db.add(obj)
    await db.flush()
    return obj


async def _get_auswahlwert_id(db: Any, mandant_id: UUID, liste_key: str, wert_key: str) -> UUID:
    liste = (
        await db.execute(
            select(Auswahlliste).where(
                Auswahlliste.mandant_id == mandant_id, Auswahlliste.key == liste_key
            )
        )
    ).scalar_one()
    for w in liste.werte:
        if w.key == wert_key:
            wert_uuid: UUID = w.id
            return wert_uuid
    raise RuntimeError(f"Auswahlwert {liste_key}/{wert_key} fehlt")


async def main() -> int:
    async with SessionLocal() as db:
        tenant = (
            await db.execute(select(Mandant).where(Mandant.slug == DEFAULT_TENANT_SLUG))
        ).scalar_one_or_none()
        if tenant is None:
            print(f"[mockup-seed] Tenant {DEFAULT_TENANT_SLUG} not found. Run seed_dev first.")
            return 1
        m_id: UUID = tenant.id

        # ---- Rollen + Techniker-User ---------------------------------------
        roles_by_name = {
            r.name: r
            for r in (await db.execute(select(Role).where(Role.mandant_id == m_id))).scalars().all()
        }
        for role_name in ("techniker", "leitstand"):
            if role_name not in roles_by_name:
                r = Role(mandant_id=m_id, name=role_name)
                db.add(r)
                await db.flush()
                roles_by_name[role_name] = r

        tech_users: list[User] = []
        for email, full in [
            ("max@example.com", "Max Müller"),
            ("lisa@example.com", "Lisa Bauer"),
        ]:
            u = (
                await db.execute(select(User).where(User.mandant_id == m_id, User.email == email))
            ).scalar_one_or_none()
            if u is None:
                u = User(
                    mandant_id=m_id,
                    email=email,
                    password_hash=hash_password("demo-pass-2026"),
                    full_name=full,
                    is_active=True,
                    roles=[roles_by_name["techniker"]],
                )
                db.add(u)
                await db.flush()
                print(f"[mockup-seed] user {email}")
            tech_users.append(u)

        # ---- Adressen ------------------------------------------------------
        adressen_data = [
            {"strasse": "Marktplatz", "hausnummer": "1", "plz": "70173", "ort": "Stuttgart"},
            {"strasse": "Königstraße", "hausnummer": "42", "plz": "70173", "ort": "Stuttgart"},
            {
                "strasse": "Heilbronner Straße",
                "hausnummer": "150",
                "plz": "70191",
                "ort": "Stuttgart",
            },
        ]
        adressen: list[Adresse] = []
        for a in adressen_data:
            adr = await _get_or_create(
                db,
                Adresse,
                {"mandant_id": m_id, "strasse": a["strasse"], "hausnummer": a["hausnummer"]},
                defaults={"plz": a["plz"], "ort": a["ort"], "land": "DE"},
            )
            adressen.append(adr)

        # ---- Partner -------------------------------------------------------
        partner_data = [
            ("Bürohaus Marktplatz GmbH", [PartnerTyp.EIGENTUEMER], "info@buerohaus.de"),
            ("Boutique Stein", [PartnerTyp.MIETER], "info@boutique-stein.de"),
            ("Café Sonnenschein", [PartnerTyp.MIETER], "leitung@cafe-sonnenschein.de"),
            ("Elektro Schmidt GmbH", [PartnerTyp.NACHUNTERNEHMER], "service@elektro-schmidt.de"),
            ("Sanitär Klein KG", [PartnerTyp.NACHUNTERNEHMER], "buero@sanitaer-klein.de"),
        ]
        partner_by_name: dict[str, GeschaeftsPartner] = {}
        for name, typen, email in partner_data:
            p = (
                await db.execute(
                    select(GeschaeftsPartner).where(
                        GeschaeftsPartner.mandant_id == m_id, GeschaeftsPartner.name == name
                    )
                )
            ).scalar_one_or_none()
            if p is None:
                p = GeschaeftsPartner(mandant_id=m_id, name=name, email=email, typen=typen)
                db.add(p)
                await db.flush()
                print(f"[mockup-seed] partner {name}")
            partner_by_name[name] = p

        # ---- Objekte mit 4-stufiger Struktur -------------------------------
        async def ensure_objekt(name: str, adresse: Adresse) -> Objekt:
            obj = (
                await db.execute(
                    select(Objekt).where(Objekt.mandant_id == m_id, Objekt.name == name)
                )
            ).scalar_one_or_none()
            if obj is None:
                obj = Objekt(mandant_id=m_id, name=name, adresse_id=adresse.id)
                db.add(obj)
                await db.flush()
                print(f"[mockup-seed] objekt {name}")
            return obj

        async def ensure_haus(objekt: Objekt, bez: str) -> Haus:
            h = (
                await db.execute(
                    select(Haus).where(Haus.objekt_id == objekt.id, Haus.bezeichnung == bez)
                )
            ).scalar_one_or_none()
            if h is None:
                h = Haus(mandant_id=m_id, objekt_id=objekt.id, bezeichnung=bez, reihenfolge=0)
                db.add(h)
                await db.flush()
            return h

        async def ensure_stockwerk(
            haus: Haus, bez: str, ausr: StockwerkAusrichtung | None, reihenfolge: int
        ) -> ObjektStockwerk:
            s = (
                await db.execute(
                    select(ObjektStockwerk).where(
                        ObjektStockwerk.haus_id == haus.id,
                        ObjektStockwerk.bezeichnung == bez,
                    )
                )
            ).scalar_one_or_none()
            if s is None:
                s = ObjektStockwerk(
                    mandant_id=m_id,
                    haus_id=haus.id,
                    bezeichnung=bez,
                    ausrichtung=ausr,
                    reihenfolge=reihenfolge,
                )
                db.add(s)
                await db.flush()
            return s

        async def ensure_einheit(
            stockwerk: ObjektStockwerk, bez: str, qm: int | None, reihenfolge: int
        ) -> StockwerkEinheit:
            e = (
                await db.execute(
                    select(StockwerkEinheit).where(
                        StockwerkEinheit.stockwerk_id == stockwerk.id,
                        StockwerkEinheit.bezeichnung == bez,
                    )
                )
            ).scalar_one_or_none()
            if e is None:
                e = StockwerkEinheit(
                    mandant_id=m_id,
                    stockwerk_id=stockwerk.id,
                    bezeichnung=bez,
                    groesse_qm=qm,
                    reihenfolge=reihenfolge,
                )
                db.add(e)
                await db.flush()
            return e

        obj_marktplatz = await ensure_objekt("Bürohaus Marktplatz", adressen[0])
        obj_koenig = await ensure_objekt("Galerie Königstraße", adressen[1])
        obj_heilbronner = await ensure_objekt("Wohnpark Heilbronner Straße", adressen[2])

        # Struktur Bürohaus Marktplatz: Haupthaus + Hinterhaus
        h_haupt = await ensure_haus(obj_marktplatz, "Haupthaus")
        s_eg = await ensure_stockwerk(h_haupt, "EG", None, 0)
        s_1og = await ensure_stockwerk(h_haupt, "1. OG", StockwerkAusrichtung.SUED, 1)
        s_2og = await ensure_stockwerk(h_haupt, "2. OG", StockwerkAusrichtung.NORD, 2)
        await ensure_einheit(s_eg, "EG-01", 85, 0)
        await ensure_einheit(s_eg, "EG-02", 110, 1)
        await ensure_einheit(s_1og, "1.OG-Süd", 220, 0)
        await ensure_einheit(s_2og, "2.OG-Nord", 180, 0)
        h_hinter = await ensure_haus(obj_marktplatz, "Hinterhaus")
        s_hh_eg = await ensure_stockwerk(h_hinter, "EG", None, 0)
        await ensure_einheit(s_hh_eg, "Werkstatt", 60, 0)

        # Galerie Königstraße: Haupthaus
        h_galerie = await ensure_haus(obj_koenig, "Haupthaus")
        s_g_eg = await ensure_stockwerk(h_galerie, "EG", None, 0)
        await ensure_einheit(s_g_eg, "Boutique", 95, 0)

        # Wohnpark Heilbronner: 2 Häuser
        h_a = await ensure_haus(obj_heilbronner, "Haus A")
        await ensure_stockwerk(h_a, "EG", None, 0)
        await ensure_stockwerk(h_a, "1. OG", StockwerkAusrichtung.OST, 1)
        h_b = await ensure_haus(obj_heilbronner, "Haus B")
        await ensure_stockwerk(h_b, "EG", None, 0)

        # ---- Tickettypen laden ---------------------------------------------
        tt_by_key = {
            t.key: t
            for t in (await db.execute(select(Tickettyp).where(Tickettyp.mandant_id == m_id)))
            .scalars()
            .all()
        }

        # ---- Projekte ------------------------------------------------------
        proj_data = [
            (
                "Sanierung 2. OG Marktplatz",
                "Komplette Sanierung Büroflächen 2. OG",
                obj_marktplatz,
                tech_users[0],
                date.today() - timedelta(days=20),
                date.today() + timedelta(days=60),
                "laufend",
            ),
            (
                "Heizungs-Modernisierung Wohnpark",
                "Austausch der Heizanlage in beiden Häusern",
                obj_heilbronner,
                tech_users[1],
                date.today() + timedelta(days=30),
                date.today() + timedelta(days=180),
                "geplant",
            ),
        ]
        projekte: dict[str, Projekt] = {}
        for name, beschr, obj, verant, start, ende, status in proj_data:
            proj: Projekt | None = (
                await db.execute(
                    select(Projekt).where(Projekt.mandant_id == m_id, Projekt.name == name)
                )
            ).scalar_one_or_none()
            if proj is None:
                proj = Projekt(
                    mandant_id=m_id,
                    name=name,
                    beschreibung=beschr,
                    objekt_id=obj.id,
                    verantwortlich_user_id=verant.id,
                    start_am=start,
                    ende_am=ende,
                    status=status,
                )
                db.add(proj)
                await db.flush()
                print(f"[mockup-seed] projekt {name}")
            projekte[name] = proj

        # ---- Auswahlwert-IDs laden -----------------------------------------
        async def aw(key: str, wert: str) -> UUID:
            return await _get_auswahlwert_id(db, m_id, key, wert)

        s_neu = await aw("ticket_status", "neu")
        s_pruefung = await aw("ticket_status", "pruefung")
        s_bearb = await aw("ticket_status", "bearbeitung")
        s_wartet = await aw("ticket_status", "wartet")
        s_erledigt = await aw("ticket_status", "erledigt")

        p_niedrig = await aw("ticket_prioritaet", "niedrig")
        p_mittel = await aw("ticket_prioritaet", "mittel")
        p_hoch = await aw("ticket_prioritaet", "hoch")
        p_kritisch = await aw("ticket_prioritaet", "kritisch")

        q_telefon = await aw("eingangskanal", "telefon")
        q_ebo = await aw("eingangskanal", "ebo")
        q_web = await aw("eingangskanal", "web")
        q_manuell = await aw("eingangskanal", "manuell")

        wartet_material = await aw("wartet_grund", "material")
        wartet_extern = await aw("wartet_grund", "extern")

        # ---- Tickets -------------------------------------------------------
        admin = (
            await db.execute(
                select(User).where(User.mandant_id == m_id, User.email == "admin@example.com")
            )
        ).scalar_one()

        now = datetime.now(UTC)

        tickets_data: list[dict[str, Any]] = [
            {
                "key": "DEMO-T-001",
                "titel": "Heizung im 2. OG kalt",
                "beschreibung": "Heizung Büro 2.OG-Nord seit Montag kalt. Mieter beschwert sich.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_bearb,
                "prio_id": p_hoch,
                "quelle_id": q_telefon,
                "melder": "Hr. Becker (Mieter, 0711-12345)",
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "stockwerk": s_2og,
                "zugewiesen": tech_users[0],
                "eroeffnet_von": admin,
                "delta_h": 72,
            },
            {
                "key": "DEMO-T-002",
                "titel": "EBO-Alarm: Fühler defekt Heilbronner",
                "beschreibung": "EBO meldet Sensor 24°C-Schwelle überschritten, Haus A 1.OG.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_neu,
                "prio_id": p_kritisch,
                "quelle_id": q_ebo,
                "objekt": obj_heilbronner,
                "haus": h_a,
                "eroeffnet_von": admin,
                "delta_h": 4,
            },
            {
                "key": "DEMO-T-003",
                "titel": "Wasserschaden Boutique Stein",
                "beschreibung": "Aus dem Lager der Boutique tritt Wasser aus. Sofortmaßnahme erforderlich.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_wartet,
                "prio_id": p_kritisch,
                "quelle_id": q_telefon,
                "melder": "Fr. Stein (Mieter, 0173-456789)",
                "objekt": obj_koenig,
                "haus": h_galerie,
                "stockwerk": s_g_eg,
                "zugewiesen": tech_users[1],
                "wartet_grund_id": wartet_extern,
                "wartet_nachunt": partner_by_name["Sanitär Klein KG"],
                "wartet_kontakt_name": "Hr. Klein",
                "wartet_kontakt_telefon": "0711-998877",
                "wartet_kontakt_email": "buero@sanitaer-klein.de",
                "eroeffnet_von": admin,
                "delta_h": 28,
            },
            {
                "key": "DEMO-T-004",
                "titel": "Wartung Heizungsanlage Q2",
                "beschreibung": "Jährliche Inspektion Heizungsanlage durch Servicepartner.",
                "tickettyp": tt_by_key["wartung"],
                "status_id": s_pruefung,
                "prio_id": p_mittel,
                "quelle_id": q_manuell,
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "zugewiesen": tech_users[0],
                "projekt": None,
                "faelligkeit_am": date.today() + timedelta(days=14),
                "wiederholung": "yearly",
                "eroeffnet_von": admin,
                "delta_h": 5 * 24,
            },
            {
                "key": "DEMO-T-005",
                "titel": "Begehung Sanierung 2. OG (KW 19)",
                "beschreibung": "Vor-Ort-Termin mit Bauleitung für Status-Abnahme.",
                "tickettyp": tt_by_key["baubegehung"],
                "status_id": s_bearb,
                "prio_id": p_mittel,
                "quelle_id": q_manuell,
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "stockwerk": s_2og,
                "zugewiesen": tech_users[0],
                "projekt": projekte["Sanierung 2. OG Marktplatz"],
                "faelligkeit_am": date.today() + timedelta(days=7),
                "eroeffnet_von": admin,
                "delta_h": 24,
            },
            {
                "key": "DEMO-T-006",
                "titel": "Aufzug Stillstand 1. OG",
                "beschreibung": "Aufzug Haupthaus klemmt zwischen EG und 1. OG.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_erledigt,
                "prio_id": p_hoch,
                "quelle_id": q_telefon,
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "zugewiesen": tech_users[0],
                "eroeffnet_von": admin,
                "erledigt_am": now - timedelta(hours=12),
                "delta_h": 36,
            },
            {
                "key": "DEMO-T-007",
                "titel": "Tropfender Wasserhahn EG-02",
                "beschreibung": "Mieter EG-02 meldet tropfenden Wasserhahn im WC.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_neu,
                "prio_id": p_niedrig,
                "quelle_id": q_web,
                "melder": "Webformular",
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "stockwerk": s_eg,
                "eroeffnet_von": admin,
                "delta_h": 2,
            },
            {
                "key": "DEMO-T-008",
                "titel": "Materialbestellung Heizkörper",
                "beschreibung": "Heizkörper Wohnpark Haus B EG bestellt — wartet auf Lieferung.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_wartet,
                "prio_id": p_mittel,
                "quelle_id": q_manuell,
                "objekt": obj_heilbronner,
                "haus": h_b,
                "zugewiesen": tech_users[1],
                "wartet_grund_id": wartet_material,
                "wartet_nachunt": partner_by_name["Sanitär Klein KG"],
                "eroeffnet_von": admin,
                "delta_h": 60,
            },
            {
                "key": "DEMO-T-009",
                "titel": "Steckdose Werkstatt funktionslos",
                "beschreibung": "Steckdose in der Werkstatt Hinterhaus reagiert nicht. Vermutlich Sicherung.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_bearb,
                "prio_id": p_mittel,
                "quelle_id": q_telefon,
                "melder": "Hr. Maier (Mieter)",
                "objekt": obj_marktplatz,
                "haus": h_hinter,
                "stockwerk": s_hh_eg,
                "zugewiesen": tech_users[0],
                "eroeffnet_von": admin,
                "delta_h": 6,
            },
            {
                "key": "DEMO-T-010",
                "titel": "Wartung Brandmeldeanlage",
                "beschreibung": "Halbjährliche Wartung BMA durch externe Fachfirma.",
                "tickettyp": tt_by_key["wartung"],
                "status_id": s_neu,
                "prio_id": p_mittel,
                "quelle_id": q_manuell,
                "objekt": obj_koenig,
                "haus": h_galerie,
                "faelligkeit_am": date.today() + timedelta(days=21),
                "wiederholung": "monthly",
                "eroeffnet_von": admin,
                "delta_h": 8,
            },
            {
                "key": "DEMO-T-011",
                "titel": "Wartung Aufzug",
                "beschreibung": "TÜV-Aufzugsprüfung jährlich.",
                "tickettyp": tt_by_key["wartung"],
                "status_id": s_neu,
                "prio_id": p_hoch,
                "quelle_id": q_manuell,
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "faelligkeit_am": date.today() - timedelta(days=3),
                "wiederholung": "yearly",
                "eroeffnet_von": admin,
                "delta_h": 240,
            },
            {
                "key": "DEMO-T-012",
                "titel": "Café-Beschwerde Lüftung",
                "beschreibung": "Café Sonnenschein meldet zu schwache Lüftung in der Küche.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_pruefung,
                "prio_id": p_mittel,
                "quelle_id": q_telefon,
                "melder": "Café Sonnenschein, Hr. Walter",
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "stockwerk": s_eg,
                "zugewiesen": tech_users[1],
                "eroeffnet_von": admin,
                "delta_h": 18,
            },
            {
                "key": "DEMO-T-013",
                "titel": "Schlüsselverlust Boutique",
                "beschreibung": "Mieter hat Generalschlüssel zur Tiefgarage verloren.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_erledigt,
                "prio_id": p_hoch,
                "quelle_id": q_telefon,
                "objekt": obj_koenig,
                "haus": h_galerie,
                "zugewiesen": tech_users[0],
                "eroeffnet_von": admin,
                "erledigt_am": now - timedelta(days=2),
                "delta_h": 48,
            },
            {
                "key": "DEMO-T-014",
                "titel": "EBO Störung: Drucksensor Heizung",
                "beschreibung": "EBO meldet anormalen Druckabfall in Heizungsleitung Marktplatz.",
                "tickettyp": tt_by_key["reparatur"],
                "status_id": s_pruefung,
                "prio_id": p_hoch,
                "quelle_id": q_ebo,
                "objekt": obj_marktplatz,
                "haus": h_haupt,
                "eroeffnet_von": admin,
                "delta_h": 16,
            },
            {
                "key": "DEMO-T-015",
                "titel": "Begehung Heizungs-Modernisierung",
                "beschreibung": "Aufnahme Bestand vor Modernisierung Heilbronner Wohnpark.",
                "tickettyp": tt_by_key["baubegehung"],
                "status_id": s_neu,
                "prio_id": p_mittel,
                "quelle_id": q_manuell,
                "objekt": obj_heilbronner,
                "haus": h_a,
                "projekt": projekte["Heizungs-Modernisierung Wohnpark"],
                "faelligkeit_am": date.today() + timedelta(days=28),
                "eroeffnet_von": admin,
                "delta_h": 30,
            },
        ]

        created = 0
        for td in tickets_data:
            # Idempotenz: Titel pro Mandant ist demoeindeutig
            exists = (
                await db.execute(
                    select(Ticket).where(
                        Ticket.mandant_id == m_id,
                        Ticket.titel == td["titel"],
                        Ticket.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if exists is not None:
                continue
            t = Ticket(
                mandant_id=m_id,
                nummer=0,  # filled by Postgres trigger set_ticket_nummer()
                titel=td["titel"],
                beschreibung=td["beschreibung"],
                tickettyp_id=td["tickettyp"].id if td.get("tickettyp") else None,
                status_id=td["status_id"],
                prioritaet_id=td["prio_id"],
                quelle_id=td.get("quelle_id"),
                melder=td.get("melder"),
                objekt_id=td["objekt"].id if td.get("objekt") else None,
                haus_id=td["haus"].id if td.get("haus") else None,
                stockwerk_id=td["stockwerk"].id if td.get("stockwerk") else None,
                eroeffnet_von_id=td["eroeffnet_von"].id,
                zugewiesen_an_id=td["zugewiesen"].id if td.get("zugewiesen") else None,
                projekt_id=td["projekt"].id if td.get("projekt") else None,
                faelligkeit_am=td.get("faelligkeit_am"),
                wiederholung=td.get("wiederholung"),
                wartet_grund_id=td.get("wartet_grund_id"),
                wartet_nachunternehmer_id=td["wartet_nachunt"].id
                if td.get("wartet_nachunt")
                else None,
                wartet_kontakt_name=td.get("wartet_kontakt_name"),
                wartet_kontakt_telefon=td.get("wartet_kontakt_telefon"),
                wartet_kontakt_email=td.get("wartet_kontakt_email"),
                eroeffnet_am=now - timedelta(hours=td["delta_h"]),
                erledigt_am=td.get("erledigt_am"),
                zugewiesen_am=now - timedelta(hours=td["delta_h"] - 1)
                if td.get("zugewiesen")
                else None,
            )
            db.add(t)
            created += 1
        await db.flush()
        print(f"[mockup-seed] tickets: {created} neu (gesamt geplant: {len(tickets_data)})")

        await db.commit()
        print("[mockup-seed] done.")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
