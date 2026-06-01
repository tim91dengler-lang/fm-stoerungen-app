"""Stufe C C3: PUT /{id}/layout — transaktionaler Designer-Save.

Deckt Block-Reconcile, Kernfeld-Schutz, Eltern-Sichtbarkeit (H4), Alles-Vorlage-
Lock und die IDOR-Sicherheit (Keys nur innerhalb der Vorlage) ab.
"""

import pytest

from fm_api.services import tickettyp_service as svc
from tests.conftest import auth_header, login


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_vorlage(client, headers, key="layout-test", label="Layout-Test") -> dict:
    res = await client.post(
        "/api/v1/tickettypen", headers=headers, json={"key": key, "label": label}
    )
    assert res.status_code == 201, res.text
    return res.json()


def _layout_from(body: dict) -> dict:
    """Baut einen Layout-Payload aus einem TickettypRead (Round-Trip-Basis)."""
    bloecke = [
        {
            "block_key": b["block_key"],
            "label": b["label"],
            "region": b["region"],
            "reihenfolge": b["reihenfolge"],
            "collapsible_default_open": b["collapsible_default_open"],
        }
        for b in body["bloecke"]
    ]
    id_to_key = {b["id"]: b["block_key"] for b in body["bloecke"]}
    felder = [
        {
            "feld_key": f["feld_key"],
            "block_key": id_to_key.get(f["block_id"], "weitere"),
            "reihenfolge": f["reihenfolge"],
            "sichtbar": f["sichtbar"],
            "pflicht": f["pflicht"],
        }
        for f in body["felder"]
    ]
    return {"bloecke": bloecke, "felder": felder}


def _block_key_of(body: dict, feld_key: str) -> str:
    id_to_key = {b["id"]: b["block_key"] for b in body["bloecke"]}
    f = next(f for f in body["felder"] if f["feld_key"] == feld_key)
    return id_to_key.get(f["block_id"], "weitere")


@pytest.mark.integration
async def test_layout_reorder_move_hide(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    body = await _create_vorlage(client, headers)
    tid = body["id"]

    layout = _layout_from(body)
    for f in layout["felder"]:
        if f["feld_key"] == "prio":
            f["block_key"] = "verortung"  # Feld in anderen Block ziehen
        if f["feld_key"] == "quelle":
            f["sichtbar"] = False  # Feld ausblenden
    for b in layout["bloecke"]:
        if b["block_key"] == "belege":
            b["region"] = "links"  # Block in andere Region

    res = await client.put(f"/api/v1/tickettypen/{tid}/layout", headers=headers, json=layout)
    assert res.status_code == 200, res.text
    body2 = res.json()

    assert _block_key_of(body2, "prio") == "verortung"
    quelle = next(f for f in body2["felder"] if f["feld_key"] == "quelle")
    assert quelle["sichtbar"] is False
    belege = next(b for b in body2["bloecke"] if b["block_key"] == "belege")
    assert belege["region"] == "links"


@pytest.mark.integration
async def test_layout_kernfeld_schutz(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    body = await _create_vorlage(client, headers, key="kern", label="Kern")
    tid = body["id"]

    layout = _layout_from(body)
    for f in layout["felder"]:
        if f["feld_key"] == "titel":
            f["sichtbar"] = False
            f["pflicht"] = False

    res = await client.put(f"/api/v1/tickettypen/{tid}/layout", headers=headers, json=layout)
    assert res.status_code == 200, res.text
    titel = next(f for f in res.json()["felder"] if f["feld_key"] == "titel")
    assert titel["sichtbar"] is True
    assert titel["pflicht"] is True
    assert _block_key_of(res.json(), "titel") == "kopf"


@pytest.mark.integration
async def test_layout_block_loeschen_felder_umziehen(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    body = await _create_vorlage(client, headers, key="del", label="Del")
    tid = body["id"]

    layout = _layout_from(body)
    layout["bloecke"] = [b for b in layout["bloecke"] if b["block_key"] != "belege"]
    for f in layout["felder"]:
        if f["feld_key"] in ("foto", "dokumente"):
            f["block_key"] = "problem"

    res = await client.put(f"/api/v1/tickettypen/{tid}/layout", headers=headers, json=layout)
    assert res.status_code == 200, res.text
    body2 = res.json()
    assert "belege" not in {b["block_key"] for b in body2["bloecke"]}
    assert _block_key_of(body2, "foto") == "problem"


@pytest.mark.integration
async def test_layout_eltern_sichtbarkeit_422(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    body = await _create_vorlage(client, headers, key="parent", label="Parent")
    tid = body["id"]

    layout = _layout_from(body)
    for f in layout["felder"]:
        if f["feld_key"] == "objekt":
            f["sichtbar"] = False  # Eltern-Feld aus, Kinder (stockwerk…) noch sichtbar

    res = await client.put(f"/api/v1/tickettypen/{tid}/layout", headers=headers, json=layout)
    assert res.status_code == 422, res.text


@pytest.mark.integration
async def test_layout_geschuetzte_bloecke_bleiben(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    body = await _create_vorlage(client, headers, key="prot", label="Prot")
    tid = body["id"]

    layout = _layout_from(body)
    layout["bloecke"] = [b for b in layout["bloecke"] if b["block_key"] not in ("kopf", "weitere")]
    res = await client.put(f"/api/v1/tickettypen/{tid}/layout", headers=headers, json=layout)
    assert res.status_code == 200, res.text
    keys = {b["block_key"] for b in res.json()["bloecke"]}
    assert "kopf" in keys
    assert "weitere" in keys


@pytest.mark.integration
async def test_layout_cross_vorlage_isolation(client, admin_user) -> None:
    """block_key wird NUR innerhalb der eigenen Vorlage aufgelöst — ein Save auf A
    darf B nicht berühren (IDOR-sicher per Key statt ID)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    a = await _create_vorlage(client, headers, key="iso-a", label="Iso A")
    b = await _create_vorlage(client, headers, key="iso-b", label="Iso B")

    layout_a = _layout_from(a)
    for blk in layout_a["bloecke"]:
        if blk["block_key"] == "belege":
            blk["label"] = "A-Belege"
    res = await client.put(f"/api/v1/tickettypen/{a['id']}/layout", headers=headers, json=layout_a)
    assert res.status_code == 200, res.text

    b_after = await client.get(f"/api/v1/tickettypen/{b['id']}", headers=headers)
    belege_b = next(x for x in b_after.json()["bloecke"] if x["block_key"] == "belege")
    assert belege_b["label"] == "Belege & Kommunikation"  # unverändert


@pytest.mark.integration
async def test_layout_alles_vorlage_sichtbar_gesperrt(client, admin_user, db, mandant) -> None:
    await svc.ensure_default_vorlagen(db, mandant.id)
    await db.commit()

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    listing = await client.get("/api/v1/tickettypen", headers=headers)
    alles = next(t for t in listing.json() if t["ist_alles_vorlage"])

    body = (await client.get(f"/api/v1/tickettypen/{alles['id']}", headers=headers)).json()
    layout = _layout_from(body)
    for f in layout["felder"]:
        if f["feld_key"] == "quelle":
            f["sichtbar"] = False  # Versuch, in der Alles-Vorlage auszublenden

    res = await client.put(
        f"/api/v1/tickettypen/{alles['id']}/layout", headers=headers, json=layout
    )
    assert res.status_code == 200, res.text
    quelle = next(f for f in res.json()["felder"] if f["feld_key"] == "quelle")
    assert quelle["sichtbar"] is True  # Lock greift
