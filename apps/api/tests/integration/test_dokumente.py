import io
import json
import tempfile
from pathlib import Path

import pytest

from tests.conftest import auth_header, login


async def _login(client, admin_user) -> str:
    user, raw_pw = admin_user
    return await login(client, user.email, raw_pw)


async def _create_ticket(client, headers) -> str:
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Dokument-Test"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


_PDF = b"%PDF-1.4 minimal test\n%%EOF\n"


@pytest.fixture(autouse=True)
def _isolated_upload_dir(monkeypatch):
    """Temp-Dir für Uploads, damit kein /var/uploads-Mount nötig ist."""
    with tempfile.TemporaryDirectory() as td:
        from fm_api.core.config import get_settings

        get_settings.cache_clear()
        monkeypatch.setenv("UPLOAD_DIR", td)
        yield Path(td)
        get_settings.cache_clear()


@pytest.mark.integration
async def test_upload_dokument_with_ticket_link(client, admin_user) -> None:
    """Regression: Upload eines am Ticket verknüpften Dokuments.

    Vorher 500 — DokumentRead.model_validate(orm) scheiterte daran, die
    ORM-DokumentLink-Objekte in DokumentLinkRef zu serialisieren
    (from_attributes fehlte am verschachtelten Schema).
    """
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    files = {"file": ("angebot.pdf", io.BytesIO(_PDF), "application/pdf")}
    res = await client.post(
        "/api/v1/dokumente",
        headers=headers,
        files=files,
        data={
            "name": "angebot.pdf",
            "links_json": json.dumps([{"target_type": "ticket", "target_id": tid}]),
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "angebot.pdf"
    assert body["filename"] == "angebot.pdf"
    assert len(body["links"]) == 1
    assert body["links"][0]["target_type"] == "ticket"
    assert body["links"][0]["target_id"] == tid


@pytest.mark.integration
async def test_list_dokumente_by_ticket(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    files = {"file": ("plan.pdf", io.BytesIO(_PDF), "application/pdf")}
    await client.post(
        "/api/v1/dokumente",
        headers=headers,
        files=files,
        data={
            "name": "plan.pdf",
            "links_json": json.dumps([{"target_type": "ticket", "target_id": tid}]),
        },
    )

    listed = await client.get(
        "/api/v1/dokumente",
        headers=headers,
        params={"target_type": "ticket", "target_id": tid},
    )
    assert listed.status_code == 200, listed.text
    docs = listed.json()
    assert len(docs) == 1
    assert docs[0]["name"] == "plan.pdf"
    assert docs[0]["links"][0]["target_id"] == tid


@pytest.mark.integration
async def test_upload_dokument_without_link(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)

    files = {"file": ("frei.pdf", io.BytesIO(_PDF), "application/pdf")}
    res = await client.post(
        "/api/v1/dokumente",
        headers=headers,
        files=files,
        data={"name": "frei.pdf"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["links"] == []


@pytest.mark.integration
async def test_dokumente_require_auth(client) -> None:
    assert (await client.get("/api/v1/dokumente")).status_code == 401
