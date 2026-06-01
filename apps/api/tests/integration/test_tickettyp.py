import pytest

from fm_api.models import Tickettyp, TickettypFeld
from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _seed_system_tickettyp(db, mandant_id, key: str = "reparatur") -> Tickettyp:
    """Legt eine System-Vorlage direkt in der DB an (Migrations laufen in
    Tests nicht — Schema-Setup via Base.metadata.create_all)."""
    tt = Tickettyp(
        mandant_id=mandant_id,
        key=key,
        label=key.capitalize(),
        ist_system=True,
        aktiv=True,
    )
    db.add(tt)
    await db.flush()
    # Minimal-Feld, damit Relations sauber laden
    db.add(
        TickettypFeld(
            tickettyp_id=tt.id,
            feld_key="titel",
            label="Titel",
            ist_system_feld=True,
            sichtbar=True,
            pflicht=True,
            reihenfolge=0,
        )
    )
    await db.commit()
    await db.refresh(tt)
    return tt


@pytest.mark.integration
async def test_create_tickettyp_seedet_18_systemfelder(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "umzug", "label": "Umzug"},
    )
    assert res.status_code == 201, res.text
    body = res.json()

    assert body["key"] == "umzug"
    assert body["label"] == "Umzug"
    assert body["ist_system"] is False
    assert body["aktiv"] is True
    assert len(body["felder"]) == 18
    assert "melder" not in {f["feld_key"] for f in body["felder"]}

    feld_keys = {f["feld_key"] for f in body["felder"]}
    assert "titel" in feld_keys
    assert "beschreibung" in feld_keys
    assert "fehlercode" in feld_keys

    # Default-Pflicht: nur titel + beschreibung
    pflicht_keys = {f["feld_key"] for f in body["felder"] if f["pflicht"]}
    assert pflicht_keys == {"titel", "beschreibung"}


@pytest.mark.integration
async def test_duplicate_tickettyp_kloniert_komplett(client, admin_user, db, mandant) -> None:
    src = await _seed_system_tickettyp(db, mandant.id, key="reparatur")

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        f"/api/v1/tickettypen/{src.id}/duplicate",
        headers=headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()

    assert body["label"] == "Reparatur (Kopie)"
    assert body["key"] == "reparatur-kopie-1"
    assert body["ist_system"] is False
    assert body["aktiv"] is True
    # Helper seedet genau 1 Feld; Duplicate muss es klonen.
    assert len(body["felder"]) == 1
    assert body["felder"][0]["feld_key"] == "titel"
    assert body["felder"][0]["pflicht"] is True

    # Zweite Duplikation → kopie-2
    res2 = await client.post(
        f"/api/v1/tickettypen/{src.id}/duplicate",
        headers=headers,
    )
    assert res2.status_code == 201, res2.text
    assert res2.json()["key"] == "reparatur-kopie-2"


@pytest.mark.integration
async def test_delete_system_tickettyp_blockiert_403(client, admin_user, db, mandant) -> None:
    src = await _seed_system_tickettyp(db, mandant.id, key="wartung")

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.delete(f"/api/v1/tickettypen/{src.id}", headers=headers)
    assert res.status_code == 403, res.text


@pytest.mark.integration
async def test_delete_user_tickettyp_funktioniert(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    created = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "umzug", "label": "Umzug"},
    )
    tid = created.json()["id"]

    res = await client.delete(f"/api/v1/tickettypen/{tid}", headers=headers)
    assert res.status_code == 204, res.text


@pytest.mark.integration
async def test_system_tickettyp_kann_deaktiviert_werden(client, admin_user, db, mandant) -> None:
    src = await _seed_system_tickettyp(db, mandant.id, key="baubegehung")

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.patch(
        f"/api/v1/tickettypen/{src.id}",
        headers=headers,
        json={"aktiv": False},
    )
    assert res.status_code == 200, res.text
    assert res.json()["aktiv"] is False
    assert res.json()["ist_system"] is True  # bleibt System


@pytest.mark.integration
async def test_create_tickettyp_duplikat_key_gibt_409(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    first = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "duplikat-test", "label": "Erste"},
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "duplikat-test", "label": "Zweite"},
    )
    assert second.status_code == 409, second.text
    assert "duplikat-test" in second.json()["detail"]


@pytest.mark.integration
async def test_aktiv_only_filtert_deaktivierte_vorlagen(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    aktiv_resp = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "umzug-aktiv", "label": "Umzug-Aktiv"},
    )
    inaktiv_resp = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "umzug-inaktiv", "label": "Umzug-Inaktiv"},
    )
    inaktiv_id = inaktiv_resp.json()["id"]
    await client.patch(
        f"/api/v1/tickettypen/{inaktiv_id}",
        headers=headers,
        json={"aktiv": False},
    )

    # Default: alle sichtbar
    all_resp = await client.get("/api/v1/tickettypen", headers=headers)
    keys_all = {tt["key"] for tt in all_resp.json()}
    assert "umzug-aktiv" in keys_all
    assert "umzug-inaktiv" in keys_all

    # aktiv_only=true: nur aktive
    filtered_resp = await client.get("/api/v1/tickettypen?aktiv_only=true", headers=headers)
    keys_filtered = {tt["key"] for tt in filtered_resp.json()}
    assert "umzug-aktiv" in keys_filtered
    assert "umzug-inaktiv" not in keys_filtered
    # Sanity-Check: response enthielt überhaupt die andere Vorlage
    assert aktiv_resp.json()["id"] is not None
