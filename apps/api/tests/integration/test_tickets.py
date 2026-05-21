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
            "kategorie": "heizung",
        },
    )
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    assert created["nummer"] >= 1
    assert created["status"]["key"] == "neu"
    assert created["status"]["label"] == "Neu"
    assert created["prioritaet"]["key"] == "hoch"
    assert created["kategorie"]["key"] == "heizung"

    list_res = await client.get("/api/v1/tickets", headers=headers)
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["total"] >= 1
    assert any(t["id"] == created["id"] for t in body["items"])


@pytest.mark.integration
async def test_ticket_nummer_increments_per_mandant(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res1 = await client.post("/api/v1/tickets", headers=headers, json={"titel": "Erstes"})
    res2 = await client.post("/api/v1/tickets", headers=headers, json={"titel": "Zweites"})
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res2.json()["nummer"] == res1.json()["nummer"] + 1


@pytest.mark.integration
async def test_create_with_assignee_sets_status_bearbeitung(
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
    assert res.json()["status"]["key"] == "bearbeitung"
    assert res.json()["zugewiesen_an"]["id"] == str(tech.id)


@pytest.mark.integration
async def test_update_ticket_status_transitions(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create_res = await client.post("/api/v1/tickets", headers=headers, json={"titel": "Test"})
    ticket_id = create_res.json()["id"]

    patch_res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"status": "bearbeitung"},
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["status"]["key"] == "bearbeitung"

    erledigt_res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"status": "erledigt"},
    )
    assert erledigt_res.status_code == 200
    assert erledigt_res.json()["erledigt_am"] is not None


@pytest.mark.integration
async def test_cannot_reopen_erledigt_ticket(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create_res = await client.post("/api/v1/tickets", headers=headers, json={"titel": "Done"})
    tid = create_res.json()["id"]
    erledigt = await client.patch(
        f"/api/v1/tickets/{tid}", headers=headers, json={"status": "erledigt"}
    )
    assert erledigt.status_code == 200

    reopen = await client.patch(
        f"/api/v1/tickets/{tid}", headers=headers, json={"status": "bearbeitung"}
    )
    assert reopen.status_code == 409


@pytest.mark.integration
async def test_unknown_status_slug_returns_400(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Bad-Status", "status": "doesnt-exist"},
    )
    assert res.status_code == 400


@pytest.mark.integration
async def test_filter_by_status_slug(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    await client.post("/api/v1/tickets", headers=headers, json={"titel": "A"})
    create_b = await client.post("/api/v1/tickets", headers=headers, json={"titel": "B"})
    tid_b = create_b.json()["id"]
    await client.patch(f"/api/v1/tickets/{tid_b}", headers=headers, json={"status": "bearbeitung"})

    res = await client.get("/api/v1/tickets?status=bearbeitung", headers=headers)
    assert res.status_code == 200
    body = res.json()
    ids = {t["id"] for t in body["items"]}
    assert tid_b in ids
    assert all(t["status"]["key"] == "bearbeitung" for t in body["items"])


@pytest.mark.integration
async def test_tickets_require_auth(client) -> None:
    assert (await client.get("/api/v1/tickets")).status_code == 401
    assert (await client.post("/api/v1/tickets", json={"titel": "x"})).status_code == 401
