from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.mandant import Mandant
    from fm_api.models.user import User


class DokumentTarget(StrEnum):
    TICKET = "ticket"
    PROJEKT = "projekt"
    OBJEKT = "objekt"
    PARTNER = "partner"


class Dokument(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Dokument als eigene Stammdaten-Entität mit n:m zu Ticket/Projekt/Objekt/Partner."""

    __tablename__ = "dokumente"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    kategorie: Mapped[str | None] = mapped_column(String(64), nullable=True)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    hochgeladen_von_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    hochgeladen_von: Mapped["User | None"] = relationship(lazy="raise")
    links: Mapped[list["DokumentLink"]] = relationship(
        back_populates="dokument",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class DokumentLink(Base):
    """n:m: Dokument ↔ (Ticket / Projekt / Objekt / Partner)."""

    __tablename__ = "dokument_links"

    dokument_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("dokumente.id", ondelete="CASCADE"),
        primary_key=True,
    )
    target_type: Mapped[str] = mapped_column(String(32), primary_key=True)
    target_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)

    dokument: Mapped["Dokument"] = relationship(back_populates="links", lazy="raise")
