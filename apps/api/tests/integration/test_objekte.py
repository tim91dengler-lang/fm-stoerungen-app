import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_partner(client, headers, name: str, typen: list[str]) -> str:
    res = await client.post(
        "/api/v1/partner",
        headers=headers,
        json={"name": name, "typen": typen},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.integration
async def test_create_objekt_with_partner_links(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    mieter_id = await _create_partner(
        client, headers, "Mieter X", [str(partner_typ_uuids["mieter"])]
    )
    eig_id = await _create_partner(
        client, headers, "Eigentümer Y", [str(partner_typ_uuids["eigentuemer"])]
    )

    res = await client.post(
        "/api/v1/objekte",
        headers=headers,
        json={
            "name": "Bürogebäude Frankfurt",
            "notiz": "5 Etagen, 30 Räume",
            "partner_links": [
                {"partner_id": mieter_id, "rolle": "mieter"},
                {"partner_id": eig_id, "rolle": "eigentuemer"},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Bürogebäude Frankfurt"
    assert len(body["partner_links"]) == 2
    rollen = {link["rolle"] for link in body["partner_links"]}
    assert rollen == {"mieter", "eigentuemer"}


@pytest.mark.integration
async def test_invalid_partner_link_returns_400(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    fake_id = "00000000-0000-0000-0000-000000000000"
    res = await client.post(
        "/api/v1/objekte",
        headers=headers,
        json={
            "name": "Bad",
            "partner_links": [{"partner_id": fake_id, "rolle": "mieter"}],
        },
    )
    assert res.status_code == 400


@pytest.mark.integration
async def test_update_objekt_replaces_partner_links(client, admin_user, partner_typ_uuids) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    p1 = await _create_partner(client, headers, "P1", [str(partner_typ_uuids["mieter"])])
    p2 = await _create_partner(client, headers, "P2", [str(partner_typ_uuids["nachunternehmer"])])

    create = await client.post(
        "/api/v1/objekte",
        headers=headers,
        json={
            "name": "Obj-A",
            "partner_links": [{"partner_id": p1, "rolle": "mieter"}],
        },
    )
    oid = create.json()["id"]

    patch = await client.patch(
        f"/api/v1/objekte/{oid}",
        headers=headers,
        json={
            "name": "Obj-A neu",
            "partner_links": [{"partner_id": p2, "rolle": "nachunternehmer"}],
        },
    )
    assert patch.status_code == 200
    body = patch.json()
    assert body["name"] == "Obj-A neu"
    assert len(body["partner_links"]) == 1
    assert body["partner_links"][0]["partner_id"] == p2


@pytest.mark.integration
async def test_objekte_require_auth(client) -> None:
    assert (await client.get("/api/v1/objekte")).status_code == 401
