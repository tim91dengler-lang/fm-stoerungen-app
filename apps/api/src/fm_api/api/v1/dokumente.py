import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.dokument import DokumentRead, DokumentUpdate
from fm_api.services import dokument_service
from fm_api.services.dokument_service import (
    DokumentNotFoundError,
    UnsupportedMimeError,
)

router = APIRouter()


@router.get("", response_model=list[DokumentRead])
async def list_dokumente(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    target_type: str | None = Query(default=None),
    target_id: UUID | None = Query(default=None),
) -> list[DokumentRead]:
    items = await dokument_service.list_dokumente(
        db,
        current.mandant_id,
        search=search,
        target_type=target_type,
        target_id=target_id,
    )
    return [DokumentRead.model_validate(d) for d in items]


@router.post(
    "",
    response_model=DokumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Dokument hochladen (multipart/form-data)",
)
async def upload_dokument(
    db: AuditedDbSession,
    current: CurrentUserDep,
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    kategorie: str | None = Form(default=None),
    beschreibung: str | None = Form(default=None),
    links_json: str | None = Form(default=None),
) -> DokumentRead:
    """Optional `links_json` als JSON-String: `[{target_type, target_id}, ...]`."""
    content = await file.read()
    links: list[dict[str, Any]] = []
    if links_json:
        try:
            parsed = json.loads(links_json)
            if isinstance(parsed, list):
                links = parsed
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="links_json invalid"
            ) from exc
    try:
        d = await dokument_service.create_dokument(
            db,
            current.mandant_id,
            current.user_id,
            name=name or (file.filename or "Dokument"),
            filename=file.filename or "datei",
            mime_type=file.content_type or "application/octet-stream",
            content=content,
            kategorie=kategorie,
            beschreibung=beschreibung,
            links=links,
        )
    except UnsupportedMimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)
        ) from exc
    return DokumentRead.model_validate(d)


@router.patch("/{dokument_id}", response_model=DokumentRead)
async def update_dokument(
    dokument_id: UUID,
    payload: DokumentUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> DokumentRead:
    try:
        d = await dokument_service.update_dokument(
            db,
            current.mandant_id,
            dokument_id,
            payload.model_dump(exclude_unset=True),
        )
    except DokumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DokumentRead.model_validate(d)


@router.delete("/{dokument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dokument(dokument_id: UUID, db: AuditedDbSession, current: CurrentUserDep) -> None:
    try:
        await dokument_service.soft_delete_dokument(db, current.mandant_id, dokument_id)
    except DokumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None


@router.get("/{dokument_id}/file")
async def stream_dokument(
    dokument_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> Response:
    try:
        d = await dokument_service.get_dokument(db, current.mandant_id, dokument_id)
    except DokumentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    content = dokument_service.read_bytes(d)
    return Response(
        content=content,
        media_type=d.mime_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": f'inline; filename="{d.filename}"',
        },
    )
