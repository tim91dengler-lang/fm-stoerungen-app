from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.ticket_photo import TicketPhotoRead, TicketPhotoUpdate
from fm_api.services import photo_service
from fm_api.services.photo_service import (
    PhotoNotFoundError,
    PhotoTooLargeError,
    TicketNotFoundError,
    UnsupportedMimeError,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[TicketPhotoRead],
    summary="Fotos zum Ticket",
)
async def list_photos(
    ticket_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[TicketPhotoRead]:
    try:
        photos = await photo_service.list_photos(db, ticket_id, current.mandant_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [TicketPhotoRead.model_validate(p) for p in photos]


@router.post(
    "",
    response_model=TicketPhotoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Foto hochladen (multipart/form-data)",
)
async def upload_photo(
    ticket_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
    file: UploadFile = File(...),
    beschreibung: str | None = Form(default=None),
) -> TicketPhotoRead:
    content = await file.read()
    try:
        photo = await photo_service.create_photo(
            db,
            ticket_id,
            current.mandant_id,
            current.user_id,
            filename=file.filename or "upload",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
            beschreibung=beschreibung,
        )
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedMimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)
        ) from exc
    except PhotoTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)
        ) from exc
    return TicketPhotoRead.model_validate(photo)


@router.patch(
    "/{photo_id}",
    response_model=TicketPhotoRead,
    summary="Foto bearbeiten (Beschreibung / Annotations)",
)
async def update_photo(
    ticket_id: UUID,
    photo_id: UUID,
    payload: TicketPhotoUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> TicketPhotoRead:
    try:
        photo = await photo_service.update_photo(
            db,
            photo_id,
            ticket_id,
            current.mandant_id,
            beschreibung=payload.beschreibung,
            annotations=payload.annotations,
        )
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PhotoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TicketPhotoRead.model_validate(photo)


@router.delete(
    "/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Foto löschen (soft-delete; Datei bleibt im Storage für Restore)",
)
async def delete_photo(
    ticket_id: UUID,
    photo_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await photo_service.soft_delete_photo(db, photo_id, ticket_id, current.mandant_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PhotoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.get(
    "/{photo_id}/file",
    summary="Foto-Datei streamen (auth-gated, kein public-URL)",
)
async def stream_photo(
    ticket_id: UUID,
    photo_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> Response:
    try:
        photo = await photo_service.get_photo(db, photo_id, ticket_id, current.mandant_id)
    except TicketNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PhotoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    content = photo_service.read_photo_bytes(photo)
    return Response(
        content=content,
        media_type=photo.mime_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
