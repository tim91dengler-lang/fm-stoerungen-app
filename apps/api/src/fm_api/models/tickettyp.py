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


class Tickettyp(UuidPkMixin, TimestampMixin, Base):
    """Tickettyp als Stammdatensatz (Reparatur/Wartung/Baubegehung in Slice 1)."""

    __tablename__ = "tickettypen"
    __table_args__ = (UniqueConstraint("mandant_id", "key", name="uq_tickettypen_mandant_id_key"),)

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    farbe: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Legacy-Spalte aus Migration 0006 — wird ab 0009 von `felder` (tickettyp_feld)
    # abgelöst. Bleibt für Backwards-Compat erhalten, neue Logik nutzt `felder`.
    pflichtfelder: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    default_reminder_tage: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    ist_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    felder: Mapped[list["TickettypFeld"]] = relationship(
        back_populates="tickettyp",
        cascade="all, delete-orphan",
        order_by="TickettypFeld.reihenfolge",
        lazy="raise",
    )


class TickettypFeld(UuidPkMixin, TimestampMixin, Base):
    """Sichtbar/Pflicht/Reihenfolge pro System-Feld je Vorlage.

    Custom-Felder sind in der Spec angelegt (`ist_system_feld=false`), in
    Slice 1 aber bewusst nicht im Frontend ausgespielt (Entscheidung Tim
    2026-05-22 — kommt später).
    """

    __tablename__ = "tickettyp_feld"
    __table_args__ = (
        UniqueConstraint("tickettyp_id", "feld_key", name="uq_tickettyp_feld_tickettyp_feld_key"),
    )

    tickettyp_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickettypen.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feld_key: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    ist_system_feld: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    sichtbar: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    pflicht: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    nur_admin_sichtbar: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    tickettyp: Mapped["Tickettyp"] = relationship(back_populates="felder", lazy="raise")
