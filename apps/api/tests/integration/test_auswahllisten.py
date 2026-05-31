import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


@pytest.mark.integration
async def test_list_auswahllisten_seeded(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    res = await client.get("/api/v1/auswahllisten", headers=auth_header(token))
    assert res.status_code == 200, res.text
    keys = {liste["key"] for liste in res.json()}
    assert {"ticket_status", "ticket_prioritaet", "ticket_kategorie"} <= keys


@pytest.mark.integration
async def test_create_custom_auswahlliste(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/auswahllisten",
        headers=headers,
        json={"key": "gewerk", "label": "Gewerk", "beschreibung": "Custom"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["key"] == "gewerk"
    assert body["ist_system"] is False
    assert body["werte"] == []


@pytest.mark.integration
async def test_cannot_create_duplicate_liste(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    await client.post(
        "/api/v1/auswahllisten",
        headers=headers,
        json={"key": "abteilung", "label": "Abteilung"},
    )
    res = await client.post(
        "/api/v1/auswahllisten",
        headers=headers,
        json={"key": "abteilung", "label": "Abteilung 2"},
    )
    assert res.status_code == 409


@pytest.mark.integration
async def test_can_rename_system_liste(client, admin_user) -> None:
    """System-Listen dürfen umbenannt werden (Key bleibt fix). Konzept §5.A."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    listen = (await client.get("/api/v1/auswahllisten", headers=headers)).json()
    status_liste = next(le for le in listen if le["key"] == "ticket_status")
    res = await client.patch(
        f"/api/v1/auswahllisten/{status_liste['id']}",
        headers=headers,
        json={"label": "Neu-benannt"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["label"] == "Neu-benannt"
    assert res.json()["key"] == "ticket_status"


@pytest.mark.integration
async def test_cannot_delete_system_liste(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    listen = (await client.get("/api/v1/auswahllisten", headers=headers)).json()
    status_liste = next(le for le in listen if le["key"] == "ticket_status")
    res = await client.delete(f"/api/v1/auswahllisten/{status_liste['id']}", headers=headers)
    assert res.status_code == 403


@pytest.mark.integration
async def test_can_update_system_wert(client, admin_user) -> None:
    """System-Werte dürfen gepflegt werden (Label/Farbe/Aktiv/meta). Konzept §5.A."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    listen = (await client.get("/api/v1/auswahllisten", headers=headers)).json()
    status_liste = next(le for le in listen if le["key"] == "ticket_status")
    system_wert = status_liste["werte"][0]
    res = await client.patch(
        f"/api/v1/auswahllisten/werte/{system_wert['id']}",
        headers=headers,
        json={"label": "Brandneu", "farbe": "rose", "ist_aktiv": False},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["label"] == "Brandneu"
    assert body["farbe"] == "rose"
    assert body["ist_aktiv"] is False
    assert body["key"] == system_wert["key"]


@pytest.mark.integration
async def test_can_add_own_wert_to_system_liste(client, admin_user) -> None:
    """Eigene Werte dürfen zu einer System-Liste hinzugefügt werden (ist_system=False)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    listen = (await client.get("/api/v1/auswahllisten", headers=headers)).json()
    status_liste = next(le for le in listen if le["key"] == "ticket_status")
    res = await client.post(
        f"/api/v1/auswahllisten/{status_liste['id']}/werte",
        headers=headers,
        json={"key": "eskaliert", "label": "Eskaliert", "reihenfolge": 9, "farbe": "red"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["ist_system"] is False
    # ...und dieser eigene Wert in einer System-Liste ist auch wieder löschbar.
    del_res = await client.delete(f"/api/v1/auswahllisten/werte/{body['id']}", headers=headers)
    assert del_res.status_code == 204


@pytest.mark.integration
async def test_add_and_update_wert_in_user_liste(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create_res = await client.post(
        "/api/v1/auswahllisten",
        headers=headers,
        json={"key": "ort_intern", "label": "Interne Orte"},
    )
    liste_id = create_res.json()["id"]

    add_res = await client.post(
        f"/api/v1/auswahllisten/{liste_id}/werte",
        headers=headers,
        json={"key": "buero-1", "label": "Büro 1", "reihenfolge": 0, "farbe": "blue"},
    )
    assert add_res.status_code == 201, add_res.text
    wert_id = add_res.json()["id"]
    assert add_res.json()["ist_system"] is False

    patch_res = await client.patch(
        f"/api/v1/auswahllisten/werte/{wert_id}",
        headers=headers,
        json={"label": "Büro Nr. 1", "reihenfolge": 5},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["label"] == "Büro Nr. 1"
    assert patch_res.json()["reihenfolge"] == 5


@pytest.mark.integration
async def test_cannot_delete_system_wert(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    listen = (await client.get("/api/v1/auswahllisten", headers=headers)).json()
    status_liste = next(le for le in listen if le["key"] == "ticket_status")
    system_wert_id = status_liste["werte"][0]["id"]
    res = await client.delete(f"/api/v1/auswahllisten/werte/{system_wert_id}", headers=headers)
    assert res.status_code == 403


@pytest.mark.integration
async def test_requires_auth(client) -> None:
    assert (await client.get("/api/v1/auswahllisten")).status_code == 401
