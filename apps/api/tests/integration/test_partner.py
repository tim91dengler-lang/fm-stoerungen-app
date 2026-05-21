import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_create_and_list_partner(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/partner",
        headers=headers,
        json={
            "name": "Wohnungsbau GmbH",
            "ansprechpartner": "Hans Müller",
            "email": "kontakt@wohnungsbau.example",
            "telefon": "+49 30 12345678",
            "typen": ["eigentuemer", "auftraggeber"],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Wohnungsbau GmbH"
    assert set(body["typen"]) == {"eigentuemer", "auftraggeber"}

    listed = await client.get("/api/v1/partner", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1


@pytest.mark.integration
async def test_filter_partner_by_typ(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": "Mieter A", "typen": ["mieter"]},
    )
    await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": "Subunternehmer B", "typen": ["nachunternehmer"]},
    )

    res = await client.get("/api/v1/partner?typ=mieter", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(p["name"] == "Mieter A" for p in items)
    assert not any(p["name"] == "Subunternehmer B" for p in items)


@pytest.mark.integration
async def test_soft_delete_partner_hides_from_list(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create = await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": "To-Delete GmbH", "typen": ["nachunternehmer"]},
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
