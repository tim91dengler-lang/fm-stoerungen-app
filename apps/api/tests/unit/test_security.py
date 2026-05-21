from datetime import timedelta
from uuid import uuid4

import pytest

from fm_api.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


@pytest.mark.unit
class TestPasswordHashing:
    def test_hash_and_verify_succeeds(self) -> None:
        plain = "correct horse battery staple"
        hashed = hash_password(plain)
        assert hashed != plain
        assert verify_password(plain, hashed) is True

    def test_verify_with_wrong_password_fails(self) -> None:
        hashed = hash_password("right")
        assert verify_password("wrong", hashed) is False

    def test_hash_is_unique_each_call(self) -> None:
        # bcrypt embeds a random salt; same input must yield different hashes
        assert hash_password("same") != hash_password("same")


@pytest.mark.unit
class TestJwtTokens:
    def test_access_token_roundtrip(self) -> None:
        user_id = uuid4()
        mandant_id = uuid4()
        token = create_access_token(user_id, mandant_id, roles=["admin"])
        payload = decode_token(token, expected_type="access")
        assert payload["sub"] == str(user_id)
        assert payload["mandant_id"] == str(mandant_id)
        assert payload["roles"] == ["admin"]
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self) -> None:
        user_id = uuid4()
        token = create_refresh_token(user_id)
        payload = decode_token(token, expected_type="refresh")
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"

    def test_decode_with_wrong_type_raises(self) -> None:
        token = create_access_token(uuid4(), uuid4())
        with pytest.raises(TokenError, match="wrong token type"):
            decode_token(token, expected_type="refresh")

    def test_decode_garbage_raises(self) -> None:
        with pytest.raises(TokenError):
            decode_token("not-a-real-token")
