from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin
from fm_api.models.partner import PartnerTyp, partner_typ_enum

if TYPE_CHECKING:
    from fm_api.models.adresse import Adresse
    from fm_api.models.mandant import Mandant
    from fm_api.models.partner import GeschaeftsPartner


class Objekt(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "objekte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    adresse_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("adressen.id", ondelete="SET NULL"),
        nullable=True,
    )
    notiz: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Soft-Sperre nach R6c-Konvention; bestehende Verknüpfungen bleiben,
    # neue Auswahl in Suchpickern wird unterdrückt.
    gesperrt: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    adresse: Mapped["Adresse | None"] = relationship(lazy="raise")
    partner_links: Mapped[list["ObjektPartner"]] = relationship(
        back_populates="objekt",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ObjektPartner(Base):
    __tablename__ = "objekt_partner"

    objekt_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="CASCADE"),
        primary_key=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        primary_key=True,
    )
    rolle: Mapped["PartnerTyp"] = mapped_column(partner_typ_enum, primary_key=True)

    objekt: Mapped["Objekt"] = relationship(back_populates="partner_links", lazy="raise")
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
