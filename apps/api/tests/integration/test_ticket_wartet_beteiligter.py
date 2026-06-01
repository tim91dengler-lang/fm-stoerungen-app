"""Wartet-Kontakt zeigt auf einen Ticket-Beteiligten (löst wartet_kontakt_* ab).

Sicherheitskern: der Zeiger darf nur auf einen Beteiligten DIESES Tickets zeigen —
ein fremder Beteiligten-Datensatz (anderes Ticket) muss mit 400 abgewiesen werden
(IDOR-Schutz, vgl. fk-mandant-validierung).
"""

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


async def _ticket_with_beteiligter(client, headers, partner_id, titel="Wartet-Test"):
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": titel,
            "beteiligte": [{"partner_id": partner_id, "rolle": "nachunternehmer"}],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    return body["id"], body["beteiligte"][0]["id"]


@pytest.mark.integration
async def test_set_wartet_beteiligter_ok(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    partner_id = await _create_partner(
        client, headers, partner_typ_uuids["nachunternehmer"], name="NU Schmidt"
    )
    ticket_id, bid = await _ticket_with_beteiligter(client, headers, partner_id)

    res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"wartet_grund": "extern", "wartet_beteiligter_id": bid},
    )
    assert res.status_code == 200, res.text
    assert res.json()["wartet_beteiligter_id"] == bid


@pytest.mark.integration
async def test_set_wartet_beteiligter_null_clears(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    partner_id = await _create_partner(
        client, headers, partner_typ_uuids["nachunternehmer"], name="NU Clear"
    )
    ticket_id, bid = await _ticket_with_beteiligter(client, headers, partner_id)
    await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"wartet_beteiligter_id": bid},
    )

    res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"wartet_beteiligter_id": None},
    )
    assert res.status_code == 200, res.text
    assert res.json()["wartet_beteiligter_id"] is None


@pytest.mark.integration
async def test_unknown_wartet_beteiligter_returns_400(
    client, admin_user, partner_typ_uuids
) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    partner_id = await _create_partner(
        client, headers, partner_typ_uuids["nachunternehmer"], name="NU Unknown"
    )
    ticket_id, _ = await _ticket_with_beteiligter(client, headers, partner_id)

    res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"wartet_beteiligter_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_foreign_ticket_beteiligter_rejected(client, admin_user, partner_typ_uuids) -> None:
    """Beteiligter eines ANDEREN Tickets darf nicht als Wartet-Kontakt zeigen (IDOR)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    p1 = await _create_partner(client, headers, partner_typ_uuids["nachunternehmer"], name="NU 1")
    p2 = await _create_partner(client, headers, partner_typ_uuids["nachunternehmer"], name="NU 2")
    ticket_a, _ = await _ticket_with_beteiligter(client, headers, p1, titel="Ticket A")
    _, bid_b = await _ticket_with_beteiligter(client, headers, p2, titel="Ticket B")

    res = await client.patch(
        f"/api/v1/tickets/{ticket_a}",
        headers=headers,
        json={"wartet_beteiligter_id": bid_b},
    )
    assert res.status_code == 400, res.text
