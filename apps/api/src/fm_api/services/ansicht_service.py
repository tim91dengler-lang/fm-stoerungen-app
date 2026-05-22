from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from fm_api.models import GespeicherteAnsicht


class AnsichtNotFoundError(Exception):
    pass


class DuplicateAnsichtNameError(Exception):
    pass


async def list_ansichten(
    db: AsyncSession, user_id: UUID, *, view_key: str | None = None
) -> list[GespeicherteAnsicht]:
    stmt = select(GespeicherteAnsicht).where(GespeicherteAnsicht.user_id == user_id)
    if view_key:
        stmt = stmt.where(GespeicherteAnsicht.view_key == view_key)
    stmt = stmt.order_by(GespeicherteAnsicht.ist_default.desc(), GespeicherteAnsicht.name)
    return list((await db.execute(stmt)).scalars().all())


async def get_ansicht(db: AsyncSession, ansicht_id: UUID, user_id: UUID) -> GespeicherteAnsicht:
    stmt = select(GespeicherteAnsicht).where(
        GespeicherteAnsicht.id == ansicht_id, GespeicherteAnsicht.user_id == user_id
    )
    ansicht = (await db.execute(stmt)).scalar_one_or_none()
    if ansicht is None:
        raise AnsichtNotFoundError(f"ansicht {ansicht_id} not found")
    return ansicht


async def create_ansicht(
    db: AsyncSession,
    user_id: UUID,
    *,
    view_key: str,
    name: str,
    config: dict[str, Any],
    ist_default: bool = False,
) -> GespeicherteAnsicht:
    if ist_default:
        # Bestehende Defaults für gleichen view_key entmarkieren
        await db.execute(
            update(GespeicherteAnsicht)
            .where(
                GespeicherteAnsicht.user_id == user_id,
                GespeicherteAnsicht.view_key == view_key,
                GespeicherteAnsicht.ist_default.is_(True),
            )
            .values(ist_default=False)
        )

    ansicht = GespeicherteAnsicht(
        user_id=user_id,
        view_key=view_key,
        name=name,
        config=config,
        ist_default=ist_default,
    )
    db.add(ansicht)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise DuplicateAnsichtNameError(
            f"ansicht '{name}' for view '{view_key}' already exists"
        ) from exc
    await db.refresh(ansicht)
    return ansicht


async def update_ansicht(
    db: AsyncSession,
    ansicht_id: UUID,
    user_id: UUID,
    updates: dict[str, Any],
) -> GespeicherteAnsicht:
    ansicht = await get_ansicht(db, ansicht_id, user_id)
    if updates.get("ist_default"):
        await db.execute(
            update(GespeicherteAnsicht)
            .where(
                GespeicherteAnsicht.user_id == user_id,
                GespeicherteAnsicht.view_key == ansicht.view_key,
                GespeicherteAnsicht.id != ansicht_id,
                GespeicherteAnsicht.ist_default.is_(True),
            )
            .values(ist_default=False)
        )

    if "name" in updates and updates["name"] is not None:
        ansicht.name = updates["name"]
    if "config" in updates and updates["config"] is not None:
        ansicht.config = updates["config"]
    if "ist_default" in updates and updates["ist_default"] is not None:
        ansicht.ist_default = updates["ist_default"]

    await db.flush()
    await db.refresh(ansicht)
    return ansicht


async def delete_ansicht(db: AsyncSession, ansicht_id: UUID, user_id: UUID) -> None:
    ansicht = await get_ansicht(db, ansicht_id, user_id)
    await db.delete(ansicht)
    await db.flush()
