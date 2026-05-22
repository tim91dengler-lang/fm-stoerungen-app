from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.core.config import get_settings
from fm_api.models import Ticket, TicketPhoto


class PhotoNotFoundError(Exception):
    pass


class TicketNotFoundError(Exception):
    pass


class UnsupportedMimeError(Exception):
    pass


class PhotoTooLargeError(Exception):
    pass


_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


def _ext_for(mime: str) -> str:
    return _MIME_TO_EXT.get(mime, ".bin")


def _upload_root() -> Path:
    settings = get_settings()
    return Path(settings.upload_dir)


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


async def _assert_ticket(db: AsyncSession, ticket_id: UUID, mandant_id: UUID) -> None:
    stmt = select(Ticket.id).where(
        Ticket.id == ticket_id,
        Ticket.mandant_id == mandant_id,
        Ticket.deleted_at.is_(None),
    )
    if (await db.execute(stmt)).scalar_one_or_none() is None:
        raise TicketNotFoundError(f"ticket {ticket_id} not found")


async def list_photos(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
) -> list[TicketPhoto]:
    await _assert_ticket(db, ticket_id, mandant_id)
    stmt = (
        select(TicketPhoto)
        .where(
            TicketPhoto.ticket_id == ticket_id,
            TicketPhoto.deleted_at.is_(None),
        )
        .options(selectinload(TicketPhoto.uploaded_by))
        .order_by(TicketPhoto.created_at)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_photo(
    db: AsyncSession,
    photo_id: UUID,
    ticket_id: UUID,
    mandant_id: UUID,
) -> TicketPhoto:
    await _assert_ticket(db, ticket_id, mandant_id)
    stmt = (
        select(TicketPhoto)
        .where(
            TicketPhoto.id == photo_id,
            TicketPhoto.ticket_id == ticket_id,
            TicketPhoto.deleted_at.is_(None),
        )
        .options(selectinload(TicketPhoto.uploaded_by))
    )
    photo = (await db.execute(stmt)).scalar_one_or_none()
    if photo is None:
        raise PhotoNotFoundError(f"photo {photo_id} not found")
    return photo


async def create_photo(
    db: AsyncSession,
    ticket_id: UUID,
    mandant_id: UUID,
    uploader_user_id: UUID,
    *,
    filename: str,
    mime_type: str,
    content: bytes,
    beschreibung: str | None = None,
) -> TicketPhoto:
    settings = get_settings()
    if mime_type not in settings.upload_allowed_mime:
        raise UnsupportedMimeError(f"mime type '{mime_type}' not allowed")
    if len(content) > settings.upload_max_bytes:
        raise PhotoTooLargeError(
            f"photo too large: {len(content)} bytes (max {settings.upload_max_bytes})"
        )

    await _assert_ticket(db, ticket_id, mandant_id)

    photo_id = uuid4()
    ext = _ext_for(mime_type)
    rel_path = f"{ticket_id}/{photo_id}{ext}"
    abs_path = _upload_root() / rel_path
    _ensure_dir(abs_path.parent)
    abs_path.write_bytes(content)

    photo = TicketPhoto(
        id=photo_id,
        ticket_id=ticket_id,
        uploaded_by_user_id=uploader_user_id,
        filename=filename[:255],
        mime_type=mime_type,
        size_bytes=len(content),
        storage_path=rel_path,
        beschreibung=beschreibung,
        annotations=[],
    )
    db.add(photo)
    await db.flush()
    await db.refresh(photo, ["uploaded_by"])
    return photo


def read_photo_bytes(photo: TicketPhoto) -> bytes:
    abs_path = _upload_root() / photo.storage_path
    return abs_path.read_bytes()


async def update_photo(
    db: AsyncSession,
    photo_id: UUID,
    ticket_id: UUID,
    mandant_id: UUID,
    *,
    beschreibung: str | None = None,
    annotations: list[dict[str, Any]] | None = None,
) -> TicketPhoto:
    photo = await get_photo(db, photo_id, ticket_id, mandant_id)
    if beschreibung is not None:
        photo.beschreibung = beschreibung
    if annotations is not None:
        photo.annotations = annotations
    await db.flush()
    # Reload via get_photo, damit alle Relations + updated_at frisch geladen sind
    return await get_photo(db, photo_id, ticket_id, mandant_id)


async def soft_delete_photo(
    db: AsyncSession,
    photo_id: UUID,
    ticket_id: UUID,
    mandant_id: UUID,
) -> None:
    photo = await get_photo(db, photo_id, ticket_id, mandant_id)
    photo.deleted_at = datetime.now(UTC)
    await db.flush()
