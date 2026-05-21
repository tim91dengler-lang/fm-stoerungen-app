import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_create_and_list_ticket(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create_res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Heizung in Raum 12 fällt aus",
            "beschreibung": "Vorlauf zu kalt",
            "prioritaet": "hoch",
        },
    )
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    assert created["nummer"] >= 1
    assert created["status"] == "neu"

    list_res = await client.get("/api/v1/tickets", headers=headers)
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["total"] >= 1
    assert any(t["id"] == created["id"] for t in body["items"])


@pytest.mark.integration
async def test_ticket_nummer_increments_per_mandant(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res1 = await client.post(
        "/api/v1/tickets", headers=headers, json={"titel": "Erstes"}
    )
    res2 = await client.post(
        "/api/v1/tickets", headers=headers, json={"titel": "Zweites"}
    )
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res2.json()["nummer"] == res1.json()["nummer"] + 1


@pytest.mark.integration
async def test_create_with_assignee_sets_status_zugewiesen(
    client, admin_user, techniker_user
) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    tech, _ = techniker_user

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Mit Zuweisung", "zugewiesen_an_id": str(tech.id)},
    )
    assert res.status_code == 201
    assert res.json()["status"] == "zugewiesen"
    assert res.json()["zugewiesen_an"]["id"] == str(tech.id)


@pytest.mark.integration
async def test_update_ticket_status_transitions(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create_res = await client.post(
        "/api/v1/tickets", headers=headers, json={"titel": "Test"}
    )
    ticket_id = create_res.json()["id"]

    patch_res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"status": "in_arbeit"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "in_arbeit"

    erledigt_res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"status": "erledigt"},
    )
    assert erledigt_res.status_code == 200
    assert erledigt_res.json()["erledigt_am"] is not None


@pytest.mark.integration
async def test_cannot_reopen_closed_ticket(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create_res = await client.post(
        "/api/v1/tickets", headers=headers, json={"titel": "Closed"}
    )
    tid = create_res.json()["id"]
    await client.patch(
        f"/api/v1/tickets/{tid}", headers=headers, json={"status": "geschlossen"}
    )

    reopen = await client.patch(
        f"/api/v1/tickets/{tid}", headers=headers, json={"status": "neu"}
    )
    assert reopen.status_code == 409


@pytest.mark.integration
async def test_tickets_require_auth(client) -> None:
    assert (await client.get("/api/v1/tickets")).status_code == 401
    assert (await client.post("/api/v1/tickets", json={"titel": "x"})).status_code == 401
