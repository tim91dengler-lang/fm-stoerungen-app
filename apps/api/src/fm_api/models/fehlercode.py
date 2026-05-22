from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.anlage import Anlage
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.mandant import Mandant
    from fm_api.models.tickettyp import Tickettyp


class Fehlercode(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Fehlercode als Stammvorlage für wiederkehrende Störungen.

    Bei Auswahl im Ticket wird in Slice 1 **nur die Beschreibung** vorbefüllt
    (Entscheidung Tim 2026-05-22). Mapping zu Kategorie/Prio/Tickettyp/Anlage
    ist in der DB schon da, das Frontend-Pre-Fill folgt nach Abstimmung.
    """

    __tablename__ = "fehlercodes"
    __table_args__ = (
        UniqueConstraint("mandant_id", "code", name="uq_fehlercodes_mandant_id_code"),
    )

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    titel: Mapped[str] = mapped_column(String(200), nullable=False)
    beschreibung: Mapped[str | None] = mapped_column(Text, nullable=True)
    loesung: Mapped[str | None] = mapped_column(Text, nullable=True)
    kategorie_wert_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    prio_default_wert_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    tickettyp_default_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tickettypen.id", ondelete="SET NULL"),
        nullable=True,
    )
    anlage_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("anlagen.id", ondelete="SET NULL"),
        nullable=True,
    )
    quelle: Mapped[str | None] = mapped_column(String(64), nullable=True)
    aktiv: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    kategorie_wert: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[kategorie_wert_id], lazy="raise"
    )
    prio_default_wert: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[prio_default_wert_id], lazy="raise"
    )
    tickettyp_default: Mapped["Tickettyp | None"] = relationship(lazy="raise")
    anlage: Mapped["Anlage | None"] = relationship(lazy="raise")
