from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.adresse import Adresse
    from fm_api.models.mandant import Mandant


class PartnerTyp(StrEnum):
    MIETER = "mieter"
    EIGENTUEMER = "eigentuemer"
    AUFTRAGGEBER = "auftraggeber"
    NACHUNTERNEHMER = "nachunternehmer"


partner_typ_enum = Enum(
    PartnerTyp,
    name="partner_typ",
    native_enum=True,
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class GeschaeftsPartner(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "geschaeftspartner"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    ansprechpartner: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    adresse_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("adressen.id", ondelete="SET NULL"),
        nullable=True,
    )
    notiz: Mapped[str | None] = mapped_column(Text, nullable=True)
    typen: Mapped[list[PartnerTyp]] = mapped_column(
        ARRAY(partner_typ_enum), nullable=False, server_default="{}"
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    adresse: Mapped["Adresse | None"] = relationship(lazy="raise")
