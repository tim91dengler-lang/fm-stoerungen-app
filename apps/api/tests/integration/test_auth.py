import pytest

from tests.conftest import auth_header, login


@pytest.mark.integration
async def test_login_succeeds_with_correct_credentials(client, admin_user) -> None:
    user, raw_pw = admin_user
    res = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": raw_pw}
    )
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["user"]["email"] == user.email
    assert "admin" in body["user"]["roles"]


@pytest.mark.integration
async def test_login_fails_with_wrong_password(client, admin_user) -> None:
    user, _ = admin_user
    res = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "wrong"}
    )
    assert res.status_code == 401


@pytest.mark.integration
async def test_login_fails_for_unknown_email(client, mandant) -> None:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.org", "password": "anything"},
    )
    assert res.status_code == 401


@pytest.mark.integration
async def test_refresh_returns_new_access_token(client, admin_user) -> None:
    user, raw_pw = admin_user
    login_res = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": raw_pw}
    )
    refresh = login_res.json()["refresh_token"]

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.integration
async def test_me_requires_auth(client) -> None:
    res = await client.get("/api/v1/users/me")
    assert res.status_code == 401


@pytest.mark.integration
async def test_me_returns_current_user(client, admin_user) -> None:
    user, raw_pw = admin_user
    token = await login(client, user.email, raw_pw)
    res = await client.get("/api/v1/users/me", headers=auth_header(token))
    assert res.status_code == 200
    assert res.json()["email"] == user.email
