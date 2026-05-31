import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_partner(client, headers, typ_id, *, name, **extra) -> str:
    res = await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": name, "typen": [str(typ_id)], **extra},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_kontakt(client, headers, partner_id, **fields) -> str:
    res = await client.post(
        f"/api/v1/partner/{partner_id}/kontakte",
        headers=headers,
        json=fields,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.integration
async def test_create_ticket_with_beteiligter_resolves_partner_contact(
    client, admin_user, partner_typ_uuids
) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    partner_id = await _create_partner(
        client,
        headers,
        partner_typ_uuids["auftraggeber"],
        name="Hausverwaltung Meier GmbH",
        email="info@meier.example",
        telefon="0711 123",
    )

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Aufzug klemmt",
            "beteiligte": [
                {
                    "partner_id": partner_id,
                    "rolle": "melder",
                    "ist_hauptkontakt": True,
                }
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert len(body["beteiligte"]) == 1
    b = body["beteiligte"][0]
    assert b["partner"]["id"] == partner_id
    assert b["rolle"]["key"] == "melder"
    assert b["ist_hauptkontakt"] is True
    assert b["kontakt"] is None
    # Kontaktdaten fallen auf Partner-Stamm zurück
    assert b["email"] == "info@meier.example"
    assert b["telefon"] == "0711 123"


@pytest.mark.integration
async def test_beteiligter_with_kontakt_uses_kontakt_contact(
    client, admin_user, partner_typ_uuids
) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    partner_id = await _create_partner(
        client,
        headers,
        partner_typ_uuids["auftraggeber"],
        name="Firma mit Ansprechpartner",
        email="zentrale@firma.example",
    )
    kontakt_id = await _create_kontakt(
        client,
        headers,
        partner_id,
        vorname="Erika",
        nachname="Musterfrau",
        email="erika@firma.example",
        mobil="0151 999",
    )

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Heizung kalt",
            "beteiligte": [
                {
                    "partner_id": partner_id,
                    "partner_kontakt_id": kontakt_id,
                    "rolle": "auftraggeber",
                }
            ],
        },
    )
    assert res.status_code == 201, res.text
    b = res.json()["beteiligte"][0]
    assert b["kontakt"]["id"] == kontakt_id
    assert b["kontakt"]["name"] == "Erika Musterfrau"
    # Ansprechpartner-Kontaktdaten haben Vorrang vor Partner-Stamm
    assert b["email"] == "erika@firma.example"
    assert b["mobil"] == "0151 999"


@pytest.mark.integration
async def test_update_reconciles_beteiligte(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    p1 = await _create_partner(
        client, headers, partner_typ_uuids["auftraggeber"], name="Partner Eins"
    )
    p2 = await _create_partner(
        client, headers, partner_typ_uuids["nachunternehmer"], name="Partner Zwei"
    )

    created = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Reconcile-Test",
            "beteiligte": [{"partner_id": p1, "rolle": "melder"}],
        },
    )
    assert created.status_code == 201, created.text
    ticket_id = created.json()["id"]
    bid = created.json()["beteiligte"][0]["id"]

    # Bestehende Zeile aktualisieren (Rolle ändern) + neue hinzufügen
    upd = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={
            "beteiligte": [
                {"id": bid, "partner_id": p1, "rolle": "auftraggeber"},
                {"partner_id": p2, "rolle": "nachunternehmer"},
            ]
        },
    )
    assert upd.status_code == 200, upd.text
    bet = upd.json()["beteiligte"]
    assert len(bet) == 2
    by_partner = {x["partner"]["id"]: x for x in bet}
    assert by_partner[p1]["id"] == bid  # gleiche Zeile, aktualisiert
    assert by_partner[p1]["rolle"]["key"] == "auftraggeber"
    assert by_partner[p2]["rolle"]["key"] == "nachunternehmer"

    # Alle entfernen
    cleared = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"beteiligte": []},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["beteiligte"] == []


@pytest.mark.integration
async def test_invalid_partner_returns_400(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Bad partner",
            "beteiligte": [
                {"partner_id": "00000000-0000-0000-0000-000000000000", "rolle": "melder"}
            ],
        },
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_invalid_rolle_returns_400(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    partner_id = await _create_partner(
        client, headers, partner_typ_uuids["auftraggeber"], name="Rolle-Test"
    )
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Bad rolle",
            "beteiligte": [{"partner_id": partner_id, "rolle": "gibtsnicht"}],
        },
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_kontakt_of_other_partner_returns_400(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    p1 = await _create_partner(client, headers, partner_typ_uuids["auftraggeber"], name="Partner A")
    p2 = await _create_partner(client, headers, partner_typ_uuids["auftraggeber"], name="Partner B")
    kontakt_p2 = await _create_kontakt(client, headers, p2, vorname="Fremder", nachname="Kontakt")
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Mismatched kontakt",
            "beteiligte": [{"partner_id": p1, "partner_kontakt_id": kontakt_p2, "rolle": "melder"}],
        },
    )
    assert res.status_code == 400, res.text
