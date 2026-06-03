"""Integrationstests für die Beteiligten-Schreibpfade der Objektstruktur (Phase 2b).

Deckt Voll-Replace (add / rolle ändern / entfernen) über Haus, Stockwerk und
Einheit ab — plus die FK-Mandantenvalidierung (fremder Partner / fremde Rolle → 400).
"""

import pytest

from tests.conftest import auth_header, login

NONEXISTENT = "00000000-0000-0000-0000-000000000000"


async def _login_admin(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_partner(client, headers, name: str) -> str:
    res = await client.post("/api/v1/partner", headers=headers, json={"name": name, "typen": []})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_objekt(client, headers, name: str = "Objekt B") -> str:
    res = await client.post("/api/v1/objekte", headers=headers, json={"name": name})
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_kontakt(
    client, headers, partner_id: str, vorname: str, nachname: str, email: str
) -> str:
    res = await client.post(
        f"/api/v1/partner/{partner_id}/kontakte",
        headers=headers,
        json={"vorname": vorname, "nachname": nachname, "email": email},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_haus(client, headers, objekt_id: str, bez: str = "Haus 1") -> str:
    res = await client.post(
        f"/api/v1/objektstruktur/objekte/{objekt_id}/haus",
        headers=headers,
        json={"bezeichnung": bez},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _rolle_ids(client, headers) -> dict[str, str]:
    """slug → wert-id für die Liste ``objekt_beteiligten_rolle``."""
    res = await client.get("/api/v1/auswahllisten", headers=headers)
    assert res.status_code == 200, res.text
    liste = next(liste for liste in res.json() if liste["key"] == "objekt_beteiligten_rolle")
    return {w["key"]: w["id"] for w in liste["werte"]}


@pytest.mark.integration
async def test_haus_beteiligte_add_change_remove(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "Beteiligter P1")
    rollen = await _rolle_ids(client, headers)

    # add
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id, "rolle_id": rollen["eigentuemer"]}]},
    )
    assert res.status_code == 200, res.text
    bet = res.json()["beteiligte"]
    assert len(bet) == 1
    assert bet[0]["partner_id"] == partner_id
    assert bet[0]["partner_name"] == "Beteiligter P1"
    assert bet[0]["rolle_label"] == "Eigentümer"
    row_id = bet[0]["id"]

    # persisted in the tree-read
    tree = await client.get(f"/api/v1/objektstruktur/objekte/{objekt_id}/haus", headers=headers)
    assert tree.json()[0]["beteiligte"][0]["rolle_label"] == "Eigentümer"

    # change rolle (same id → update, not duplicate)
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={
            "beteiligte": [{"id": row_id, "partner_id": partner_id, "rolle_id": rollen["mieter"]}]
        },
    )
    assert res.status_code == 200, res.text
    bet = res.json()["beteiligte"]
    assert len(bet) == 1
    assert bet[0]["id"] == row_id
    assert bet[0]["rolle_label"] == "Mieter"

    # remove (empty list)
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": []},
    )
    assert res.status_code == 200, res.text
    assert res.json()["beteiligte"] == []


@pytest.mark.integration
async def test_haus_beteiligte_multiple_roles_same_partner(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "Doppel-Rolle P")
    rollen = await _rolle_ids(client, headers)

    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={
            "beteiligte": [
                {"partner_id": partner_id, "rolle_id": rollen["eigentuemer"]},
                {"partner_id": partner_id, "rolle_id": rollen["mieter"]},
            ]
        },
    )
    assert res.status_code == 200, res.text
    labels = sorted(b["rolle_label"] for b in res.json()["beteiligte"])
    assert labels == ["Eigentümer", "Mieter"]


@pytest.mark.integration
async def test_stockwerk_and_einheit_beteiligte(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "SW/E Partner")
    rollen = await _rolle_ids(client, headers)

    sw = await client.post(
        f"/api/v1/objektstruktur/haus/{haus_id}/stockwerke",
        headers=headers,
        json={"bezeichnung": "EG"},
    )
    assert sw.status_code == 201, sw.text
    sw_id = sw.json()["id"]
    res = await client.patch(
        f"/api/v1/objektstruktur/stockwerke/{sw_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id, "rolle_id": rollen["verwalter"]}]},
    )
    assert res.status_code == 200, res.text
    assert res.json()["beteiligte"][0]["rolle_label"] == "Verwalter"

    e = await client.post(
        f"/api/v1/objektstruktur/stockwerke/{sw_id}/einheiten",
        headers=headers,
        json={"bezeichnung": "Whg 1"},
    )
    assert e.status_code == 201, e.text
    e_id = e.json()["id"]
    res = await client.patch(
        f"/api/v1/objektstruktur/einheiten/{e_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id, "rolle_id": rollen["mieter"]}]},
    )
    assert res.status_code == 200, res.text
    assert res.json()["beteiligte"][0]["rolle_label"] == "Mieter"


@pytest.mark.integration
async def test_unknown_partner_rejected(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    rollen = await _rolle_ids(client, headers)

    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": NONEXISTENT, "rolle_id": rollen["mieter"]}]},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_unknown_rolle_rejected(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "P-bad-rolle")

    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id, "rolle_id": NONEXISTENT}]},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_beteiligter_mit_mehreren_kontakten(client, admin_user) -> None:
    """Modell A: ein Beteiligter (Partner + Rolle) mit MEHREREN Ansprechpartnern
    desselben Partners (z. B. Eigentümer Familie Stein → Herr + Frau)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "Familie Stein")
    k1 = await _create_kontakt(client, headers, partner_id, "Hans", "Stein", "hans@stein.de")
    k2 = await _create_kontakt(client, headers, partner_id, "Eva", "Stein", "eva@stein.de")
    rollen = await _rolle_ids(client, headers)

    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={
            "beteiligte": [
                {
                    "partner_id": partner_id,
                    "rolle_id": rollen["eigentuemer"],
                    "partner_kontakt_ids": [k1, k2],
                }
            ]
        },
    )
    assert res.status_code == 200, res.text
    bet = res.json()["beteiligte"]
    assert len(bet) == 1
    kontakte = bet[0]["kontakte"]
    assert len(kontakte) == 2
    namen = {k["name"] for k in kontakte}
    assert namen == {"Hans Stein", "Eva Stein"}
    emails = {k["email"] for k in kontakte}
    assert emails == {"hans@stein.de", "eva@stein.de"}

    # Tree-Read liefert die Kontakte ebenfalls
    tree = await client.get(f"/api/v1/objektstruktur/objekte/{objekt_id}/haus", headers=headers)
    assert len(tree.json()[0]["beteiligte"][0]["kontakte"]) == 2

    # Kontakt entfernen (nur k1 behalten)
    row_id = bet[0]["id"]
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={
            "beteiligte": [
                {
                    "id": row_id,
                    "partner_id": partner_id,
                    "rolle_id": rollen["eigentuemer"],
                    "partner_kontakt_ids": [k1],
                }
            ]
        },
    )
    assert res.status_code == 200, res.text
    kontakte = res.json()["beteiligte"][0]["kontakte"]
    assert len(kontakte) == 1 and kontakte[0]["name"] == "Hans Stein"


@pytest.mark.integration
async def test_kontakt_fremder_partner_rejected(client, admin_user) -> None:
    """Ein Ansprechpartner, der zu einem ANDEREN Partner gehört, darf nicht
    zugeordnet werden → 400 (IDOR/Datenintegrität)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_a = await _create_partner(client, headers, "Partner A")
    partner_b = await _create_partner(client, headers, "Partner B")
    kontakt_b = await _create_kontakt(client, headers, partner_b, "Otto", "B", "otto@b.de")
    rollen = await _rolle_ids(client, headers)

    # Partner A, aber Kontakt von Partner B → 400
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={
            "beteiligte": [
                {
                    "partner_id": partner_a,
                    "rolle_id": rollen["mieter"],
                    "partner_kontakt_ids": [kontakt_b],
                }
            ]
        },
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_cross_mandant_partner_and_rolle_rejected(client, admin_user, db) -> None:
    """Echter Cross-Mandant-Fall: Partner bzw. Rolle aus einem FREMDEN Mandanten
    dürfen nicht angehängt werden → 400 (IDOR-Schutz)."""
    from uuid import uuid4

    from sqlalchemy import text

    from fm_api.models import GeschaeftsPartner, Mandant
    from fm_api.services.auswahlliste_service import ensure_system_auswahllisten

    other = Mandant(name="Fremd-Mandant", slug=f"fremd-{uuid4().hex[:8]}")
    db.add(other)
    await db.flush()
    await ensure_system_auswahllisten(db, other.id)
    foreign_partner = GeschaeftsPartner(mandant_id=other.id, name="Fremd-Partner", typen=[])
    db.add(foreign_partner)
    await db.flush()
    foreign_rolle_id = (
        await db.execute(
            text(
                "SELECT w.id FROM auswahllisten_werte w "
                "JOIN auswahllisten l ON l.id = w.auswahlliste_id "
                "WHERE l.mandant_id = :mid AND l.key = 'objekt_beteiligten_rolle' LIMIT 1"
            ).bindparams(mid=other.id)
        )
    ).scalar_one()
    await db.commit()

    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    rollen = await _rolle_ids(client, headers)
    own_partner = await _create_partner(client, headers, "Eigen-Partner")

    # fremder Partner → 400
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={
            "beteiligte": [{"partner_id": str(foreign_partner.id), "rolle_id": rollen["mieter"]}]
        },
    )
    assert res.status_code == 400, res.text

    # fremde Rolle → 400
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": own_partner, "rolle_id": str(foreign_rolle_id)}]},
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_foreign_node_id_creates_new_row_no_hijack(client, admin_user) -> None:
    """Eine Beteiligten-``id`` eines ANDEREN Knotens darf nicht gekapert/verschoben
    werden: sie landet als neue Zeile am Zielknoten, der Quellknoten bleibt intakt."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    n1 = await _create_haus(client, headers, objekt_id, "Haus N1")
    n2 = await _create_haus(client, headers, objekt_id, "Haus N2")
    partner_id = await _create_partner(client, headers, "Hijack-Test P")
    rollen = await _rolle_ids(client, headers)

    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{n1}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id, "rolle_id": rollen["eigentuemer"]}]},
    )
    assert res.status_code == 200, res.text
    n1_row_id = res.json()["beteiligte"][0]["id"]

    # N2 mit der id von N1 patchen → neue Zeile an N2, KEIN Move
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{n2}",
        headers=headers,
        json={
            "beteiligte": [
                {"id": n1_row_id, "partner_id": partner_id, "rolle_id": rollen["mieter"]}
            ]
        },
    )
    assert res.status_code == 200, res.text
    n2_bet = res.json()["beteiligte"]
    assert len(n2_bet) == 1
    assert n2_bet[0]["id"] != n1_row_id  # neue Zeile, nicht die gekaperte

    # N1 unverändert
    tree = await client.get(f"/api/v1/objektstruktur/objekte/{objekt_id}/haus", headers=headers)
    haeuser = {h["id"]: h for h in tree.json()}
    n1_bet = haeuser[n1]["beteiligte"]
    assert len(n1_bet) == 1
    assert n1_bet[0]["id"] == n1_row_id
    assert n1_bet[0]["rolle_label"] == "Eigentümer"


@pytest.mark.integration
async def test_objekte_liste_zeigt_struktur_beteiligte_summary(client, admin_user) -> None:
    """Die Objekte-Hauptliste aggregiert die Struktur-Beteiligten (Haus/Stockwerk/
    Einheit) je Objekt in `beteiligte_summary`."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers, "Summary-Objekt")
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "Summary-Eigentümer")
    rollen = await _rolle_ids(client, headers)

    # Beteiligter auf Haus-Ebene
    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id, "rolle_id": rollen["eigentuemer"]}]},
    )
    assert res.status_code == 200, res.text

    res = await client.get("/api/v1/objekte?limit=500", headers=headers)
    assert res.status_code == 200, res.text
    obj = next(o for o in res.json()["items"] if o["id"] == objekt_id)
    summary = obj["beteiligte_summary"]
    assert any(
        s["partner_name"] == "Summary-Eigentümer" and s["rolle_label"] == "Eigentümer"
        for s in summary
    ), summary


@pytest.mark.integration
async def test_objekt_ebene_beteiligte_crud_und_summary(client, admin_user) -> None:
    """Objekt-Ebene: Beteiligte direkt am Objekt setzen/lesen; erscheinen auch in
    der Objekte-Listen-Aggregation."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers, "Objekt-Ebene-Test")
    partner_id = await _create_partner(client, headers, "Objekt-Eigentümer")
    rollen = await _rolle_ids(client, headers)

    # leer am Anfang
    res = await client.get(
        f"/api/v1/objektstruktur/objekte/{objekt_id}/beteiligte", headers=headers
    )
    assert res.status_code == 200, res.text
    assert res.json() == []

    # setzen
    res = await client.patch(
        f"/api/v1/objektstruktur/objekte/{objekt_id}/beteiligte",
        headers=headers,
        json=[{"partner_id": partner_id, "rolle_id": rollen["eigentuemer"]}],
    )
    assert res.status_code == 200, res.text
    bet = res.json()
    assert len(bet) == 1 and bet[0]["rolle_label"] == "Eigentümer"

    # GET liefert es
    res = await client.get(
        f"/api/v1/objektstruktur/objekte/{objekt_id}/beteiligte", headers=headers
    )
    assert len(res.json()) == 1

    # taucht in der Objekte-Listen-Aggregation auf
    res = await client.get("/api/v1/objekte?limit=500", headers=headers)
    obj = next(o for o in res.json()["items"] if o["id"] == objekt_id)
    assert any(
        s["partner_name"] == "Objekt-Eigentümer" and s["rolle_label"] == "Eigentümer"
        for s in obj["beteiligte_summary"]
    )


@pytest.mark.integration
async def test_objekt_beteiligte_unknown_partner_rejected(client, admin_user) -> None:
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers, "Objekt-Ebene-IDOR")
    rollen = await _rolle_ids(client, headers)
    res = await client.patch(
        f"/api/v1/objektstruktur/objekte/{objekt_id}/beteiligte",
        headers=headers,
        json=[{"partner_id": NONEXISTENT, "rolle_id": rollen["mieter"]}],
    )
    assert res.status_code == 400, res.text


@pytest.mark.integration
async def test_rolle_null_allowed(client, admin_user) -> None:
    """Eine Beteiligten-Zeile ohne Rolle ist erlaubt (Rolle optional)."""
    token = await _login_admin(client, admin_user)
    headers = auth_header(token)
    objekt_id = await _create_objekt(client, headers)
    haus_id = await _create_haus(client, headers, objekt_id)
    partner_id = await _create_partner(client, headers, "P-ohne-rolle")

    res = await client.patch(
        f"/api/v1/objektstruktur/haus/{haus_id}",
        headers=headers,
        json={"beteiligte": [{"partner_id": partner_id}]},
    )
    assert res.status_code == 200, res.text
    bet = res.json()["beteiligte"]
    assert len(bet) == 1
    assert bet[0]["rolle_id"] is None
    assert bet[0]["rolle_label"] is None
