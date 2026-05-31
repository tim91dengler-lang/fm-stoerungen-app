from uuid import UUID

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.status_workflow import (
    StatusWertMini,
    StatusWorkflowRead,
    StatusWorkflowUpdate,
)
from fm_api.services import status_workflow_service

router = APIRouter()


async def _build_read(db: AsyncSession, mandant_id: UUID) -> StatusWorkflowRead:
    werte = await status_workflow_service.get_status_werte(db, mandant_id)
    uebergaenge = await status_workflow_service.get_uebergaenge(db, mandant_id)
    grund_flags = await status_workflow_service.get_erfordert_grund(db, mandant_id)
    return StatusWorkflowRead(
        status=[
            StatusWertMini(
                key=w.key,
                label=w.label,
                farbe=w.farbe,
                erfordert_grund=grund_flags.get(w.key, False),
            )
            for w in werte
        ],
        uebergaenge=uebergaenge,
    )


@router.get("", response_model=StatusWorkflowRead)
async def get_status_workflow(db: AuditedDbSession, current: CurrentUserDep) -> StatusWorkflowRead:
    return await _build_read(db, current.mandant_id)


@router.put("", response_model=StatusWorkflowRead)
async def update_status_workflow(
    payload: StatusWorkflowUpdate, db: AuditedDbSession, current: CurrentUserDep
) -> StatusWorkflowRead:
    if payload.uebergaenge is not None:
        await status_workflow_service.set_uebergaenge(db, current.mandant_id, payload.uebergaenge)
    if payload.erfordert_grund is not None:
        await status_workflow_service.set_erfordert_grund(
            db, current.mandant_id, payload.erfordert_grund
        )
    return await _build_read(db, current.mandant_id)
