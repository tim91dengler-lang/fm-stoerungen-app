from datetime import date, datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.mandant import Mandant
    from fm_api.models.objekt import Objekt
    from fm_api.models.user import User


class ProjektStatusSlug(StrEnum):
    """Bekannte System-Slugs für Projekt-Status (in der Migration als ist_system=TRUE geseedet).

    Die DB-Tabelle ``auswahllisten_werte`` ist die Quelle der Wahrheit; dieser Enum
    dient nur als Typ-Hilfe für die Service-Logik (Defaults, Pattern-Matching).
    """

    GEPLANT = "geplant"
    AKTIV = "aktiv"
    PAUSIERT = "pausiert"
    ABGESCHLOSSEN = "abgeschlossen"


class ProjekttypSlug(StrEnum):
    """Bekannte System-Slugs für Projekttypen (in der Migration als ist_system=TRUE geseedet)."""

    WARTUNG = "wartung"
    SANIERUNG = "sanierung"
    NEUBAU = "neubau"
    BEGEHUNG = "begehung"
    BAUPROJEKT = "bauprojekt"


class Projekt(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Projekte = Sammelposten für mehrere Tickets (plan.md §5.11).

    Seit Feature 2 (2026-05-23):
    - ``projekttyp_id`` und ``status_id`` sind FK auf Auswahllisten-Werte
      (gleiches Pattern wie ``Ticket.status_id``).
    - Objekte hängen via ``ProjektObjektLink`` m:n statt 1:1.
    """

    __tablename__ = "projekte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    projekttyp_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    verantwortlich_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    start_am: Mapped[date | None] = mapped_column(Date, nullable=True)
    ende_am: Mapped[date | None] = mapped_column(Date, nullable=True)
    notizen: Mapped[str | None] = mapped_column(Text, nullable=True)

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    projekttyp_wert: Mapped["AuswahllistenWert"] = relationship(
        foreign_keys=[projekttyp_id], lazy="raise"
    )
    status_wert: Mapped["AuswahllistenWert"] = relationship(foreign_keys=[status_id], lazy="raise")
    verantwortlich: Mapped["User | None"] = relationship(lazy="raise")
    objekt_links: Mapped[list["ProjektObjektLink"]] = relationship(
        back_populates="projekt",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class ProjektObjektLink(UuidPkMixin, Base):
    """m:n: Projekt ↔ Objekt.

    Ein Projekt kann mehrere Objekte umfassen (z. B. „Sanierung Wohnpark":
    Haus A + Haus B). Ein Objekt kann an mehreren Projekten beteiligt sein.
    """

    __tablename__ = "projekt_objekte"
    __table_args__ = (
        UniqueConstraint("projekt_id", "objekt_id", name="uq_projekt_objekte_projekt_id_objekt_id"),
    )

    projekt_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projekte.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    objekt_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    projekt: Mapped["Projekt"] = relationship(back_populates="objekt_links", lazy="raise")
    objekt: Mapped["Objekt"] = relationship(lazy="raise")
