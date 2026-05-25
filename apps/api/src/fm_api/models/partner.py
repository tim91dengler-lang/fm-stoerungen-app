from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Enum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import SoftDeleteMixin, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.adresse import Adresse
    from fm_api.models.auswahlliste import AuswahllistenWert
    from fm_api.models.mandant import Mandant


class PartnerTyp(StrEnum):
    MIETER = "mieter"
    EIGENTUEMER = "eigentuemer"
    AUFTRAGGEBER = "auftraggeber"
    NACHUNTERNEHMER = "nachunternehmer"
    PRIVATPERSON = "privatperson"


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
    # Partner-Nummer ist eine Postgres-Sequence (gemeinsam für alle Mandanten),
    # gibt es zur internen Referenz; standardmäßig nicht in der Liste angezeigt.
    partner_nummer: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        server_default="nextval('partner_nummer_seq')",
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    notiz: Mapped[str | None] = mapped_column(Text, nullable=True)
    typen: Mapped[list[PartnerTyp]] = mapped_column(
        ARRAY(partner_typ_enum), nullable=False, server_default="{}"
    )

    # Hierarchie — Niederlassungen werden als eigene Partner mit parent_partner_id
    # modelliert. Self-FK, nullable, ondelete SET NULL (Kind bleibt erhalten,
    # wenn Mutter hart gelöscht würde — was wegen Sperr-Konvention nicht
    # passieren sollte).
    parent_partner_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Soft-Sperre. UI-Label „Sperren / Entsperren". Greift in Such-Pickern.
    # Setzen + Rücksetzen erfolgen rekursiv über den Service.
    gesperrt: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", index=True
    )

    # Klassifikation über Auswahllisten (Tim pflegt die Werte).
    rechtsform_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    branche_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Identifikatoren.
    ust_id_nr: Mapped[str | None] = mapped_column(String(32), nullable=True)
    steuer_nr: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hrb: Mapped[str | None] = mapped_column(String(64), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Personenfelder am Partner — bei Firma typischerweise nur `anrede_id`
    # für Anschrift; bei Privatperson alle vier gefüllt.
    anrede_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    titel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vorname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    nachname: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Direkte Kontaktdaten am Partner (für Privatpersonen + als Fallback,
    # wenn keine separaten Kontakte gepflegt werden).
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefon: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Relationships
    mandant: Mapped["Mandant"] = relationship(lazy="raise")
    parent: Mapped["GeschaeftsPartner | None"] = relationship(
        "GeschaeftsPartner",
        remote_side="GeschaeftsPartner.id",
        back_populates="children",
        lazy="raise",
    )
    children: Mapped[list["GeschaeftsPartner"]] = relationship(
        "GeschaeftsPartner",
        back_populates="parent",
        lazy="raise",
    )
    rechtsform: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[rechtsform_id], lazy="raise"
    )
    branche: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[branche_id], lazy="raise"
    )
    anrede: Mapped["AuswahllistenWert | None"] = relationship(
        foreign_keys=[anrede_id], lazy="raise"
    )
    kontakte: Mapped[list["PartnerKontakt"]] = relationship(
        back_populates="partner",
        cascade="all, delete-orphan",
        lazy="raise",
    )
    adress_links: Mapped[list["PartnerAdresse"]] = relationship(
        back_populates="partner",
        cascade="all, delete-orphan",
        lazy="raise",
    )


class PartnerKontakt(UuidPkMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Eine Person, die an einem Geschäftspartner hängt (Firma → n Personen)."""

    __tablename__ = "partner_kontakte"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    anrede_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    titel: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vorname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    nachname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Mehrfach-Rollen — Array von Auswahlliste-Wert-IDs.
    rollen: Mapped[list[UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), nullable=False, server_default="{}"
    )
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mobil: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ist_hauptkontakt: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    gesperrt: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    notiz: Mapped[str | None] = mapped_column(Text, nullable=True)

    partner: Mapped["GeschaeftsPartner"] = relationship(back_populates="kontakte", lazy="raise")
    anrede: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")


class PartnerAdresse(UuidPkMixin, TimestampMixin, Base):
    """Junction Partner ↔ Adresse mit Typ (Hauptsitz/Rechnung/Liefer/…)."""

    __tablename__ = "partner_adressen"

    mandant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    partner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("geschaeftspartner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    adresse_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("adressen.id", ondelete="RESTRICT"),
        nullable=False,
    )
    typ_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auswahllisten_werte.id", ondelete="SET NULL"),
        nullable=True,
    )
    ist_primaer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    partner: Mapped["GeschaeftsPartner"] = relationship(back_populates="adress_links", lazy="raise")
    adresse: Mapped["Adresse"] = relationship(lazy="raise")
    typ: Mapped["AuswahllistenWert | None"] = relationship(lazy="raise")
