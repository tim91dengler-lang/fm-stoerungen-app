from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.mandant import Mandant
    from fm_api.models.ticket import Ticket
    from fm_api.models.ticket_message import TicketMessage
    from fm_api.models.user import User


class NotificationTyp(StrEnum):
    MENTION = "mention"
    ZUWEISUNG = "zuweisung"
    STATUS = "status"
    CHAT = "chat"
    WARTUNG_FAELLIG = "wartung_faellig"


class Notification(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticket_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=True,
    )
    typ: Mapped[str] = mapped_column(String(32), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    ref_message_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("ticket_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    ausloeser_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    gelesen: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    user: Mapped["User"] = relationship(foreign_keys=[user_id], lazy="raise")
    ausloeser: Mapped["User | None"] = relationship(foreign_keys=[ausloeser_user_id], lazy="raise")
    ticket: Mapped["Ticket | None"] = relationship(lazy="raise")
    ref_message: Mapped["TicketMessage | None"] = relationship(lazy="raise")
