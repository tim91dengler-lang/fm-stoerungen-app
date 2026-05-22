from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.gespeicherte_ansicht import (
    GespeicherteAnsichtCreate,
    GespeicherteAnsichtRead,
    GespeicherteAnsichtUpdate,
)
from fm_api.services import ansicht_service
from fm_api.services.ansicht_service import (
    AnsichtNotFoundError,
    DuplicateAnsichtNameError,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[GespeicherteAnsichtRead],
    summary="Gespeicherte Ansichten des aktuellen Users",
)
async def list_ansichten(
    db: AuditedDbSession,
    current: CurrentUserDep,
    view_key: str | None = Query(default=None, max_length=64),
) -> list[GespeicherteAnsichtRead]:
    items = await ansicht_service.list_ansichten(db, current.user_id, view_key=view_key)
    return [GespeicherteAnsichtRead.model_validate(a) for a in items]


@router.post(
    "",
    response_model=GespeicherteAnsichtRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ansicht speichern",
)
async def create_ansicht(
    payload: GespeicherteAnsichtCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> GespeicherteAnsichtRead:
    try:
        ansicht = await ansicht_service.create_ansicht(
            db,
            current.user_id,
            view_key=payload.view_key,
            name=payload.name,
            config=payload.config,
            ist_default=payload.ist_default,
        )
    except DuplicateAnsichtNameError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return GespeicherteAnsichtRead.model_validate(ansicht)


@router.patch(
    "/{ansicht_id}",
    response_model=GespeicherteAnsichtRead,
    summary="Ansicht bearbeiten",
)
async def update_ansicht(
    ansicht_id: UUID,
    payload: GespeicherteAnsichtUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> GespeicherteAnsichtRead:
    try:
        ansicht = await ansicht_service.update_ansicht(
            db, ansicht_id, current.user_id, payload.model_dump(exclude_unset=True)
        )
    except AnsichtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return GespeicherteAnsichtRead.model_validate(ansicht)


@router.delete(
    "/{ansicht_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Ansicht löschen",
)
async def delete_ansicht(
    ansicht_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await ansicht_service.delete_ansicht(db, ansicht_id, current.user_id)
    except AnsichtNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
