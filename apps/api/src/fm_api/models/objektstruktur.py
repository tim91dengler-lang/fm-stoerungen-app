"""Vierstufige Objektstruktur (Objekt → Haus → Stockwerk → Einheit) — plan.md §5.2.

Im selben Modul, weil eng gekoppelt (Haus/Stockwerk/Einheit-Tree, Mieter-Junctions).
"""

from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.adresse import Adresse
    from fm_api.models.mandant import Mandant
    from fm_api.models.objekt import Objekt
    from fm_api.models.partner import GeschaeftsPartner


class StockwerkAusrichtung(StrEnum):
    NORD = "nord"
    OST = "ost"
    SUED = "sued"
    WEST = "west"


stockwerk_ausrichtung_enum = SAEnum(
    StockwerkAusrichtung,
    name="stockwerk_ausrichtung",
    native_enum=True,
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class Haus(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "haus"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
    )
    objekt_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bezeichnung: Mapped[str] = mapped_column(String(200), nullable=False)
    adresse_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("adressen.id", ondelete="SET NULL"),
        nullable=True,
    )
    notiz: Mapped[str | None] = mapped_column(Text, nullable=True)
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    objekt: Mapped["Objekt"] = relationship(lazy="raise")
    adresse: Mapped["Adresse | None"] = relationship(lazy="raise")
    stockwerke: Mapped[list["ObjektStockwerk"]] = relationship(
        back_populates="haus",
        cascade="all, delete-orphan",
        order_by="ObjektStockwerk.reihenfolge",
        lazy="selectin",
    )
    eigentuemer_links: Mapped[list["HausEigentuemer"]] = relationship(
        back_populates="haus",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    mieter_links: Mapped[list["HausMieter"]] = relationship(
        back_populates="haus",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ObjektStockwerk(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "objekt_stockwerk"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
    )
    haus_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("haus.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bezeichnung: Mapped[str] = mapped_column(String(120), nullable=False)
    ausrichtung: Mapped[StockwerkAusrichtung | None] = mapped_column(
        stockwerk_ausrichtung_enum, nullable=True
    )
    grundriss_storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    grundriss_mime: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    haus: Mapped["Haus"] = relationship(back_populates="stockwerke", lazy="raise")
    eigentuemer_links: Mapped[list["StockwerkEigentuemer"]] = relationship(
        back_populates="stockwerk",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    einheiten: Mapped[list["StockwerkEinheit"]] = relationship(
        back_populates="stockwerk",
        cascade="all, delete-orphan",
        order_by="StockwerkEinheit.reihenfolge",
        lazy="selectin",
    )
    mieter_links: Mapped[list["StockwerkMieter"]] = relationship(
        back_populates="stockwerk",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class StockwerkEinheit(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "stockwerk_einheit"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
    )
    stockwerk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekt_stockwerk.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bezeichnung: Mapped[str] = mapped_column(String(120), nullable=False)
    groesse_qm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    stockwerk: Mapped["ObjektStockwerk"] = relationship(back_populates="einheiten", lazy="raise")
    eigentuemer_links: Mapped[list["EinheitEigentuemer"]] = relationship(
        back_populates="einheit",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    mieter_links: Mapped[list["EinheitMieter"]] = relationship(
        back_populates="einheit",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class EinheitMieter(Base):
    __tablename__ = "einheit_mieter"

    einheit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("stockwerk_einheit.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )

    einheit: Mapped["StockwerkEinheit"] = relationship(back_populates="mieter_links", lazy="raise")
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")


class StockwerkMieter(Base):
    """Fallback-Mieter-Pflege wenn das Stockwerk keine Einheiten hat."""

    __tablename__ = "stockwerk_mieter"

    stockwerk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekt_stockwerk.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )

    stockwerk: Mapped["ObjektStockwerk"] = relationship(back_populates="mieter_links", lazy="raise")
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")


# ---------------------------------------------------------------------------
# R5b — m:n Eigentümer/Mieter auf allen 3 Ebenen (Tim 2026-05-25):
# WEG-Fälle möglich (mehrere Eigentümer), Haus bekommt eigene Mieter/Eigentümer-
# Relation (z. B. Gewerbeobjekt komplett vermietet).
# Naming-Konvention: <ebene>_<rolle> mit composite PK (parent_id, partner_id).
# ---------------------------------------------------------------------------


class HausEigentuemer(Base):
    __tablename__ = "haus_eigentuemer"

    haus_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("haus.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )

    haus: Mapped["Haus"] = relationship(back_populates="eigentuemer_links", lazy="raise")
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")


class HausMieter(Base):
    __tablename__ = "haus_mieter"

    haus_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("haus.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )

    haus: Mapped["Haus"] = relationship(back_populates="mieter_links", lazy="raise")
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")


class StockwerkEigentuemer(Base):
    __tablename__ = "stockwerk_eigentuemer"

    stockwerk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekt_stockwerk.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )

    stockwerk: Mapped["ObjektStockwerk"] = relationship(
        back_populates="eigentuemer_links", lazy="raise"
    )
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")


class EinheitEigentuemer(Base):
    __tablename__ = "einheit_eigentuemer"

    einheit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("stockwerk_einheit.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )

    einheit: Mapped["StockwerkEinheit"] = relationship(
        back_populates="eigentuemer_links", lazy="raise"
    )
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
