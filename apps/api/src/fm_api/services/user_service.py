from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.core.security import hash_password
from fm_api.models import Role, User


class UserNotFoundError(Exception):
    pass


class EmailAlreadyTakenError(Exception):
    pass


class RoleNotFoundError(Exception):
    pass


async def list_users(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    include_inactive: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[User], int]:
    base = select(User).where(
        User.mandant_id == mandant_id,
        User.deleted_at.is_(None),
    )
    if not include_inactive:
        base = base.where(User.is_active.is_(True))
    if search:
        like = f"%{search.lower()}%"
        base = base.where(func.lower(User.full_name).like(like) | func.lower(User.email).like(like))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    items_stmt = (
        base.options(selectinload(User.roles)).order_by(User.full_name).limit(limit).offset(offset)
    )
    items = (await db.execute(items_stmt)).scalars().unique().all()
    return list(items), total


async def get_user(db: AsyncSession, user_id: UUID, mandant_id: UUID) -> User:
    stmt = (
        select(User)
        .where(
            User.id == user_id,
            User.mandant_id == mandant_id,
            User.deleted_at.is_(None),
        )
        .options(selectinload(User.roles))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise UserNotFoundError(f"user {user_id} not found")
    return user


async def _fetch_roles(
    db: AsyncSession,
    role_ids: list[UUID],
    mandant_id: UUID,
) -> list[Role]:
    if not role_ids:
        return []
    stmt = select(Role).where(Role.id.in_(role_ids), Role.mandant_id == mandant_id)
    roles = list((await db.execute(stmt)).scalars().all())
    if len(roles) != len(set(role_ids)):
        raise RoleNotFoundError("one or more roles do not exist in this tenant")
    return roles


async def create_user(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    email: str,
    full_name: str,
    password: str,
    role_ids: list[UUID],
) -> User:
    existing_stmt = select(User).where(
        User.mandant_id == mandant_id,
        func.lower(User.email) == email.lower(),
    )
    if (await db.execute(existing_stmt)).scalar_one_or_none() is not None:
        raise EmailAlreadyTakenError(f"email '{email}' already exists in this tenant")

    roles = await _fetch_roles(db, role_ids, mandant_id)

    user = User(
        mandant_id=mandant_id,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        is_active=True,
        roles=roles,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user, ["roles"])
    return user


async def update_user(
    db: AsyncSession,
    user_id: UUID,
    mandant_id: UUID,
    *,
    full_name: str | None = None,
    is_active: bool | None = None,
    password: str | None = None,
    role_ids: list[UUID] | None = None,
) -> User:
    user = await get_user(db, user_id, mandant_id)

    if full_name is not None:
        user.full_name = full_name
    if is_active is not None:
        user.is_active = is_active
    if password is not None:
        user.password_hash = hash_password(password)
    if role_ids is not None:
        user.roles = await _fetch_roles(db, role_ids, mandant_id)

    await db.flush()
    await db.refresh(user, ["roles"])
    return user


async def soft_delete_user(
    db: AsyncSession,
    user_id: UUID,
    mandant_id: UUID,
) -> None:
    user = await get_user(db, user_id, mandant_id)
    user.is_active = False
    user.deleted_at = datetime.now(UTC)
    await db.flush()
