"""Einheitliches Beteiligte-Modell für die Objektstruktur.

Ersetzt die festen Eigentümer/Mieter-Junctions (haus_eigentuemer, …) und
``ObjektPartner`` durch je eine Tabelle pro Ebene mit **Partner + freier Rolle**
(Auswahlliste ``objekt_beteiligten_rolle``) — analog ``TicketBeteiligter``.

Bewusst **kein** Parent-Relationship (z. B. zu Haus) → vermeidet den
Modul-Import-Zyklus (Memory ``codeql-cyclic-import-models``); der Service lädt die
Beteiligten explizit über die FK-Spalte.

Expand-Phase: diese Tabellen entstehen zusätzlich zu den alten; die Daten-
Migration (Phase 1b) befüllt sie, die alten Tabellen werden erst später gedroppt
(Memory ``migration-expand-contract-drop``).
"""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.partner import GeschaeftsPartner, PartnerKontakt


class ObjektBeteiligter(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "objekt_beteiligte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    objekt_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekte.id", ondelete="CASCADE"),
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
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
    partner_kontakt: Mapped["PartnerKontakt | None"] = relationship(lazy="raise")
    rolle_wert: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")


class HausBeteiligter(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "haus_beteiligte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    haus_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("haus.id", ondelete="CASCADE"),
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
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
    partner_kontakt: Mapped["PartnerKontakt | None"] = relationship(lazy="raise")
    rolle_wert: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")


class StockwerkBeteiligter(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "stockwerk_beteiligte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    stockwerk_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("objekt_stockwerk.id", ondelete="CASCADE"),
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
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
    partner_kontakt: Mapped["PartnerKontakt | None"] = relationship(lazy="raise")
    rolle_wert: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")


class EinheitBeteiligter(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "einheit_beteiligte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    einheit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("stockwerk_einheit.id", ondelete="CASCADE"),
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
    reihenfolge: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    partner: Mapped["GeschaeftsPartner"] = relationship(lazy="raise")
    partner_kontakt: Mapped["PartnerKontakt | None"] = relationship(lazy="raise")
    rolle_wert: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")
