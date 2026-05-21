from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.mandant import Mandant
    from fm_api.models.user import User


class TicketStatus(StrEnum):
    NEU = "neu"
    ZUGEWIESEN = "zugewiesen"
    IN_ARBEIT = "in_arbeit"
    ERLEDIGT = "erledigt"
    GESCHLOSSEN = "geschlossen"


class TicketPrioritaet(StrEnum):
    NIEDRIG = "niedrig"
    MITTEL = "mittel"
    HOCH = "hoch"
    KRITISCH = "kritisch"


class Ticket(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint("mandant_id", "nummer", name="uq_tickets_mandant_id_nummer"),
    )

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    nummer: Mapped[int] = mapped_column(Integer, nullable=False)

    titel: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")

    status: Mapped[TicketStatus] = mapped_column(
        Enum(
            TicketStatus,
            name="ticket_status",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            create_type=False,
        ),
        nullable=False,
        default=TicketStatus.NEU,
        server_default=TicketStatus.NEU.value,
        index=True,
    )
    prioritaet: Mapped[TicketPrioritaet] = mapped_column(
        Enum(
            TicketPrioritaet,
            name="ticket_prioritaet",
            native_enum=True,
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            create_type=False,
        ),
        nullable=False,
        default=TicketPrioritaet.MITTEL,
        server_default=TicketPrioritaet.MITTEL.value,
        index=True,
    )

    eroeffnet_von_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    zugewiesen_an_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    eroeffnet_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    zugewiesen_am: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    erledigt_am: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    geschlossen_am: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mandant: Mapped["Mandant"] = relationship(back_populates="tickets", lazy="raise")
    eroeffnet_von: Mapped["User"] = relationship(foreign_keys=[eroeffnet_von_id], lazy="raise")
    zugewiesen_an: Mapped["User | None"] = relationship(
        foreign_keys=[zugewiesen_an_id], lazy="raise"
    )
