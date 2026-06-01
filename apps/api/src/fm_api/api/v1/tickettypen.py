from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.tickettyp import (
    LayoutWrite,
    TickettypCreate,
    TickettypFeldUpdate,
    TickettypRead,
    TickettypUpdate,
)
from fm_api.services import tickettyp_service
from fm_api.services.tickettyp_service import (
    LayoutValidationError,
    SystemTickettypProtectedError,
    TickettypFeldNotFoundError,
    TickettypKeyConflictError,
    TickettypNotFoundError,
)

router = APIRouter()


@router.get("", response_model=list[TickettypRead])
async def list_tickettypen(
    db: AuditedDbSession, current: CurrentUserDep, aktiv_only: bool = False
) -> list[TickettypRead]:
    items = await tickettyp_service.list_tickettypen(db, current.mandant_id, aktiv_only=aktiv_only)
    return [TickettypRead.model_validate(i) for i in items]


@router.get("/{tickettyp_id}", response_model=TickettypRead)
async def get_tickettyp(
    tickettyp_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> TickettypRead:
    try:
        item = await tickettyp_service.get_tickettyp(db, current.mandant_id, tickettyp_id)
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TickettypRead.model_validate(item)


@router.post(
    "",
    response_model=TickettypRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_tickettyp(
    payload: TickettypCreate, db: AuditedDbSession, current: CurrentUserDep
) -> TickettypRead:
    try:
        item = await tickettyp_service.create_tickettyp(
            db, current.mandant_id, payload=payload.model_dump()
        )
    except TickettypKeyConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return TickettypRead.model_validate(item)


@router.patch("/{tickettyp_id}", response_model=TickettypRead)
async def update_tickettyp(
    tickettyp_id: UUID,
    payload: TickettypUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TickettypRead:
    try:
        item = await tickettyp_service.update_tickettyp(
            db,
            current.mandant_id,
            tickettyp_id,
            payload.model_dump(exclude_unset=True),
        )
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TickettypRead.model_validate(item)


@router.delete("/{tickettyp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tickettyp(
    tickettyp_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> None:
    try:
        await tickettyp_service.delete_tickettyp(db, current.mandant_id, tickettyp_id)
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SystemTickettypProtectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None


@router.post(
    "/{tickettyp_id}/duplicate",
    response_model=TickettypRead,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_tickettyp(
    tickettyp_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> TickettypRead:
    try:
        item = await tickettyp_service.duplicate_tickettyp(db, current.mandant_id, tickettyp_id)
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TickettypRead.model_validate(item)


@router.patch("/{tickettyp_id}/felder", response_model=TickettypRead)
async def update_tickettyp_felder(
    tickettyp_id: UUID,
    payload: list[TickettypFeldUpdate],
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TickettypRead:
    """Bulk-Update: pro übermittelter Eintrag wird das passende Feld
    (per feld_key) aktualisiert. Felder, die nicht in der Payload stehen,
    bleiben unverändert. Unbekannte feld_keys werden ignoriert."""
    for entry in payload:
        try:
            await tickettyp_service.update_tickettyp_feld(
                db,
                current.mandant_id,
                tickettyp_id,
                entry.feld_key,
                entry.model_dump(exclude_unset=True, exclude={"feld_key"}),
            )
        except TickettypNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except TickettypFeldNotFoundError:
            # Frontend kann unbekannte Keys schicken (System-Feld-Liste
            # erweitert sich); wir ignorieren statt 4xx zu werfen.
            continue
    item = await tickettyp_service.get_tickettyp(db, current.mandant_id, tickettyp_id)
    return TickettypRead.model_validate(item)


@router.put("/{tickettyp_id}/layout", response_model=TickettypRead)
async def save_tickettyp_layout(
    tickettyp_id: UUID,
    payload: LayoutWrite,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TickettypRead:
    """Stufe-C-Designer-Save: vollständiges Block-/Feld-Layout einer Vorlage
    transaktional schreiben. Block-/Feld-Keys werden nur innerhalb dieser Vorlage
    aufgelöst (IDOR-sicher)."""
    try:
        item = await tickettyp_service.save_layout(
            db, current.mandant_id, tickettyp_id, payload.model_dump()
        )
    except TickettypNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LayoutValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return TickettypRead.model_validate(item)
