"""Integration-Tests Feature 2 — Projekt-Modul-Backend.

Deckt ab:
- Auswahllisten `projekttyp` + `projektstatus` werden für Mandant geseedet
- Projekt anlegen mit projekttyp_slug + status_slug + Multi-Objekt
- Projekt-Update: Status-Wechsel, Objekt-Liste replace-Strategie
- 422 bei ungültigem projekttyp_slug / status_slug / objekt_id
- GET /projekte/{id}/tickets liefert nur Tickets dieses Projekts
- Soft-delete-Verhalten
"""

import pytest

from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_objekt(client, headers, name: str) -> str:
    res = await client.post(
        "/api/v1/objekte",
        headers=headers,
        json={"name": name, "partner_links": []},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.integration
async def test_auswahllisten_seed_for_mandant_includes_projekt_listen(client, admin_user) -> None:
    """Mandant-Seed legt projekttyp + projektstatus automatisch an."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.get("/api/v1/auswahllisten", headers=headers)
    assert res.status_code == 200
    listen = res.json()
    keys = {liste["key"] for liste in listen}
    assert "projekttyp" in keys
    assert "projektstatus" in keys

    typ_liste = next(liste for liste in listen if liste["key"] == "projekttyp")
    typ_keys = {w["key"] for w in typ_liste["werte"]}
    assert {"wartung", "sanierung", "neubau", "begehung", "bauprojekt"}.issubset(typ_keys)

    status_liste = next(liste for liste in listen if liste["key"] == "projektstatus")
    status_keys = {w["key"] for w in status_liste["werte"]}
    assert {"geplant", "aktiv", "pausiert", "abgeschlossen"}.issubset(status_keys)


@pytest.mark.integration
async def test_create_projekt_with_required_slugs(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Sanierung Marktplatz 2.OG",
            "beschreibung": "Komplette Sanierung",
            "projekttyp_slug": "sanierung",
            "status_slug": "aktiv",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Sanierung Marktplatz 2.OG"
    assert body["projekttyp"]["key"] == "sanierung"
    assert body["projekttyp"]["label"] == "Sanierung"
    assert body["status"]["key"] == "aktiv"
    assert body["verantwortlich"] is None
    assert body["objekte"] == []
    assert body["ticket_count"] == 0


@pytest.mark.integration
async def test_create_projekt_with_multi_objekt(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    obj_a = await _create_objekt(client, headers, "Objekt A")
    obj_b = await _create_objekt(client, headers, "Objekt B")

    res = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Multi-Objekt-Projekt",
            "projekttyp_slug": "begehung",
            "objekt_ids": [obj_a, obj_b],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"]["key"] == "geplant"  # Default
    objekt_ids = {o["id"] for o in body["objekte"]}
    assert objekt_ids == {obj_a, obj_b}


@pytest.mark.integration
async def test_create_projekt_with_empty_objekt_ids_ok(client, admin_user) -> None:
    """Loop-Pattern: leere Objekt-Liste darf keinen Crash erzeugen."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Ohne Objekte",
            "projekttyp_slug": "wartung",
            "objekt_ids": [],
        },
    )
    assert res.status_code == 201, res.text
    assert res.json()["objekte"] == []


@pytest.mark.integration
async def test_create_projekt_invalid_typ_slug_returns_422(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Bad-Typ",
            "projekttyp_slug": "doesnt-exist",
        },
    )
    assert res.status_code == 422, res.text


@pytest.mark.integration
async def test_create_projekt_invalid_status_slug_returns_422(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    res = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Bad-Status",
            "projekttyp_slug": "wartung",
            "status_slug": "nope",
        },
    )
    assert res.status_code == 422, res.text


@pytest.mark.integration
async def test_create_projekt_invalid_objekt_id_returns_422(client, admin_user) -> None:
    import uuid

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    bogus = str(uuid.uuid4())
    res = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Bad-Objekt",
            "projekttyp_slug": "wartung",
            "objekt_ids": [bogus],
        },
    )
    assert res.status_code == 422


@pytest.mark.integration
async def test_update_projekt_replaces_objekt_links(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    obj_a = await _create_objekt(client, headers, "Obj-A")
    obj_b = await _create_objekt(client, headers, "Obj-B")
    obj_c = await _create_objekt(client, headers, "Obj-C")

    create = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={
            "name": "Wechsel-Test",
            "projekttyp_slug": "wartung",
            "objekt_ids": [obj_a, obj_b],
        },
    )
    pid = create.json()["id"]

    upd = await client.patch(
        f"/api/v1/projekte/{pid}",
        headers=headers,
        json={"objekt_ids": [obj_c]},
    )
    assert upd.status_code == 200, upd.text
    assert {o["id"] for o in upd.json()["objekte"]} == {obj_c}

    # Update mit None / fehlend → keine Änderung
    upd2 = await client.patch(
        f"/api/v1/projekte/{pid}",
        headers=headers,
        json={"name": "Wechsel-Test 2"},
    )
    assert upd2.status_code == 200
    assert {o["id"] for o in upd2.json()["objekte"]} == {obj_c}


@pytest.mark.integration
async def test_update_projekt_status_and_typ_via_slug(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={"name": "Statuswechsel", "projekttyp_slug": "wartung"},
    )
    pid = create.json()["id"]

    upd = await client.patch(
        f"/api/v1/projekte/{pid}",
        headers=headers,
        json={"status_slug": "abgeschlossen", "projekttyp_slug": "sanierung"},
    )
    assert upd.status_code == 200, upd.text
    body = upd.json()
    assert body["status"]["key"] == "abgeschlossen"
    assert body["projekttyp"]["key"] == "sanierung"


@pytest.mark.integration
async def test_soft_delete_projekt_hides_from_list(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    create = await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={"name": "Zu-Löschen", "projekttyp_slug": "wartung"},
    )
    pid = create.json()["id"]

    deleted = await client.delete(f"/api/v1/projekte/{pid}", headers=headers)
    assert deleted.status_code == 204

    listed = await client.get("/api/v1/projekte", headers=headers)
    assert not any(p["id"] == pid for p in listed.json())

    detail = await client.get(f"/api/v1/projekte/{pid}", headers=headers)
    assert detail.status_code == 404


@pytest.mark.integration
async def test_list_projekte_filters_by_status_and_typ(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={"name": "Wartungs-1", "projekttyp_slug": "wartung", "status_slug": "geplant"},
    )
    await client.post(
        "/api/v1/projekte",
        headers=headers,
        json={"name": "Sanierungs-1", "projekttyp_slug": "sanierung", "status_slug": "aktiv"},
    )

    by_typ = await client.get("/api/v1/projekte?projekttyp=sanierung", headers=headers)
    assert by_typ.status_code == 200
    names = {p["name"] for p in by_typ.json()}
    assert "Sanierungs-1" in names
    assert "Wartungs-1" not in names

    by_status = await client.get("/api/v1/projekte?status=geplant", headers=headers)
    assert by_status.status_code == 200
    names = {p["name"] for p in by_status.json()}
    assert "Wartungs-1" in names


@pytest.mark.integration
async def test_get_projekt_tickets_returns_only_this_projekts_tickets(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)

    # 2 Projekte
    p1 = (
        await client.post(
            "/api/v1/projekte",
            headers=headers,
            json={"name": "P1", "projekttyp_slug": "wartung"},
        )
    ).json()["id"]
    p2 = (
        await client.post(
            "/api/v1/projekte",
            headers=headers,
            json={"name": "P2", "projekttyp_slug": "wartung"},
        )
    ).json()["id"]

    # 3 Tickets: 2 zu P1, 1 zu P2
    for titel, proj_id in (("T1", p1), ("T2", p1), ("T3", p2)):
        ticket_res = await client.post(
            "/api/v1/tickets",
            headers=headers,
            json={"titel": titel, "projekt_id": proj_id},
        )
        assert ticket_res.status_code == 201, ticket_res.text

    p1_tickets = await client.get(f"/api/v1/projekte/{p1}/tickets", headers=headers)
    assert p1_tickets.status_code == 200, p1_tickets.text
    body = p1_tickets.json()
    assert body["total"] == 2
    titel_set = {t["titel"] for t in body["items"]}
    assert titel_set == {"T1", "T2"}

    p2_tickets = await client.get(f"/api/v1/projekte/{p2}/tickets", headers=headers)
    assert p2_tickets.json()["total"] == 1


@pytest.mark.integration
async def test_get_unknown_projekt_tickets_returns_404(client, admin_user) -> None:
    import uuid

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    res = await client.get(f"/api/v1/projekte/{uuid.uuid4()}/tickets", headers=headers)
    assert res.status_code == 404


@pytest.mark.integration
async def test_projekte_require_auth(client) -> None:
    assert (await client.get("/api/v1/projekte")).status_code == 401
    assert (
        await client.post("/api/v1/projekte", json={"name": "x", "projekttyp_slug": "wartung"})
    ).status_code == 401
