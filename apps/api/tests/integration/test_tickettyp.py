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
async def test_create_tickettyp_seedet_19_systemfelder(client, admin_user) -> None:
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
    assert len(body["felder"]) == 19
    feld_keys = {f["feld_key"] for f in body["felder"]}
    assert "melder" not in feld_keys
    assert "adresse" in feld_keys
    assert "titel" in feld_keys
    assert "beschreibung" in feld_keys
    assert "fehlercode" in feld_keys
    # partner-Feld steuert jetzt den Beteiligte-Block → Label "Beteiligte"
    partner_feld = next(f for f in body["felder"] if f["feld_key"] == "partner")
    assert partner_feld["label"] == "Beteiligte"

    # Default-Pflicht: nur titel + beschreibung
    pflicht_keys = {f["feld_key"] for f in body["felder"] if f["pflicht"]}
    assert pflicht_keys == {"titel", "beschreibung"}


@pytest.mark.integration
async def test_create_tickettyp_seedet_bloecke(client, admin_user) -> None:
    """Stufe C C1: neue Vorlage bekommt die 7 System-Blöcke; jedes Feld ist einem
    Block zugeordnet; reihenfolge ist block-lokal."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "umzug-bloecke", "label": "Umzug-Blöcke"},
    )
    assert res.status_code == 201, res.text
    body = res.json()

    by_key = {b["block_key"]: b for b in body["bloecke"]}
    assert set(by_key) == {
        "kopf",
        "problem",
        "beteiligte",
        "verortung",
        "klassifizierung",
        "belege",
        "weitere",
    }
    assert by_key["belege"]["region"] == "rechts"
    assert by_key["kopf"]["region"] == "links"
    assert by_key["kopf"]["ist_system_block"] is True
    assert by_key["weitere"]["ist_system_block"] is True
    assert by_key["verortung"]["ist_system_block"] is False

    # Alle 19 Felder sind einem Block zugeordnet (keiner None).
    assert all(f["block_id"] is not None for f in body["felder"])
    titel = next(f for f in body["felder"] if f["feld_key"] == "titel")
    assert titel["block_id"] == by_key["kopf"]["id"]
    objekt = next(f for f in body["felder"] if f["feld_key"] == "objekt")
    assert objekt["block_id"] == by_key["verortung"]["id"]
    # block-lokale Reihenfolge: die 7 Verortungs-Felder sind 0..6 eindeutig.
    verortung_orders = sorted(
        f["reihenfolge"] for f in body["felder"] if f["block_id"] == by_key["verortung"]["id"]
    )
    assert verortung_orders == [0, 1, 2, 3, 4, 5, 6]


@pytest.mark.integration
async def test_duplicate_kloniert_bloecke_mit_eigenen_ids(client, admin_user) -> None:
    """Duplikat hat EIGENE Block-IDs; Felder zeigen auf die neuen Blöcke (N1)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    src = await client.post(
        "/api/v1/tickettypen",
        headers=headers,
        json={"key": "src-dup", "label": "Quelle"},
    )
    src_body = src.json()
    src_block_ids = {b["id"] for b in src_body["bloecke"]}

    dup = await client.post(f"/api/v1/tickettypen/{src_body['id']}/duplicate", headers=headers)
    assert dup.status_code == 201, dup.text
    dup_body = dup.json()
    dup_block_ids = {b["id"] for b in dup_body["bloecke"]}

    assert dup_block_ids.isdisjoint(src_block_ids)
    assert {b["block_key"] for b in dup_body["bloecke"]} == {
        b["block_key"] for b in src_body["bloecke"]
    }
    # Jedes Feld des Duplikats zeigt auf einen Block DES DUPLIKATS, nie der Quelle.
    for f in dup_body["felder"]:
        if f["block_id"] is not None:
            assert f["block_id"] in dup_block_ids


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
