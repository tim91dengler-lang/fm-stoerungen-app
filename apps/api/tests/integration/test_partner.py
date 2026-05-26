import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_create_and_list_partner(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    eig = str(partner_typ_uuids["eigentuemer"])
    auf = str(partner_typ_uuids["auftraggeber"])

    res = await client.post(
        "/api/v1/partner",
        headers=headers,
        json={
            "name": "Wohnungsbau GmbH",
            "email": "kontakt@wohnungsbau.example",
            "telefon": "+49 30 12345678",
            "mobil": "+49 171 1234567",
            "telefax": "+49 30 99999999",
            "typen": [eig, auf],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Wohnungsbau GmbH"
    assert body["mobil"] == "+49 171 1234567"
    assert body["telefax"] == "+49 30 99999999"
    assert set(body["typen"]) == {eig, auf}

    listed = await client.get("/api/v1/partner", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1


@pytest.mark.integration
async def test_filter_partner_by_typ(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    mieter_id = str(partner_typ_uuids["mieter"])
    nach_id = str(partner_typ_uuids["nachunternehmer"])

    await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": "Mieter A", "typen": [mieter_id]},
    )
    await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": "Subunternehmer B", "typen": [nach_id]},
    )

    res = await client.get(f"/api/v1/partner?typ={mieter_id}", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(p["name"] == "Mieter A" for p in items)
    assert not any(p["name"] == "Subunternehmer B" for p in items)


@pytest.mark.integration
async def test_soft_delete_partner_hides_from_list(
    client, admin_user, partner_typ_uuids
) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    nach_id = str(partner_typ_uuids["nachunternehmer"])
    create = await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": "To-Delete GmbH", "typen": [nach_id]},
    )
    pid = create.json()["id"]

    await client.delete(f"/api/v1/partner/{pid}", headers=headers)

    listed = await client.get("/api/v1/partner", headers=headers)
    assert not any(p["id"] == pid for p in listed.json()["items"])

    detail = await client.get(f"/api/v1/partner/{pid}", headers=headers)
    assert detail.status_code == 404


@pytest.mark.integration
async def test_partner_requires_auth(client) -> None:
    assert (await client.get("/api/v1/partner")).status_code == 401


# ----- Track 3: neue Read-Endpoints ----------------------------------------


@pytest.mark.integration
async def test_partner_hierarchie_mutter_kind(
    client, admin_user, partner_typ_uuids
) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    eig = str(partner_typ_uuids["eigentuemer"])

    mutter = (
        await client.post(
            "/api/v1/partner",
            headers=headers,
            json={"name": "Müller Holding AG", "typen": [eig]},
        )
    ).json()
    kind = (
        await client.post(
            "/api/v1/partner",
            headers=headers,
            json={
                "name": "Müller München",
                "typen": [eig],
                "parent_partner_id": mutter["id"],
            },
        )
    ).json()

    res = await client.get(f"/api/v1/partner/{kind['id']}/hierarchie", headers=headers)
    assert res.status_code == 200
    tree = res.json()
    assert tree["root"]["id"] == mutter["id"]
    assert tree["root"]["ist_root"] is True
    assert tree["root"]["ist_aktueller_partner"] is False
    children = tree["root"]["children"]
    assert any(c["id"] == kind["id"] and c["ist_aktueller_partner"] for c in children)


@pytest.mark.integration
async def test_partner_objekte_endpoint(
    client, admin_user, partner_typ_uuids, db
) -> None:
    from fm_api.models import Objekt, ObjektPartner
    from fm_api.models.partner import PartnerTyp

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    eig = str(partner_typ_uuids["eigentuemer"])

    partner = (
        await client.post(
            "/api/v1/partner",
            headers=headers,
            json={"name": "Eigentümer GmbH", "typen": [eig]},
        )
    ).json()

    me = (await client.get("/api/v1/users/me", headers=headers)).json()
    mandant_id = me["mandant_id"]

    obj = Objekt(mandant_id=mandant_id, name="Bürohaus Schwabing")
    db.add(obj)
    await db.flush()
    db.add(
        ObjektPartner(
            objekt_id=obj.id,
            partner_id=partner["id"],
            rolle=PartnerTyp.EIGENTUEMER,
        )
    )
    await db.commit()

    res = await client.get(f"/api/v1/partner/{partner['id']}/objekte", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["objekt_name"] == "Bürohaus Schwabing"
    assert "eigentuemer" in items[0]["rollen"]


@pytest.mark.integration
async def test_partner_tickets_endpoint_filters_erledigt(
    client, admin_user, partner_typ_uuids, db
) -> None:
    from datetime import UTC, datetime

    from sqlalchemy import select

    from fm_api.models import AuswahllistenWert, Ticket

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    eig = str(partner_typ_uuids["eigentuemer"])

    partner = (
        await client.post(
            "/api/v1/partner",
            headers=headers,
            json={"name": "Auftraggeber", "typen": [eig]},
        )
    ).json()

    me = (await client.get("/api/v1/users/me", headers=headers)).json()
    mandant_id = me["mandant_id"]
    user_id = me["id"]

    async def _wert_id(liste_key: str, wert_key: str) -> str:
        return str(
            (
                await db.execute(
                    select(AuswahllistenWert.id).where(
                        AuswahllistenWert.key == wert_key,
                        AuswahllistenWert.auswahlliste.has(
                            key=liste_key, mandant_id=mandant_id
                        ),
                    )
                )
            ).scalar_one()
        )

    neu_id = await _wert_id("ticket_status", "neu")
    erledigt_id = await _wert_id("ticket_status", "erledigt")
    mittel_id = await _wert_id("ticket_prioritaet", "mittel")

    db.add(
        Ticket(
            mandant_id=mandant_id,
            titel="Offenes Ticket",
            status_id=neu_id,
            prioritaet_id=mittel_id,
            partner_id=partner["id"],
            eroeffnet_von_id=user_id,
            eroeffnet_am=datetime.now(UTC),
        )
    )
    db.add(
        Ticket(
            mandant_id=mandant_id,
            titel="Erledigtes Ticket",
            status_id=erledigt_id,
            prioritaet_id=mittel_id,
            partner_id=partner["id"],
            eroeffnet_von_id=user_id,
            eroeffnet_am=datetime.now(UTC),
        )
    )
    await db.commit()

    # Default: nur offene
    res = await client.get(f"/api/v1/partner/{partner['id']}/tickets", headers=headers)
    assert res.status_code == 200
    titles = [t["titel"] for t in res.json()]
    assert "Offenes Ticket" in titles
    assert "Erledigtes Ticket" not in titles

    # include_erledigt=true: beide
    res2 = await client.get(
        f"/api/v1/partner/{partner['id']}/tickets?include_erledigt=true",
        headers=headers,
    )
    titles2 = [t["titel"] for t in res2.json()]
    assert "Offenes Ticket" in titles2
    assert "Erledigtes Ticket" in titles2


@pytest.mark.integration
async def test_partner_projekte_endpoint_transitiv(
    client, admin_user, partner_typ_uuids, db
) -> None:
    from sqlalchemy import select

    from fm_api.models import (
        AuswahllistenWert,
        Objekt,
        ObjektPartner,
        Projekt,
        ProjektObjektLink,
    )
    from fm_api.models.partner import PartnerTyp

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    eig = str(partner_typ_uuids["eigentuemer"])

    partner = (
        await client.post(
            "/api/v1/partner",
            headers=headers,
            json={"name": "Konzern AG", "typen": [eig]},
        )
    ).json()
    me = (await client.get("/api/v1/users/me", headers=headers)).json()
    mandant_id = me["mandant_id"]

    obj = Objekt(mandant_id=mandant_id, name="BÜZ Schwabing")
    db.add(obj)
    await db.flush()
    db.add(
        ObjektPartner(
            objekt_id=obj.id,
            partner_id=partner["id"],
            rolle=PartnerTyp.EIGENTUEMER,
        )
    )

    projekttyp_id = (
        await db.execute(
            select(AuswahllistenWert.id).where(
                AuswahllistenWert.key == "sanierung",
                AuswahllistenWert.auswahlliste.has(
                    key="projekttyp", mandant_id=mandant_id
                ),
            )
        )
    ).scalar_one()
    status_id = (
        await db.execute(
            select(AuswahllistenWert.id).where(
                AuswahllistenWert.key == "aktiv",
                AuswahllistenWert.auswahlliste.has(
                    key="projektstatus", mandant_id=mandant_id
                ),
            )
        )
    ).scalar_one()
    projekt = Projekt(
        mandant_id=mandant_id,
        name="Sanierung Schwabing 2026",
        projekttyp_id=projekttyp_id,
        status_id=status_id,
    )
    db.add(projekt)
    await db.flush()
    db.add(
        ProjektObjektLink(
            projekt_id=projekt.id, objekt_id=obj.id, mandant_id=mandant_id
        )
    )
    await db.commit()

    res = await client.get(f"/api/v1/partner/{partner['id']}/projekte", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["name"] == "Sanierung Schwabing 2026"
    assert "eigentuemer" in items[0]["rollen_an_objekten"]
