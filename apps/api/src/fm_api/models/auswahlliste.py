from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.mandant import Mandant


class Auswahlliste(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "auswahllisten"
    __table_args__ = (
        UniqueConstraint("mandant_id", "key", name="uq_auswahllisten_mandant_id_key"),
    )

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    ist_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    werte: Mapped[list["AuswahllistenWert"]] = relationship(
        back_populates="auswahlliste",
        cascade="all, delete-orphan",
        order_by="AuswahllistenWert.reihenfolge",
        lazy="selectin",
    )


class AuswahllistenWert(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "auswahllisten_werte"
    __table_args__ = (
        UniqueConstraint(
            "auswahlliste_id", "key", name="uq_auswahllisten_werte_auswahlliste_id_key"
        ),
    )

    auswahlliste_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    farbe: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ist_aktiv: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    ist_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    auswahlliste: Mapped["Auswahlliste"] = relationship(back_populates="werte", lazy="raise")
