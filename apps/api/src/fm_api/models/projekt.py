from datetime import date
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.mandant import Mandant
    from fm_api.models.objekt import Objekt
    from fm_api.models.user import User


class ProjektStatusSlug(StrEnum):
    GEPLANT = "geplant"
    LAUFEND = "laufend"
    ABGESCHLOSSEN = "abgeschlossen"
    STORNIERT = "storniert"


class Projekt(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Projekte = Sammelposten für mehrere Tickets (plan.md §5.11)."""

    __tablename__ = "projekte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    objekt_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="SET NULL"),
        nullable=True,
    )
    verantwortlich_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_am: Mapped[date | None] = mapped_column(Date, nullable=True)
    ende_am: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="geplant", server_default="geplant"
    )
    notizen: Mapped[str | None] = mapped_column(Text, nullable=True)

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    objekt: Mapped["Objekt | None"] = relationship(lazy="raise")
    verantwortlich: Mapped["User | None"] = relationship(lazy="raise")
