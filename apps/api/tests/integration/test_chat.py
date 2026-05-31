import pytest

from tests.conftest import auth_header, login


async def _login(client, user_tuple) -> str:
    user, raw_pw = user_tuple
    return await login(client, user.email, raw_pw)


async def _create_ticket(client, headers) -> str:
    res = await client.post(
        "/api/v1/tickets",
        headers=headers,
        json={"titel": "Chat-Test"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.integration
async def test_post_and_list_message(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    res = await client.post(
        f"/api/v1/tickets/{tid}/messages",
        headers=headers,
        json={"text": "Erstes Update vom Vor-Ort-Termin"},
    )
    assert res.status_code == 201, res.text
    msg = res.json()
    assert msg["text"] == "Erstes Update vom Vor-Ort-Termin"
    assert msg["autor"]["full_name"] == "Test Admin"

    listed = await client.get(f"/api/v1/tickets/{tid}/messages", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert len(body) == 1
    assert body[0]["text"] == "Erstes Update vom Vor-Ort-Termin"


@pytest.mark.integration
async def test_mentions_persisted(client, admin_user, techniker_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)
    tech_user, _ = techniker_user

    res = await client.post(
        f"/api/v1/tickets/{tid}/messages",
        headers=headers,
        json={
            "text": f"@{tech_user.full_name} bitte vor Ort schauen",
            "mentions": [str(tech_user.id)],
        },
    )
    assert res.status_code == 201
    assert res.json()["mentions"] == [str(tech_user.id)]


@pytest.mark.integration
async def test_delete_own_message_works(client, admin_user) -> None:
    token = await _login(client, admin_user)
    headers = auth_header(token)
    tid = await _create_ticket(client, headers)

    create = await client.post(
        f"/api/v1/tickets/{tid}/messages",
        headers=headers,
        json={"text": "wird gleich gelöscht"},
    )
    mid = create.json()["id"]
    delete = await client.delete(f"/api/v1/tickets/{tid}/messages/{mid}", headers=headers)
    assert delete.status_code == 204

    listed = await client.get(f"/api/v1/tickets/{tid}/messages", headers=headers)
    assert listed.json() == []


@pytest.mark.integration
async def test_chat_requires_auth(client) -> None:
    fake_tid = "00000000-0000-0000-0000-000000000000"
    res = await client.get(f"/api/v1/tickets/{fake_tid}/messages")
    assert res.status_code == 401


@pytest.mark.integration
async def test_mark_read_records_reader(client, admin_user, techniker_user) -> None:
    admin_headers = auth_header(await _login(client, admin_user))
    tid = await _create_ticket(client, admin_headers)

    msg = await client.post(
        f"/api/v1/tickets/{tid}/messages",
        headers=admin_headers,
        json={"text": "Bitte lesen"},
    )
    assert msg.status_code == 201
    assert msg.json()["gelesen_von"] == []

    tech_user, _ = techniker_user
    tech_headers = auth_header(await _login(client, techniker_user))
    read = await client.post(f"/api/v1/tickets/{tid}/messages/mark-read", headers=tech_headers)
    assert read.status_code == 204, read.text

    listed = await client.get(f"/api/v1/tickets/{tid}/messages", headers=admin_headers)
    assert listed.json()[0]["gelesen_von"] == [str(tech_user.id)]
