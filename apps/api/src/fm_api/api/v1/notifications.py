from fastapi import APIRouter, Query

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.notification import NotificationMarkRead, NotificationRead
from fm_api.services import notification_service

router = APIRouter()


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    db: AuditedDbSession,
    current: CurrentUserDep,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[NotificationRead]:
    items = await notification_service.list_unread(
        db, current.mandant_id, current.user_id, limit=limit
    )
    return [NotificationRead.model_validate(n) for n in items]


@router.get("/count")
async def count_unread(db: AuditedDbSession, current: CurrentUserDep) -> dict[str, int]:
    n = await notification_service.count_unread(db, current.mandant_id, current.user_id)
    return {"unread": n}


@router.post("/mark-read")
async def mark_read(
    payload: NotificationMarkRead, db: AuditedDbSession, current: CurrentUserDep
) -> dict[str, str]:
    await notification_service.mark_read(db, current.user_id, payload.ids)
    return {"status": "ok"}


@router.post("/mark-all-read")
async def mark_all_read(db: AuditedDbSession, current: CurrentUserDep) -> dict[str, str]:
    await notification_service.mark_all_read(db, current.user_id)
    return {"status": "ok"}
