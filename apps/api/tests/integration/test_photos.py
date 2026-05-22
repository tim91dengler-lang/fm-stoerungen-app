import io
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
        json={"titel": "Foto-Test"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# 1x1 PNG, valides Mini-Bild
_PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfa\xcf\xc0\x00"
    b"\x00\x00\x03\x00\x01\xa7\xa6\xbb\x9a\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(autouse=True)
def _isolated_upload_dir(monkeypatch):
    """Verwende ein Temp-Dir für Tests, damit kein /var/uploads-Mount nötig ist."""
    with tempfile.TemporaryDirectory() as td:
        from fm_api.core.config import get_settings

        get_settings.cache_clear()
        monkeypatch.setenv("UPLOAD_DIR", td)
        yield Path(td)
        get_settings.cache_clear()


@pytest.mark.integration
async def test_upload_and_list_photo(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    files = {"file": ("test.png", io.BytesIO(_PNG_1X1), "image/png")}
    res = await client.post(
        f"/api/v1/tickets/{tid}/photos",
        headers=headers,
        files=files,
        data={"beschreibung": "Schaden am Tor"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["filename"] == "test.png"
    assert body["mime_type"] == "image/png"
    assert body["beschreibung"] == "Schaden am Tor"
    assert body["annotations"] == []

    listed = await client.get(f"/api/v1/tickets/{tid}/photos", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


@pytest.mark.integration
async def test_unsupported_mime_returns_415(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    files = {"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}
    res = await client.post(f"/api/v1/tickets/{tid}/photos", headers=headers, files=files)
    assert res.status_code == 415


@pytest.mark.integration
async def test_stream_photo_returns_image(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    files = {"file": ("test.png", io.BytesIO(_PNG_1X1), "image/png")}
    upload = await client.post(f"/api/v1/tickets/{tid}/photos", headers=headers, files=files)
    pid = upload.json()["id"]

    stream = await client.get(f"/api/v1/tickets/{tid}/photos/{pid}/file", headers=headers)
    assert stream.status_code == 200
    assert stream.headers["content-type"] == "image/png"
    assert stream.content == _PNG_1X1


@pytest.mark.integration
async def test_update_annotations(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    files = {"file": ("test.png", io.BytesIO(_PNG_1X1), "image/png")}
    upload = await client.post(f"/api/v1/tickets/{tid}/photos", headers=headers, files=files)
    pid = upload.json()["id"]

    res = await client.patch(
        f"/api/v1/tickets/{tid}/photos/{pid}",
        headers=headers,
        json={
            "annotations": [
                {"type": "stempel", "kind": "defekt", "x": 0.3, "y": 0.5},
                {"type": "kreis", "color": "red", "x": 0.5, "y": 0.5, "r": 0.1},
            ]
        },
    )
    assert res.status_code == 200, res.text
    assert len(res.json()["annotations"]) == 2


@pytest.mark.integration
async def test_photos_require_auth(client) -> None:
    fake_tid = "00000000-0000-0000-0000-000000000000"
    assert (await client.get(f"/api/v1/tickets/{fake_tid}/photos")).status_code == 401
