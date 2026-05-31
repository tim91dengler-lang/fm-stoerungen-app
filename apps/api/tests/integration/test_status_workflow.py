import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_status_workflow_get_defaults(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.get("/api/v1/status-workflow", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    keys = {s["key"] for s in body["status"]}
    assert {"neu", "pruefung", "bearbeitung", "wartet", "erledigt"} <= keys
    # Default: aus "erledigt" keine Übergänge, aus "neu" mehrere.
    assert body["uebergaenge"]["erledigt"] == []
    assert "bearbeitung" in body["uebergaenge"]["neu"]


@pytest.mark.integration
async def test_status_workflow_custom_matrix_allows_reopen(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    # Re-Open konfigurieren: erledigt → bearbeitung erlauben.
    put = await client.put(
        "/api/v1/status-workflow",
        headers=headers,
        json={"uebergaenge": {"erledigt": ["bearbeitung"]}},
    )
    assert put.status_code == 200, put.text
    assert put.json()["uebergaenge"]["erledigt"] == ["bearbeitung"]

    tid = (await client.post("/api/v1/tickets", headers=headers, json={"titel": "Reopen"})).json()[
        "id"
    ]
    await client.patch(f"/api/v1/tickets/{tid}", headers=headers, json={"status": "erledigt"})
    reopen = await client.patch(
        f"/api/v1/tickets/{tid}", headers=headers, json={"status": "bearbeitung"}
    )
    assert reopen.status_code == 200, reopen.text
    assert reopen.json()["status"]["key"] == "bearbeitung"


@pytest.mark.integration
async def test_status_workflow_custom_matrix_blocks_transition(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    # "neu" darf nur noch nach "pruefung".
    put = await client.put(
        "/api/v1/status-workflow",
        headers=headers,
        json={"uebergaenge": {"neu": ["pruefung"]}},
    )
    assert put.status_code == 200, put.text

    tid = (await client.post("/api/v1/tickets", headers=headers, json={"titel": "Blocked"})).json()[
        "id"
    ]
    blocked = await client.patch(
        f"/api/v1/tickets/{tid}", headers=headers, json={"status": "bearbeitung"}
    )
    assert blocked.status_code == 409


@pytest.mark.integration
async def test_status_workflow_erfordert_grund_flag(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.get("/api/v1/status-workflow", headers=headers)
    by_key = {s["key"]: s for s in res.json()["status"]}
    # Default: nur "wartet" verlangt einen Sub-Grund.
    assert by_key["wartet"]["erfordert_grund"] is True
    assert by_key["neu"]["erfordert_grund"] is False

    put = await client.put(
        "/api/v1/status-workflow",
        headers=headers,
        json={"erfordert_grund": {"pruefung": True}},
    )
    assert put.status_code == 200, put.text
    by_key2 = {s["key"]: s for s in put.json()["status"]}
    assert by_key2["pruefung"]["erfordert_grund"] is True
    assert by_key2["wartet"]["erfordert_grund"] is True  # unverändert (Default-Fallback)
