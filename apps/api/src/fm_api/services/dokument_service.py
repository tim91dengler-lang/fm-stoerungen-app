from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import delete, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fm_api.core.config import get_settings
from fm_api.models import Dokument, DokumentLink
from fm_api.services.photo_service import _ensure_dir, _upload_root


class DokumentNotFoundError(Exception):
    pass


class UnsupportedMimeError(Exception):
    pass


_ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument",
    "application/vnd.ms-excel",
    "application/vnd.ms-outlook",  # .msg
    "application/x-vnd.ms-outlook",
    "message/rfc822",  # .eml
    "image/",
    "text/",
)


def _looks_allowed(mime_type: str) -> bool:
    return any(mime_type.startswith(p) for p in _ALLOWED_MIME_PREFIXES)


def _ext_for(mime: str, filename: str) -> str:
    if "." in filename:
        return "." + filename.rsplit(".", 1)[-1].lower()
    return ".bin"


async def list_dokumente(
    db: AsyncSession,
    mandant_id: UUID,
    *,
    search: str | None = None,
    target_type: str | None = None,
    target_id: UUID | None = None,
) -> list[Dokument]:
    base = (
        select(Dokument)
        .where(Dokument.mandant_id == mandant_id, Dokument.deleted_at.is_(None))
        .options(selectinload(Dokument.hochgeladen_von), selectinload(Dokument.links))
    )
    if search:
        like = f"%{search.lower()}%"
        from sqlalchemy import func

        base = base.where(
            or_(
                func.lower(Dokument.name).like(like),
                func.lower(Dokument.filename).like(like),
                func.lower(Dokument.kategorie).like(like),
            )
        )
    if target_type and target_id:
        base = base.join(DokumentLink, DokumentLink.dokument_id == Dokument.id).where(
            DokumentLink.target_type == target_type,
            DokumentLink.target_id == target_id,
        )
    base = base.order_by(Dokument.created_at.desc())
    return list((await db.execute(base)).scalars().unique().all())


async def get_dokument(db: AsyncSession, mandant_id: UUID, dokument_id: UUID) -> Dokument:
    stmt = (
        select(Dokument)
        .where(
            Dokument.id == dokument_id,
            Dokument.mandant_id == mandant_id,
            Dokument.deleted_at.is_(None),
        )
        .options(selectinload(Dokument.hochgeladen_von), selectinload(Dokument.links))
    )
    d = (await db.execute(stmt)).scalar_one_or_none()
    if d is None:
        raise DokumentNotFoundError(f"dokument {dokument_id} not found")
    return d


async def create_dokument(
    db: AsyncSession,
    mandant_id: UUID,
    uploader_user_id: UUID,
    *,
    name: str,
    filename: str,
    mime_type: str,
    content: bytes,
    kategorie: str | None = None,
    beschreibung: str | None = None,
    links: list[dict[str, Any]] | None = None,
) -> Dokument:
    if not _looks_allowed(mime_type):
        raise UnsupportedMimeError(f"mime type '{mime_type}' not allowed")
    settings = get_settings()
    if len(content) > settings.upload_max_bytes * 3:  # 30 MB für Dokumente
        raise UnsupportedMimeError(
            f"dokument too large: {len(content)} bytes (max {settings.upload_max_bytes * 3})"
        )

    doc_id = uuid4()
    ext = _ext_for(mime_type, filename)
    rel_path = f"dokumente/{mandant_id}/{doc_id}{ext}"
    abs_path = _upload_root() / rel_path
    _ensure_dir(abs_path.parent)
    abs_path.write_bytes(content)

    d = Dokument(
        id=doc_id,
        mandant_id=mandant_id,
        name=name[:255],
        filename=filename[:255],
        mime_type=mime_type[:120],
        size_bytes=len(content),
        storage_path=rel_path,
        kategorie=kategorie,
        beschreibung=beschreibung,
        hochgeladen_von_user_id=uploader_user_id,
    )
    db.add(d)
    await db.flush()
    if links:
        await db.execute(
            insert(DokumentLink),
            [
                {
                    "dokument_id": doc_id,
                    "target_type": link["target_type"],
                    "target_id": link["target_id"],
                }
                for link in links
            ],
        )
    await db.flush()
    return await get_dokument(db, mandant_id, doc_id)


async def update_dokument(
    db: AsyncSession,
    mandant_id: UUID,
    dokument_id: UUID,
    updates: dict[str, Any],
) -> Dokument:
    d = await get_dokument(db, mandant_id, dokument_id)
    new_links = updates.pop("links", None)
    for key, value in updates.items():
        if value is None and key in ("name",):
            continue
        setattr(d, key, value)
    if new_links is not None:
        await db.execute(delete(DokumentLink).where(DokumentLink.dokument_id == dokument_id))
        await db.flush()
        if new_links:
            await db.execute(
                insert(DokumentLink),
                [
                    {
                        "dokument_id": dokument_id,
                        "target_type": link["target_type"],
                        "target_id": link["target_id"],
                    }
                    for link in new_links
                ],
            )
    await db.flush()
    return await get_dokument(db, mandant_id, dokument_id)


async def soft_delete_dokument(db: AsyncSession, mandant_id: UUID, dokument_id: UUID) -> None:
    d = await get_dokument(db, mandant_id, dokument_id)
    d.deleted_at = datetime.now(UTC)
    await db.flush()


def read_bytes(d: Dokument) -> bytes:
    abs_path = _upload_root() / d.storage_path
    return abs_path.read_bytes()
