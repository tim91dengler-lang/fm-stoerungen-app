from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.mandant import Mandant
    from fm_api.models.objekt import Objekt
    from fm_api.models.objektstruktur import Haus, ObjektStockwerk, StockwerkEinheit
    from fm_api.models.partner import GeschaeftsPartner
    from fm_api.models.projekt import Projekt
    from fm_api.models.tickettyp import Tickettyp
    from fm_api.models.user import User


class TicketStatusSlug(StrEnum):
    """Bekannte System-Slugs für Ticket-Status (in der Migration als ist_system=TRUE geseedet).

    Die DB-Tabelle ``auswahllisten_werte`` ist die Quelle der Wahrheit; dieser Enum
    dient nur als Typ-Hilfe für die Service-Logik (Status-Transitions, Defaults).
    """

    NEU = "neu"
    PRUEFUNG = "pruefung"
    BEARBEITUNG = "bearbeitung"
    WARTET = "wartet"
    ERLEDIGT = "erledigt"


class TicketPrioritaetSlug(StrEnum):
    NIEDRIG = "niedrig"
    MITTEL = "mittel"
    HOCH = "hoch"
    KRITISCH = "kritisch"


class Ticket(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint("mandant_id", "nummer", name="uq_tickets_mandant_id_nummer"),
    )

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    nummer: Mapped[int] = mapped_column(Integer, nullable=False)

    titel: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")

    status_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    prioritaet_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    kategorie_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=True,
    )
    objekt_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    haus_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("haus.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stockwerk_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekt_stockwerk.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    einheit_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("stockwerk_einheit.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    pin_x: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    pin_y: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    partner_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    tickettyp_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickettypen.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    projekt_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projekte.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quelle_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=True,
    )
    melder: Mapped[str | None] = mapped_column(String(200), nullable=True)
    wartet_grund_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="RESTRICT"),
        nullable=True,
    )
    wartet_nachunternehmer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="SET NULL"),
        nullable=True,
    )
    wartet_kontakt_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    wartet_kontakt_telefon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    wartet_kontakt_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    faelligkeit_am: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    wiederholung: Mapped[str | None] = mapped_column(String(32), nullable=True)

    eroeffnet_von_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    zugewiesen_an_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    eroeffnet_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    zugewiesen_am: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    erledigt_am: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    geschlossen_am: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mandant: Mapped["Mandant"] = relationship(back_populates="tickets", lazy="raise")
    eroeffnet_von: Mapped["User"] = relationship(foreign_keys=[eroeffnet_von_id], lazy="raise")
    zugewiesen_an: Mapped["User | None"] = relationship(
        foreign_keys=[zugewiesen_an_id], lazy="raise"
    )
    status_wert: Mapped["AuswahllistenWert"] = relationship(foreign_keys=[status_id], lazy="raise")
    prioritaet_wert: Mapped["AuswahllistenWert"] = relationship(
        foreign_keys=[prioritaet_id], lazy="raise"
    )
    kategorie_wert: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[kategorie_id], lazy="raise"
    )
    objekt: Mapped["Objekt | None"] = relationship(lazy="raise")
    haus: Mapped["Haus | None"] = relationship(lazy="raise")
    stockwerk: Mapped["ObjektStockwerk | None"] = relationship(lazy="raise")
    einheit: Mapped["StockwerkEinheit | None"] = relationship(lazy="raise")
    partner: Mapped["GeschaeftsPartner | None"] = relationship(
        foreign_keys=[partner_id], lazy="raise"
    )
    tickettyp: Mapped["Tickettyp | None"] = relationship(lazy="raise")
    projekt: Mapped["Projekt | None"] = relationship(lazy="raise")
    quelle_wert: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[quelle_id], lazy="raise"
    )
    wartet_grund_wert: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[wartet_grund_id], lazy="raise"
    )
    wartet_nachunternehmer: Mapped["GeschaeftsPartner | None"] = relationship(
        foreign_keys=[wartet_nachunternehmer_id], lazy="raise"
    )
