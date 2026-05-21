from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CHAR, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.mandant import Mandant


class Adresse(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "adressen"
    __table_args__ = (Index("ix_adressen_plz_ort", "mandant_id", "plz", "ort"),)

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    strasse: Mapped[str] = mapped_column(String(200), nullable=False)
    hausnummer: Mapped[str | None] = mapped_column(String(32), nullable=True)
    adresszusatz: Mapped[str | None] = mapped_column(String(100), nullable=True)
    plz: Mapped[str] = mapped_column(String(20), nullable=False)
    ort: Mapped[str] = mapped_column(String(120), nullable=False)
    land: Mapped[str] = mapped_column(CHAR(2), nullable=False, default="DE", server_default="DE")
    bemerkung: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geocode_source: Mapped[str | None] = mapped_column(String(32), nullable=True)

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
