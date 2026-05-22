from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.ticket import Ticket
    from fm_api.models.user import User


class TicketPhoto(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Foto vor Ort zum Ticket — Datei liegt im File-Storage-Volume."""

    __tablename__ = "ticket_photos"

    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    uploaded_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    annotations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )

    ticket: Mapped["Ticket"] = relationship(lazy="raise")
    uploaded_by: Mapped["User | None"] = relationship(lazy="raise")
