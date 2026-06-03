"""Schemas für die vierstufige Objektstruktur (plan.md §5.2)."""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.adresse import AdresseRead
from fm_api.schemas.common import TimestampedRead

AusrichtungLiteral = Literal["nord", "ost", "sued", "west"]


class PartnerMini(BaseModel):
    id: UUID
    name: str


class KontaktMini(BaseModel):
    """Ein aufgelöster Ansprechpartner (Read) mit klickbaren Kontaktdaten."""

    id: UUID
    name: str
    email: str | None = None
    telefon: str | None = None
    mobil: str | None = None


class BeteiligterRead(BaseModel):
    """Ein Beteiligter (Partner + freie Rolle) an einem Struktur-Knoten.

    Neues einheitliches Modell (ersetzt schrittweise eigentuemer/mieter).
    """

    id: UUID
    partner_id: UUID
    partner_name: str
    rolle_id: UUID | None = None
    rolle_label: str | None = None
    kontakte: list[KontaktMini] = Field(default_factory=list)


class BeteiligterWrite(BaseModel):
    """Eine Beteiligten-Zeile beim Schreiben (Voll-Replace der Liste).

    ``id`` gesetzt + zum Knoten gehörend → bestehende Zeile aktualisieren; sonst
    neu anlegen. Fehlende bestehende Zeilen werden entfernt. ``partner_id``,
    ``partner_kontakt_ids`` (mehrere Ansprechpartner desselben Partners) und
    ``rolle_id`` werden serverseitig mandantengebunden validiert (Rolle muss aus
    ``objekt_beteiligten_rolle`` stammen, jeder Kontakt muss zum Partner gehören).
    """

    id: UUID | None = None
    partner_id: UUID
    partner_kontakt_ids: list[UUID] = Field(default_factory=list)
    rolle_id: UUID | None = None
    reihenfolge: int | None = None


# -------- Einheit ----------------------------------------------------------


class EinheitCreate(BaseModel):
    bezeichnung: str = Field(min_length=1, max_length=120)
    groesse_qm: Decimal | None = None
    reihenfolge: int = 0
    eigentuemer_ids: list[UUID] = Field(default_factory=list)
    mieter_ids: list[UUID] = Field(default_factory=list)


class EinheitUpdate(BaseModel):
    bezeichnung: str | None = Field(default=None, min_length=1, max_length=120)
    groesse_qm: Decimal | None = None
    reihenfolge: int | None = None
    eigentuemer_ids: list[UUID] | None = None
    mieter_ids: list[UUID] | None = None
    beteiligte: list[BeteiligterWrite] | None = None


class EinheitRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    stockwerk_id: UUID
    bezeichnung: str
    groesse_qm: Decimal | None
    reihenfolge: int
    eigentuemer: list[PartnerMini] = Field(default_factory=list)
    mieter: list[PartnerMini] = Field(default_factory=list)
    beteiligte: list[BeteiligterRead] = Field(default_factory=list)


# -------- Stockwerk --------------------------------------------------------


class StockwerkCreate(BaseModel):
    bezeichnung: str = Field(min_length=1, max_length=120)
    ausrichtung: AusrichtungLiteral | None = None
    reihenfolge: int = 0
    eigentuemer_ids: list[UUID] = Field(default_factory=list)
    mieter_ids: list[UUID] = Field(
        default_factory=list,
        description="Fallback wenn das Stockwerk keine Einheiten hat",
    )


class StockwerkUpdate(BaseModel):
    bezeichnung: str | None = Field(default=None, min_length=1, max_length=120)
    ausrichtung: AusrichtungLiteral | None = None
    reihenfolge: int | None = None
    eigentuemer_ids: list[UUID] | None = None
    mieter_ids: list[UUID] | None = None
    beteiligte: list[BeteiligterWrite] | None = None


class StockwerkRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    haus_id: UUID
    bezeichnung: str
    ausrichtung: AusrichtungLiteral | None
    reihenfolge: int
    has_grundriss: bool
    grundriss_mime: str | None
    eigentuemer: list[PartnerMini] = Field(default_factory=list)
    mieter: list[PartnerMini] = Field(default_factory=list)
    beteiligte: list[BeteiligterRead] = Field(default_factory=list)
    einheiten: list[EinheitRead] = Field(default_factory=list)


# -------- Haus -------------------------------------------------------------


class HausCreate(BaseModel):
    bezeichnung: str = Field(min_length=1, max_length=200)
    adresse_id: UUID | None = None
    notiz: str | None = None
    reihenfolge: int = 0
    eigentuemer_ids: list[UUID] = Field(default_factory=list)
    mieter_ids: list[UUID] = Field(default_factory=list)


class HausUpdate(BaseModel):
    bezeichnung: str | None = Field(default=None, min_length=1, max_length=200)
    adresse_id: UUID | None = None
    notiz: str | None = None
    reihenfolge: int | None = None
    eigentuemer_ids: list[UUID] | None = None
    mieter_ids: list[UUID] | None = None
    beteiligte: list[BeteiligterWrite] | None = None


class HausRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    objekt_id: UUID
    bezeichnung: str
    notiz: str | None
    reihenfolge: int
    adresse: AdresseRead | None = None
    eigentuemer: list[PartnerMini] = Field(default_factory=list)
    mieter: list[PartnerMini] = Field(default_factory=list)
    beteiligte: list[BeteiligterRead] = Field(default_factory=list)
    stockwerke: list[StockwerkRead] = Field(default_factory=list)
