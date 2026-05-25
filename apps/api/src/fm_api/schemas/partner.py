from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from fm_api.schemas.adresse import AdresseRead
from fm_api.schemas.common import TimestampedRead

PartnerTypLiteral = Literal[
    "mieter",
    "eigentuemer",
    "auftraggeber",
    "nachunternehmer",
    "privatperson",
]


# ----- Sub-Resources: Kontakt -----------------------------------------------


class PartnerKontaktBase(BaseModel):
    anrede_id: UUID | None = None
    titel: str | None = Field(default=None, max_length=64)
    vorname: str | None = Field(default=None, max_length=120)
    nachname: str | None = Field(default=None, max_length=120)
    rollen: list[UUID] = Field(default_factory=list)
    email: EmailStr | None = None
    telefon: str | None = Field(default=None, max_length=64)
    mobil: str | None = Field(default=None, max_length=64)
    ist_hauptkontakt: bool = False
    gesperrt: bool = False
    notiz: str | None = None


class PartnerKontaktCreate(PartnerKontaktBase):
    pass


class PartnerKontaktUpdate(BaseModel):
    anrede_id: UUID | None = None
    titel: str | None = Field(default=None, max_length=64)
    vorname: str | None = Field(default=None, max_length=120)
    nachname: str | None = Field(default=None, max_length=120)
    rollen: list[UUID] | None = None
    email: EmailStr | None = None
    telefon: str | None = Field(default=None, max_length=64)
    mobil: str | None = Field(default=None, max_length=64)
    ist_hauptkontakt: bool | None = None
    gesperrt: bool | None = None
    notiz: str | None = None


class PartnerKontaktRead(TimestampedRead, PartnerKontaktBase):
    model_config = ConfigDict(from_attributes=True)

    partner_id: UUID


# ----- Sub-Resources: Adress-Junction ---------------------------------------


class PartnerAdresseBase(BaseModel):
    adresse_id: UUID
    typ_id: UUID | None = None
    ist_primaer: bool = False


class PartnerAdresseCreate(PartnerAdresseBase):
    pass


class PartnerAdresseUpdate(BaseModel):
    typ_id: UUID | None = None
    ist_primaer: bool | None = None


class PartnerAdresseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    partner_id: UUID
    adresse_id: UUID
    typ_id: UUID | None = None
    ist_primaer: bool
    adresse: AdresseRead | None = None


# ----- Partner --------------------------------------------------------------


class PartnerBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent_partner_id: UUID | None = None
    rechtsform_id: UUID | None = None
    branche_id: UUID | None = None
    anrede_id: UUID | None = None
    titel: str | None = Field(default=None, max_length=64)
    vorname: str | None = Field(default=None, max_length=120)
    nachname: str | None = Field(default=None, max_length=120)
    ust_id_nr: str | None = Field(default=None, max_length=32)
    steuer_nr: str | None = Field(default=None, max_length=32)
    hrb: str | None = Field(default=None, max_length=64)
    website: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telefon: str | None = Field(default=None, max_length=64)
    notiz: str | None = None
    typen: list[PartnerTypLiteral] = Field(default_factory=list)


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_partner_id: UUID | None = None
    rechtsform_id: UUID | None = None
    branche_id: UUID | None = None
    anrede_id: UUID | None = None
    titel: str | None = Field(default=None, max_length=64)
    vorname: str | None = Field(default=None, max_length=120)
    nachname: str | None = Field(default=None, max_length=120)
    ust_id_nr: str | None = Field(default=None, max_length=32)
    steuer_nr: str | None = Field(default=None, max_length=32)
    hrb: str | None = Field(default=None, max_length=64)
    website: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    telefon: str | None = Field(default=None, max_length=64)
    notiz: str | None = None
    typen: list[PartnerTypLiteral] | None = None


class PartnerRead(TimestampedRead, PartnerBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    partner_nummer: int
    gesperrt: bool
    kontakte: list[PartnerKontaktRead] = Field(default_factory=list)
    adress_links: list[PartnerAdresseRead] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def ansprechpartner(self) -> str | None:
        """Backward-Compat-Feld für das Frontend (Phase 6c-Frontend stellt
        es später auf `kontakte[ist_hauptkontakt].nachname` um). Baut den
        Anzeigetext aus dem Hauptkontakt zusammen — bei Privatperson aus
        den Partner-Personenfeldern."""
        haupt = next((k for k in self.kontakte if k.ist_hauptkontakt), None)
        if haupt is not None:
            parts = [haupt.titel, haupt.vorname, haupt.nachname]
            joined = " ".join(p for p in parts if p)
            return joined or None
        # Fallback: Personenfelder direkt am Partner (Privatperson-Fall)
        parts = [self.titel, self.vorname, self.nachname]
        joined = " ".join(p for p in parts if p)
        return joined or None


class PartnerSperrenResponse(BaseModel):
    """Antwort beim Sperren / Entsperren — listet alle betroffenen IDs (Partner + Filialen)."""

    betroffene_partner_ids: list[UUID]
    anzahl: int
