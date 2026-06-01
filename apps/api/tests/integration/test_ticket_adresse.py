import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_adresse(client, headers, *, strasse, plz, ort) -> str:
    res = await client.post(
        "/api/v1/adressen",
        headers=headers,
        json={"strasse": strasse, "plz": plz, "ort": ort},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_objekt(client, headers, *, name, adresse_id=None) -> str:
    res = await client.post(
        "/api/v1/objekte",
        headers=headers,
        json={"name": name, "adresse_id": adresse_id},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.integration
async def test_ticket_with_own_adresse(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    adresse_id = await _create_adresse(
        client, headers, strasse="Eigenweg 5", plz="70173", ort="Stuttgart"
    )

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Ticket mit eigener Adresse", "adresse_id": adresse_id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["adresse_id"] == adresse_id
    assert body["adresse"]["strasse"] == "Eigenweg 5"
    assert body["adresse"]["ort"] == "Stuttgart"


@pytest.mark.integration
async def test_ticket_falls_back_to_objekt_adresse(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    obj_adr = await _create_adresse(
        client, headers, strasse="Objektstraße 1", plz="70174", ort="Stuttgart"
    )
    objekt_id = await _create_objekt(client, headers, name="Haus A", adresse_id=obj_adr)

    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Ticket am Objekt", "objekt_id": objekt_id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    # Keine eigene Adresse → Default ist die Objekt-Adresse
    assert body["adresse_id"] is None
    assert body["adresse"]["strasse"] == "Objektstraße 1"


@pytest.mark.integration
async def test_ticket_own_adresse_overrides_objekt(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    obj_adr = await _create_adresse(
        client, headers, strasse="Objektstraße 2", plz="70175", ort="Stuttgart"
    )
    own_adr = await _create_adresse(
        client, headers, strasse="Sonderadresse 9", plz="70176", ort="Stuttgart"
    )
    objekt_id = await _create_objekt(client, headers, name="Haus B", adresse_id=obj_adr)

    created = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Override", "objekt_id": objekt_id, "adresse_id": own_adr},
    )
    assert created.status_code == 201, created.text
    assert created.json()["adresse"]["strasse"] == "Sonderadresse 9"

    # Override entfernen → wieder Objekt-Adresse
    ticket_id = created.json()["id"]
    upd = await client.patch(
        f"/api/v1/tickets/{ticket_id}",
        headers=headers,
        json={"adresse_id": None},
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["adresse_id"] is None
    assert upd.json()["adresse"]["strasse"] == "Objektstraße 2"


@pytest.mark.integration
async def test_unknown_adresse_id_rejected(client, admin_user) -> None:
    """Sicherheit: eine adresse_id, die nicht zum Mandanten gehört (oder nicht
    existiert), wird mandantengebunden abgewiesen — kein IDOR-Leak."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={
            "titel": "Fremde Adresse",
            "adresse_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_foreign_mandant_adresse_rejected(client, admin_user, db) -> None:
    """Echter Cross-Mandant-Fall: Adresse eines fremden Mandanten → 400."""
    from uuid import uuid4

    from fm_api.models import Adresse, Mandant

    other = Mandant(name="Fremd-Mandant", slug=f"fremd-{uuid4().hex[:8]}")
    db.add(other)
    await db.flush()
    foreign = Adresse(mandant_id=other.id, strasse="Fremdweg 1", plz="99999", ort="Fernort")
    db.add(foreign)
    await db.flush()
    await db.commit()

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Cross-Mandant", "adresse_id": str(foreign.id)},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_ticket_no_objekt_with_adresse(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    adresse_id = await _create_adresse(
        client, headers, strasse="Ohne Objekt 3", plz="70177", ort="Stuttgart"
    )
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Kein Objekt, eigene Adresse", "adresse_id": adresse_id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["objekt"] is None
    assert body["adresse"]["strasse"] == "Ohne Objekt 3"
