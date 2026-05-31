import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_create_ticket_with_pins(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Mehrere Markierungen",
            "pins": [
                {"x": 10.5, "y": 20.0},
                {"x": 80.0, "y": 65.5, "label": "Leck"},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert len(body["pins"]) == 2
    assert body["pins"][0]["x"] == 10.5
    assert body["pins"][1]["label"] == "Leck"


@pytest.mark.integration
async def test_create_ticket_without_pins_defaults_empty(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post("/api/v1/tickets", headers=headers, json={"titel": "Ohne Pin"})
    assert res.status_code == 201, res.text
    assert res.json()["pins"] == []


@pytest.mark.integration
async def test_update_ticket_pins(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    tid = (
        await client.post("/api/v1/tickets", headers=headers, json={"titel": "Pin-Update"})
    ).json()["id"]

    # Pins setzen
    patch = await client.patch(
        f"/api/v1/tickets/{tid}",
        headers=headers,
        json={"pins": [{"x": 50, "y": 50}]},
    )
    assert patch.status_code == 200, patch.text
    assert len(patch.json()["pins"]) == 1
    assert patch.json()["pins"][0]["x"] == 50.0

    # Pins leeren
    cleared = await client.patch(f"/api/v1/tickets/{tid}", headers=headers, json={"pins": []})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["pins"] == []


@pytest.mark.integration
async def test_pin_out_of_range_rejected(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Ungültig", "pins": [{"x": 150, "y": 10}]},
    )
    assert res.status_code == 422
