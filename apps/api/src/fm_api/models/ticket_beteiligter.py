from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.partner import GeschaeftsPartner, PartnerKontakt


class TicketBeteiligter(UuidPkMixin, TimestampMixin, Base):
    """Ein Beteiligter (Geschäftspartner + optional Ansprechpartner) an einem Ticket.

    Ersetzt das fixe Einzel-``partner_id`` durch eine flexible n:m-Liste mit
    konfigurierbarer Rolle (Auswahlliste ``beteiligten_rolle``). Kontaktdaten
    (E-Mail/Telefon/Mobil) werden read-only aus dem Stamm gezogen — bevorzugt aus
    dem zugeordneten Ansprechpartner, sonst aus dem Geschäftspartner.
    """

    __tablename__ = "ticket_beteiligte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    partner_kontakt_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("partner_kontakte.id", ondelete="SET NULL"),
        nullable=True,
    )
    rolle_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    ist_hauptkontakt: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # Kein ``ticket``-Relationship — vermeidet den Modul-Import-Zyklus
    # (ticket ↔ ticket_beteiligter). Die Zuordnung läuft über ticket_id; der
    # Service lädt Beteiligte explizit und hängt sie ans Ticket.
    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
    partner_kontakt: Mapped["PartnerKontakt | None"] = relationship(lazy="raise")
    rolle_wert: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")
