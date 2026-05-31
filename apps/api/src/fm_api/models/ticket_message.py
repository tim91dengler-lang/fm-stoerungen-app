from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.ticket import Ticket
    from fm_api.models.user import User


class TicketMessage(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Chat-Nachricht zu einem Ticket (Polling-basiert, keine WebSockets)."""

    __tablename__ = "ticket_messages"

    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    autor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    mentions: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )
    # User-IDs, die diese Nachricht gelesen haben (Read-Receipts, Konzept §5.6).
    gelesen_von: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )

    ticket: Mapped["Ticket"] = relationship(lazy="raise")
    autor: Mapped["User | None"] = relationship(lazy="raise")
