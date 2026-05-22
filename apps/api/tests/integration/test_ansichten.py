import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_save_and_list_ansicht(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/ansichten",
        headers=headers,
        json={
            "view_key": "tickets",
            "name": "Meine offenen Tickets",
            "config": {
                "filter": {"status": ["neu", "bearbeitung"]},
                "columns": ["nummer", "titel", "status", "prioritaet"],
                "sort": [{"id": "eroeffnet_am", "desc": True}],
            },
            "ist_default": True,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["view_key"] == "tickets"
    assert body["ist_default"] is True
    assert body["config"]["filter"]["status"] == ["neu", "bearbeitung"]

    listed = await client.get("/api/v1/ansichten?view_key=tickets", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) >= 1


@pytest.mark.integration
async def test_default_is_exclusive_per_view(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    a = await client.post(
        "/api/v1/ansichten",
        headers=headers,
        json={
            "view_key": "tickets",
            "name": "A",
            "config": {},
            "ist_default": True,
        },
    )
    b = await client.post(
        "/api/v1/ansichten",
        headers=headers,
        json={
            "view_key": "tickets",
            "name": "B",
            "config": {},
            "ist_default": True,
        },
    )
    assert a.status_code == 201
    assert b.status_code == 201

    listed = await client.get("/api/v1/ansichten?view_key=tickets", headers=headers)
    defaults = [v for v in listed.json() if v["ist_default"]]
    assert len(defaults) == 1
    assert defaults[0]["name"] == "B"


@pytest.mark.integration
async def test_duplicate_name_same_view_returns_409(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    await client.post(
        "/api/v1/ansichten",
        headers=headers,
        json={"view_key": "tickets", "name": "Dup", "config": {}},
    )
    res = await client.post(
        "/api/v1/ansichten",
        headers=headers,
        json={"view_key": "tickets", "name": "Dup", "config": {"x": 1}},
    )
    assert res.status_code == 409


@pytest.mark.integration
async def test_ansichten_require_auth(client) -> None:
    assert (await client.get("/api/v1/ansichten")).status_code == 401
