import pytest

from tests.conftest import auth_header, login

NONEXISTENT = "00000000-0000-0000-0000-000000000000"


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
@pytest.mark.parametrize(
    "field",
    [
        "anlage_id",
        "fehlercode_id",
        "projekt_id",
        "haus_id",
        "stockwerk_id",
        "einheit_id",
        "tickettyp_id",
    ],
)
async def test_create_unknown_fk_rejected(client, admin_user, field) -> None:
    """IDOR-Schutz: unbekannte/fremde anlage_id/fehlercode_id/projekt_id → 400."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "x", field: NONEXISTENT},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
@pytest.mark.parametrize(
    "field",
    [
        "anlage_id",
        "fehlercode_id",
        "projekt_id",
        "haus_id",
        "stockwerk_id",
        "einheit_id",
        "tickettyp_id",
    ],
)
async def test_update_unknown_fk_rejected(client, admin_user, field) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    created = await client.post("/api/v1/tickets", headers=headers, json={"titel": "x"})
    assert created.status_code == 201, created.text
    ticket_id = created.json()["id"]
    res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={field: NONEXISTENT},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
@pytest.mark.parametrize(
    "field",
    [
        "anlage_id",
        "fehlercode_id",
        "projekt_id",
        "haus_id",
        "stockwerk_id",
        "einheit_id",
        "tickettyp_id",
    ],
)
async def test_update_fk_to_null_allowed(client, admin_user, field) -> None:
    """None bleibt erlaubt (Zuordnung entfernen)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    created = await client.post("/api/v1/tickets", headers=headers, json={"titel": "x"})
    ticket_id = created.json()["id"]
    res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={field: None},
    )
    assert res.status_code == 200, res.text


@pytest.mark.integration
async def test_update_unknown_wartet_nachunternehmer_rejected(client, admin_user) -> None:
    """wartet_nachunternehmer_id ist update-only — fremde Partner-ID → 400."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    created = await client.post("/api/v1/tickets", headers=headers, json={"titel": "x"})
    ticket_id = created.json()["id"]
    res = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"wartet_nachunternehmer_id": NONEXISTENT},
    )
    assert res.status_code == 400, res.text
