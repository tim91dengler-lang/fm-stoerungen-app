from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.mandant import Mandant
    from fm_api.models.objekt import Objekt
    from fm_api.models.objektstruktur import ObjektStockwerk


class Anlage(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Technische Anlage (RLT, Heizkreis, BMA, Aufzug, …).

    High-Level-Stammdaten in Slice 1 — keine Wartungs-/Betriebsstunden-Logik.
    Optionaler Bezug zu Objekt + Stockwerk; Sammelmeldungen können beides leer
    lassen.
    """

    __tablename__ = "anlagen"
    __table_args__ = (
        UniqueConstraint("mandant_id", "bezeichnung", name="uq_anlagen_mandant_id_bezeichnung"),
    )

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    bezeichnung: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    kategorie_wert_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    objekt_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="SET NULL"),
        nullable=True,
    )
    stockwerk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekt_stockwerk.id", ondelete="SET NULL"),
        nullable=True,
    )
    aktiv: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    kategorie_wert: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")
    objekt: Mapped["Objekt | None"] = relationship(lazy="raise")
    stockwerk: Mapped["ObjektStockwerk | None"] = relationship(lazy="raise")
