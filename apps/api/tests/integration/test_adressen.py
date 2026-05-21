import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_crud_adresse(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create = await client.post(
        "/api/v1/adressen",
        headers=headers,
        json={
            "strasse": "Schweizer Straße",
            "hausnummer": "88",
            "plz": "60594",
            "ort": "Frankfurt am Main",
            "land": "de",
        },
    )
    assert create.status_code == 201, create.text
    a = create.json()
    assert a["land"] == "DE"  # Validator uppercased
    assert a["plz"] == "60594"
    adresse_id = a["id"]

    listed = await client.get("/api/v1/adressen", headers=headers)
    assert listed.status_code == 200
    assert any(item["id"] == adresse_id for item in listed.json()["items"])

    patch = await client.patch(
        f"/api/v1/adressen/{adresse_id}",
        headers=headers,
        json={"adresszusatz": "Hinterhaus"},
    )
    assert patch.status_code == 200
    assert patch.json()["adresszusatz"] == "Hinterhaus"

    delete = await client.delete(f"/api/v1/adressen/{adresse_id}", headers=headers)
    assert delete.status_code == 204

    detail = await client.get(f"/api/v1/adressen/{adresse_id}", headers=headers)
    assert detail.status_code == 404


@pytest.mark.integration
async def test_adresse_search(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    await client.post(
        "/api/v1/adressen",
        headers=headers,
        json={"strasse": "Hauptstraße", "plz": "10115", "ort": "Berlin"},
    )
    await client.post(
        "/api/v1/adressen",
        headers=headers,
        json={"strasse": "Marktplatz", "plz": "80331", "ort": "München"},
    )

    res = await client.get("/api/v1/adressen?search=berlin", headers=headers)
    assert res.status_code == 200
    assert all("berlin" in (item["ort"] or "").lower() for item in res.json()["items"])


@pytest.mark.integration
async def test_adressen_require_auth(client) -> None:
    assert (await client.get("/api/v1/adressen")).status_code == 401
