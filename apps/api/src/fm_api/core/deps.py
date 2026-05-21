from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fm_api.core.security import TokenError, decode_token
from fm_api.db.session import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]


class CurrentUser:
    def __init__(
        self,
        user_id: UUID,
        mandant_id: UUID,
        roles: list[str],
    ) -> None:
        self.user_id = user_id
        self.mandant_id = mandant_id
        self.roles = roles

    def has_role(self, role: str) -> bool:
        return role in self.roles


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1].strip()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    token = _extract_bearer_token(authorization)
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        user_id = UUID(payload["sub"])
        mandant_id = UUID(payload["mandant_id"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="malformed token claims",
        ) from exc

    return CurrentUser(
        user_id=user_id,
        mandant_id=mandant_id,
        roles=payload.get("roles", []),
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def require_role(role: str) -> Callable[[CurrentUser], Awaitable[CurrentUser]]:
    async def _checker(current: CurrentUserDep) -> CurrentUser:
        if not current.has_role(role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"role '{role}' required",
            )
        return current

    return _checker


async def get_audited_db(
    current: CurrentUserDep,
    db: DbSession,
) -> AsyncSession:
    """DB session with audit session variables set — used by all CRUD endpoints.

    The Postgres audit trigger reads ``app.user_id`` and ``app.rolle_id`` from the
    session and writes the acting user into ``system_audit``.
    See pattern audit-trigger-postgres.
    """
    await db.execute(
        text("SELECT set_config('app.user_id', :uid, true)"),
        {"uid": str(current.user_id)},
    )
    await db.execute(
        text("SELECT set_config('app.rolle_id', :rid, true)"),
        {"rid": ",".join(current.roles)},
    )
    return db


AuditedDbSession = Annotated[AsyncSession, Depends(get_audited_db)]
