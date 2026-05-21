from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.auswahlliste import (
    AuswahllisteCreate,
    AuswahllistenWertCreate,
    AuswahllistenWertRead,
    AuswahllistenWertUpdate,
    AuswahllisteRead,
    AuswahllisteUpdate,
)
from fm_api.services import auswahlliste_service
from fm_api.services.auswahlliste_service import (
    AuswahllisteNotFoundError,
    AuswahllistenWertNotFoundError,
    DuplicateAuswahllisteError,
    DuplicateAuswahllistenWertError,
    SystemEntryProtectedError,
)

router = APIRouter()


@router.get("", response_model=list[AuswahllisteRead], summary="Auswahllisten des Mandanten")
async def list_listen(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=120),
) -> list[AuswahllisteRead]:
    listen = await auswahlliste_service.list_listen(db, current.mandant_id, search=search)
    return [AuswahllisteRead.model_validate(liste) for liste in listen]


@router.get("/{liste_id}", response_model=AuswahllisteRead, summary="Auswahlliste-Detail")
async def get_liste(
    liste_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AuswahllisteRead:
    try:
        liste = await auswahlliste_service.get_liste_by_id(db, current.mandant_id, liste_id)
    except AuswahllisteNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AuswahllisteRead.model_validate(liste)


@router.post(
    "",
    response_model=AuswahllisteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Auswahlliste anlegen",
)
async def create_liste(
    payload: AuswahllisteCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AuswahllisteRead:
    try:
        liste = await auswahlliste_service.create_liste(
            db,
            current.mandant_id,
            key=payload.key,
            label=payload.label,
            beschreibung=payload.beschreibung,
        )
    except DuplicateAuswahllisteError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return AuswahllisteRead.model_validate(liste)


@router.patch(
    "/{liste_id}",
    response_model=AuswahllisteRead,
    summary="Auswahlliste umbenennen",
)
async def update_liste(
    liste_id: UUID,
    payload: AuswahllisteUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AuswahllisteRead:
    try:
        liste = await auswahlliste_service.update_liste(
            db, current.mandant_id, liste_id, payload.model_dump(exclude_unset=True)
        )
    except AuswahllisteNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SystemEntryProtectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return AuswahllisteRead.model_validate(liste)


@router.delete(
    "/{liste_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Auswahlliste löschen (nur User-Listen)",
)
async def delete_liste(
    liste_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await auswahlliste_service.delete_liste(db, current.mandant_id, liste_id)
    except AuswahllisteNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SystemEntryProtectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None


# ----------------------------------------------------------------------------- Werte


@router.post(
    "/{liste_id}/werte",
    response_model=AuswahllistenWertRead,
    status_code=status.HTTP_201_CREATED,
    summary="Wert zu einer Auswahlliste hinzufügen",
)
async def add_wert(
    liste_id: UUID,
    payload: AuswahllistenWertCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AuswahllistenWertRead:
    try:
        wert = await auswahlliste_service.add_wert(
            db,
            current.mandant_id,
            liste_id,
            key=payload.key,
            label=payload.label,
            reihenfolge=payload.reihenfolge,
            farbe=payload.farbe,
            ist_aktiv=payload.ist_aktiv,
            meta=payload.meta,
        )
    except AuswahllisteNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateAuswahllistenWertError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return AuswahllistenWertRead.model_validate(wert)


@router.patch(
    "/werte/{wert_id}",
    response_model=AuswahllistenWertRead,
    summary="Wert ändern (nicht system-managed)",
)
async def update_wert(
    wert_id: UUID,
    payload: AuswahllistenWertUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AuswahllistenWertRead:
    try:
        wert = await auswahlliste_service.update_wert(
            db,
            current.mandant_id,
            wert_id,
            payload.model_dump(exclude_unset=True),
        )
    except AuswahllistenWertNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SystemEntryProtectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return AuswahllistenWertRead.model_validate(wert)


@router.delete(
    "/werte/{wert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Wert löschen (nicht system-managed)",
)
async def delete_wert(
    wert_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await auswahlliste_service.delete_wert(db, current.mandant_id, wert_id)
    except AuswahllistenWertNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SystemEntryProtectedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None
