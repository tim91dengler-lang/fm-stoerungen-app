from fastapi import APIRouter, HTTPException, status

from fm_api.core.deps import DbSession
from fm_api.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    UserInToken,
)
from fm_api.services.auth_service import (
    InactiveUserError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    authenticate,
    make_token_pair,
    refresh_access_token,
)

router = APIRouter()


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login mit E-Mail und Passwort",
    responses={
        401: {"description": "Falsche Zugangsdaten"},
        403: {"description": "Benutzer inaktiv"},
    },
)
async def login(payload: LoginRequest, db: DbSession) -> LoginResponse:
    try:
        user = await authenticate(db, payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except InactiveUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    access, refresh = make_token_pair(user)
    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserInToken(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            mandant_id=user.mandant_id,
            roles=[r.name for r in user.roles],
        ),
    )


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Access-Token mit Refresh-Token erneuern",
    responses={401: {"description": "Refresh-Token ungültig"}},
)
async def refresh(payload: RefreshRequest, db: DbSession) -> AccessTokenResponse:
    try:
        access = await refresh_access_token(db, payload.refresh_token)
    except InvalidRefreshTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    return AccessTokenResponse(access_token=access)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout (clientseitig — Token wird verworfen)",
)
async def logout() -> None:
    # Stateless logout in Slice 1 — client clears tokens.
    # Refresh-token blacklist will be added in Slice 2 with Redis.
    return None
