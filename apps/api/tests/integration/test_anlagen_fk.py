"""FK-Validierung Anlage: user-gelieferte FKs müssen mandantengebunden sein (IDOR-Schutz)."""

from uuid import uuid4

import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_create_anlage_unknown_kategorie_returns_422(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/anlagen",
        headers=headers,
        json={"bezeichnung": "Aufzug X", "kategorie_wert_id": str(uuid4())},
    )
    assert res.status_code == 422, res.text


@pytest.mark.integration
async def test_create_anlage_unknown_objekt_returns_422(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/anlagen",
        headers=headers,
        json={"bezeichnung": "Aufzug Y", "objekt_id": str(uuid4())},
    )
    assert res.status_code == 422, res.text


@pytest.mark.integration
async def test_update_anlage_unknown_kategorie_returns_422(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    created = await client.post(
        "/api/v1/anlagen", headers=headers, json={"bezeichnung": "Aufzug Z"}
    )
    assert created.status_code == 201, created.text
    aid = created.json()["id"]
    res = await client.patch(
        f"/api/v1/anlagen/{aid}", headers=headers, json={"kategorie_wert_id": str(uuid4())}
    )
    assert res.status_code == 422, res.text
