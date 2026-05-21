from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from fm_api.schemas.common import ORMModel, TimestampedRead


class UserRef(ORMModel):
    id: UUID
    full_name: str


class AuswahlWertRef(BaseModel):
    """Ausgabe-Darstellung eines Auswahllisten-Werts (slug + Anzeige-Felder)."""

    id: UUID
    key: str
    label: str
    farbe: str | None = None


class ObjektRef(BaseModel):
    id: UUID
    name: str


class PartnerRef(BaseModel):
    id: UUID
    name: str


def _normalize_slug(v: str | None) -> str | None:
    if v is None:
        return None
    return v.strip().lower()


class TicketCreate(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    beschreibung: str = ""
    status: str | None = Field(default=None, max_length=64)
    prioritaet: str = Field(default="mittel", max_length=64)
    kategorie: str | None = Field(default=None, max_length=64)
    objekt_id: UUID | None = None
    partner_id: UUID | None = None
    zugewiesen_an_id: UUID | None = None

    @field_validator("status", "prioritaet", "kategorie", mode="before")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return _normalize_slug(v)


class TicketUpdate(BaseModel):
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    status: str | None = Field(default=None, max_length=64)
    prioritaet: str | None = Field(default=None, max_length=64)
    kategorie: str | None = Field(default=None, max_length=64)
    objekt_id: UUID | None = None
    partner_id: UUID | None = None
    zugewiesen_an_id: UUID | None = None

    @field_validator("status", "prioritaet", "kategorie", mode="before")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return _normalize_slug(v)


class TicketRead(TimestampedRead):
    mandant_id: UUID
    nummer: int
    titel: str
    beschreibung: str
    status: AuswahlWertRef
    prioritaet: AuswahlWertRef
    kategorie: AuswahlWertRef | None = None
    objekt: ObjektRef | None = None
    partner: PartnerRef | None = None

    eroeffnet_von: UserRef
    zugewiesen_an: UserRef | None = None

    eroeffnet_am: datetime
    zugewiesen_am: datetime | None = None
    erledigt_am: datetime | None = None
    geschlossen_am: datetime | None = None

    @classmethod
    def from_orm_ticket(cls, t: "object") -> "TicketRead":
        """Bauen aus einem geladenen Ticket-ORM-Objekt mit aufgelösten Relationships."""

        from fm_api.models.ticket import Ticket

        if not isinstance(t, Ticket):
            raise TypeError(f"expected Ticket, got {type(t).__name__}")
        return cls(
            id=t.id,
            mandant_id=t.mandant_id,
            nummer=t.nummer,
            titel=t.titel,
            beschreibung=t.beschreibung,
            status=AuswahlWertRef(
                id=t.status_wert.id,
                key=t.status_wert.key,
                label=t.status_wert.label,
                farbe=t.status_wert.farbe,
            ),
            prioritaet=AuswahlWertRef(
                id=t.prioritaet_wert.id,
                key=t.prioritaet_wert.key,
                label=t.prioritaet_wert.label,
                farbe=t.prioritaet_wert.farbe,
            ),
            kategorie=(
                AuswahlWertRef(
                    id=t.kategorie_wert.id,
                    key=t.kategorie_wert.key,
                    label=t.kategorie_wert.label,
                    farbe=t.kategorie_wert.farbe,
                )
                if t.kategorie_wert is not None
                else None
            ),
            objekt=ObjektRef(id=t.objekt.id, name=t.objekt.name) if t.objekt is not None else None,
            partner=PartnerRef(id=t.partner.id, name=t.partner.name)
            if t.partner is not None
            else None,
            eroeffnet_von=UserRef(id=t.eroeffnet_von.id, full_name=t.eroeffnet_von.full_name),
            zugewiesen_an=(
                UserRef(id=t.zugewiesen_an.id, full_name=t.zugewiesen_an.full_name)
                if t.zugewiesen_an is not None
                else None
            ),
            eroeffnet_am=t.eroeffnet_am,
            zugewiesen_am=t.zugewiesen_am,
            erledigt_am=t.erledigt_am,
            geschlossen_am=t.geschlossen_am,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )


class TicketSummary(BaseModel):
    """Kompakte Darstellung für die Liste (weniger Felder = kleinere Response)."""

    id: UUID
    nummer: int
    titel: str
    status: AuswahlWertRef
    prioritaet: AuswahlWertRef
    zugewiesen_an: UserRef | None = None
    eroeffnet_am: datetime
