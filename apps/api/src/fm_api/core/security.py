from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from fm_api.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


class TokenError(Exception):
    pass


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(
    subject: str | UUID,
    expires_delta: timedelta,
    token_type: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + expires_delta,
        "type": token_type,
    }
    if extra_claims:
        claims.update(extra_claims)
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(
    subject: str | UUID,
    mandant_id: str | UUID,
    roles: list[str] | None = None,
) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        expires_delta=timedelta(minutes=settings.jwt_access_token_expires_minutes),
        token_type="access",  # nosec B106 - JWT type identifier, not a credential
        extra_claims={
            "mandant_id": str(mandant_id),
            "roles": roles or [],
        },
    )


def create_refresh_token(subject: str | UUID) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        expires_delta=timedelta(days=settings.jwt_refresh_token_expires_days),
        token_type="refresh",  # nosec B106 - JWT type identifier, not a credential
    )


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise TokenError(f"invalid token: {exc}") from exc

    if expected_type and payload.get("type") != expected_type:
        raise TokenError(f"wrong token type: expected {expected_type}, got {payload.get('type')}")
    return payload
