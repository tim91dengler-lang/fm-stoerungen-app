from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep, require_role
from fm_api.schemas.common import PaginatedResponse
from fm_api.schemas.user import UserCreate, UserRead, UserUpdate
from fm_api.services import user_service
from fm_api.services.user_service import (
    EmailAlreadyTakenError,
    RoleNotFoundError,
    UserNotFoundError,
)

router = APIRouter()

AdminDep = Annotated[object, Depends(require_role("admin"))]


@router.get(
    "/me",
    response_model=UserRead,
    summary="Eigener User",
)
async def me(
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> UserRead:
    user = await user_service.get_user(db, current.user_id, current.mandant_id)
    return UserRead.model_validate(user)


@router.get(
    "",
    response_model=PaginatedResponse[UserRead],
    summary="Alle User des eigenen Mandanten (Admin only)",
)
async def list_users(
    db: AuditedDbSession,
    current: CurrentUserDep,
    _admin: AdminDep,
    search: str | None = Query(default=None, max_length=200),
    include_inactive: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[UserRead]:
    users, total = await user_service.list_users(
        db,
        current.mandant_id,
        search=search,
        include_inactive=include_inactive,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse[UserRead](
        items=[UserRead.model_validate(u) for u in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="User anlegen (Admin only)",
    responses={409: {"description": "E-Mail im Mandant bereits vergeben"}},
)
async def create_user(
    payload: UserCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
    _admin: AdminDep,
) -> UserRead:
    try:
        user = await user_service.create_user(
            db,
            current.mandant_id,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role_ids=payload.role_ids,
        )
    except EmailAlreadyTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except RoleNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return UserRead.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    summary="User bearbeiten (Admin oder eigener User)",
)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> UserRead:
    if user_id != current.user_id and not current.has_role("admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="only admins can edit other users",
        )

    # Non-admins must not toggle is_active or change roles
    if not current.has_role("admin") and (
        payload.is_active is not None or payload.role_ids is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="only admins can change activity status or roles",
        )

    try:
        user = await user_service.update_user(
            db,
            user_id,
            current.mandant_id,
            full_name=payload.full_name,
            is_active=payload.is_active,
            password=payload.password,
            role_ids=payload.role_ids,
        )
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RoleNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return UserRead.model_validate(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="User soft-delete (Admin only)",
)
async def delete_user(
    user_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
    _admin: AdminDep,
) -> None:
    if user_id == current.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cannot delete your own account",
        )
    try:
        await user_service.soft_delete_user(db, user_id, current.mandant_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
