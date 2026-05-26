from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

from fm_api.schemas.adresse import AdresseRead
from fm_api.schemas.common import TimestampedRead

# Slug-Literal für `ObjektPartner.rolle` (Postgres-Enum bleibt erhalten,
# auch nach Track 3 Sub-PR B — Tim-Entscheidung 2026-04-20). Wird von
# `schemas.objekt` importiert.
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
    mobil: str | None = Field(default=None, max_length=64)
    telefax: str | None = Field(default=None, max_length=64)
    notiz: str | None = None
    # UUID-Array auf Auswahllisten-Werte der Liste `partner_typ`
    # (umgestellt in Migration 0016 / Track 3 Sub-PR B).
    typen: list[UUID] = Field(default_factory=list)


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
    mobil: str | None = Field(default=None, max_length=64)
    telefax: str | None = Field(default=None, max_length=64)
    notiz: str | None = None
    typen: list[UUID] | None = None


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


# ----- Track 3: Hierarchie / verlinkte Listen -------------------------------


class PartnerHierarchieKnoten(BaseModel):
    """Knoten im Filialen-Baum. Rekursive Struktur."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    gesperrt: bool
    ist_root: bool = False
    ist_aktueller_partner: bool = False
    children: list["PartnerHierarchieKnoten"] = Field(default_factory=list)


class PartnerHierarchieResponse(BaseModel):
    """Antwort auf GET /partner/{id}/hierarchie. `root` ist die oberste
    erreichbare Mutter (oder der aktuelle Partner, falls keine Mutter)."""

    root: PartnerHierarchieKnoten


class PartnerObjektLinkRead(BaseModel):
    """Objekt mit Bezug zum aktuellen Partner (Track 3, Tab 3)."""

    model_config = ConfigDict(from_attributes=True)

    objekt_id: UUID
    objekt_name: str
    gesperrt: bool
    rollen: list[str]
    adresse_kurz: str | None = None


class PartnerProjektLinkRead(BaseModel):
    """Projekt mit transitivem Partner-Bezug (Track 3, Tab 4).

    Track 3 / Tim 2026-04-20: Projekt hat keinen direkten Partner-FK —
    Bezug entsteht über `ProjektObjektLink` → `Objekt` → `ObjektPartner`.
    `rollen_an_objekten` listet die Rollen, in denen der Partner an den
    Projekt-Objekten beteiligt ist (z. B. ['eigentuemer'] oder
    ['eigentuemer', 'mieter'])."""

    model_config = ConfigDict(from_attributes=True)

    projekt_id: UUID
    name: str
    status_label: str
    status_farbe: str | None = None
    projekttyp_label: str
    start_am: str | None = None
    ende_am: str | None = None
    rollen_an_objekten: list[str]


class PartnerTicketLinkRead(BaseModel):
    """Ticket mit Partner-Bezug (Track 3, Tab 5).

    Bezug ist direkt: `Ticket.partner_id` ODER
    `Ticket.wartet_nachunternehmer_id` zeigt auf den Partner."""

    model_config = ConfigDict(from_attributes=True)

    ticket_id: UUID
    nummer: int
    titel: str
    status_slug: str
    status_label: str
    status_farbe: str | None = None
    prioritaet_label: str
    prioritaet_farbe: str | None = None
    objekt_id: UUID | None = None
    objekt_name: str | None = None
    melder: str | None = None
    eroeffnet_am: str
    rolle_am_ticket: str  # 'partner' | 'wartet_nachunternehmer'
