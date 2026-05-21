from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from fm_api.models import User


class AuthError(Exception):
    pass


class InvalidCredentialsError(AuthError):
    pass


class InactiveUserError(AuthError):
    pass


class InvalidRefreshTokenError(AuthError):
    pass


async def authenticate(
    db: AsyncSession,
    email: str,
    password: str,
) -> User:
    stmt = (
        select(User)
        .where(User.email == email)
        .where(User.deleted_at.is_(None))
        .options(selectinload(User.roles))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()

    # Always verify against a dummy hash on miss to avoid email-enumeration timing leak
    if user is None:
        verify_password(
            password,
            "$2b$12$abcdefghijklmnopqrstuv0nVj9.zXEyJTbQH3i8YkPx3F1Z2u3aO",
        )
        raise InvalidCredentialsError("invalid email or password")

    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("invalid email or password")

    if not user.is_active:
        raise InactiveUserError("user is inactive")

    return user


def make_token_pair(user: User) -> tuple[str, str]:
    role_names = [r.name for r in user.roles]
    access = create_access_token(
        subject=user.id,
        mandant_id=user.mandant_id,
        roles=role_names,
    )
    refresh = create_refresh_token(subject=user.id)
    return access, refresh


async def refresh_access_token(
    db: AsyncSession,
    refresh_token: str,
) -> str:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise InvalidRefreshTokenError(str(exc)) from exc

    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidRefreshTokenError("malformed refresh token") from exc

    stmt = (
        select(User)
        .where(User.id == user_id)
        .where(User.deleted_at.is_(None))
        .options(selectinload(User.roles))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user is None or not user.is_active:
        raise InvalidRefreshTokenError("user not found or inactive")

    return create_access_token(
        subject=user.id,
        mandant_id=user.mandant_id,
        roles=[r.name for r in user.roles],
    )
