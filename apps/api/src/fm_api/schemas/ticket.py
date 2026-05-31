from datetime import date, datetime
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


class HausRef(BaseModel):
    id: UUID
    bezeichnung: str


class StockwerkRef(BaseModel):
    id: UUID
    bezeichnung: str
    has_grundriss: bool = False


class EinheitRef(BaseModel):
    id: UUID
    bezeichnung: str


class PartnerRef(BaseModel):
    id: UUID
    name: str
    typen: list[str] = []


class TickettypRef(BaseModel):
    id: UUID
    key: str
    label: str
    icon: str | None = None
    farbe: str | None = None


class ProjektRefMini(BaseModel):
    id: UUID
    name: str
    status: str


class AnlageRef(BaseModel):
    id: UUID
    bezeichnung: str
    icon_name: str | None = None


class FehlercodeRef(BaseModel):
    id: UUID
    code: str
    titel: str


def _normalize_slug(v: str | None) -> str | None:
    if v is None:
        return None
    return v.strip().lower()


class TicketPin(BaseModel):
    """Eine Grundriss-Markierung (Prozentkoordinaten 0..100)."""

    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    label: str | None = Field(default=None, max_length=80)


class TicketCreate(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    beschreibung: str = ""
    status: str | None = Field(default=None, max_length=64)
    prioritaet: str = Field(default="mittel", max_length=64)
    kategorie: str | None = Field(default=None, max_length=64)
    quelle: str | None = Field(default=None, max_length=64)
    melder: str | None = Field(default=None, max_length=200)
    objekt_id: UUID | None = None
    haus_id: UUID | None = None
    stockwerk_id: UUID | None = None
    einheit_id: UUID | None = None
    pins: list[TicketPin] = Field(default_factory=list)
    partner_id: UUID | None = None
    zugewiesen_an_id: UUID | None = None
    tickettyp_id: UUID | None = None
    projekt_id: UUID | None = None
    anlage_id: UUID | None = None
    fehlercode_id: UUID | None = None
    faelligkeit_am: date | None = None
    wiederholung: str | None = Field(default=None, max_length=32)

    @field_validator("status", "prioritaet", "kategorie", "quelle", mode="before")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return _normalize_slug(v)


class TicketUpdate(BaseModel):
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    status: str | None = Field(default=None, max_length=64)
    prioritaet: str | None = Field(default=None, max_length=64)
    kategorie: str | None = Field(default=None, max_length=64)
    quelle: str | None = Field(default=None, max_length=64)
    melder: str | None = Field(default=None, max_length=200)
    objekt_id: UUID | None = None
    haus_id: UUID | None = None
    stockwerk_id: UUID | None = None
    einheit_id: UUID | None = None
    pins: list[TicketPin] | None = None
    partner_id: UUID | None = None
    zugewiesen_an_id: UUID | None = None
    tickettyp_id: UUID | None = None
    projekt_id: UUID | None = None
    anlage_id: UUID | None = None
    fehlercode_id: UUID | None = None
    faelligkeit_am: date | None = None
    wiederholung: str | None = Field(default=None, max_length=32)
    wartet_grund: str | None = Field(default=None, max_length=64)
    wartet_nachunternehmer_id: UUID | None = None
    wartet_kontakt_name: str | None = Field(default=None, max_length=200)
    wartet_kontakt_telefon: str | None = Field(default=None, max_length=64)
    wartet_kontakt_email: str | None = Field(default=None, max_length=255)

    @field_validator("status", "prioritaet", "kategorie", "quelle", "wartet_grund", mode="before")
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
    quelle: AuswahlWertRef | None = None
    melder: str | None = None
    objekt: ObjektRef | None = None
    haus: HausRef | None = None
    stockwerk: StockwerkRef | None = None
    einheit: EinheitRef | None = None
    pins: list[TicketPin] = Field(default_factory=list)
    partner: PartnerRef | None = None
    tickettyp: TickettypRef | None = None
    projekt: ProjektRefMini | None = None
    anlage: AnlageRef | None = None
    fehlercode: FehlercodeRef | None = None
    faelligkeit_am: date | None = None
    wiederholung: str | None = None
    wartet_grund: AuswahlWertRef | None = None
    wartet_nachunternehmer: PartnerRef | None = None
    wartet_kontakt_name: str | None = None
    wartet_kontakt_telefon: str | None = None
    wartet_kontakt_email: str | None = None

    eroeffnet_von: UserRef
    zugewiesen_an: UserRef | None = None

    eroeffnet_am: datetime
    zugewiesen_am: datetime | None = None
    erledigt_am: datetime | None = None
    geschlossen_am: datetime | None = None

    @classmethod
    def from_orm_ticket(cls, t: "object") -> "TicketRead":
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
            quelle=(
                AuswahlWertRef(
                    id=t.quelle_wert.id,
                    key=t.quelle_wert.key,
                    label=t.quelle_wert.label,
                    farbe=t.quelle_wert.farbe,
                )
                if t.quelle_wert is not None
                else None
            ),
            melder=t.melder,
            objekt=ObjektRef(id=t.objekt.id, name=t.objekt.name) if t.objekt else None,
            haus=HausRef(id=t.haus.id, bezeichnung=t.haus.bezeichnung) if t.haus else None,
            stockwerk=StockwerkRef(
                id=t.stockwerk.id,
                bezeichnung=t.stockwerk.bezeichnung,
                has_grundriss=t.stockwerk.grundriss_storage_path is not None,
            )
            if t.stockwerk
            else None,
            einheit=EinheitRef(id=t.einheit.id, bezeichnung=t.einheit.bezeichnung)
            if t.einheit
            else None,
            pins=[
                TicketPin(x=float(pp["x"]), y=float(pp["y"]), label=pp.get("label"))
                for pp in (t.pins or [])
            ],
            partner=PartnerRef(
                id=t.partner.id,
                name=t.partner.name,
                typen=[str(ty) for ty in t.partner.typen],
            )
            if t.partner
            else None,
            tickettyp=TickettypRef(
                id=t.tickettyp.id,
                key=t.tickettyp.key,
                label=t.tickettyp.label,
                icon=t.tickettyp.icon,
                farbe=t.tickettyp.farbe,
            )
            if t.tickettyp
            else None,
            projekt=ProjektRefMini(
                id=t.projekt.id,
                name=t.projekt.name,
                status=t.projekt.status_wert.key,
            )
            if t.projekt
            else None,
            anlage=AnlageRef(
                id=t.anlage.id,
                bezeichnung=t.anlage.bezeichnung,
                icon_name=t.anlage.icon_name,
            )
            if t.anlage
            else None,
            fehlercode=FehlercodeRef(
                id=t.fehlercode.id, code=t.fehlercode.code, titel=t.fehlercode.titel
            )
            if t.fehlercode
            else None,
            faelligkeit_am=t.faelligkeit_am,
            wiederholung=t.wiederholung,
            wartet_grund=(
                AuswahlWertRef(
                    id=t.wartet_grund_wert.id,
                    key=t.wartet_grund_wert.key,
                    label=t.wartet_grund_wert.label,
                    farbe=t.wartet_grund_wert.farbe,
                )
                if t.wartet_grund_wert is not None
                else None
            ),
            wartet_nachunternehmer=(
                PartnerRef(
                    id=t.wartet_nachunternehmer.id,
                    name=t.wartet_nachunternehmer.name,
                    typen=[str(ty) for ty in t.wartet_nachunternehmer.typen],
                )
                if t.wartet_nachunternehmer is not None
                else None
            ),
            wartet_kontakt_name=t.wartet_kontakt_name,
            wartet_kontakt_telefon=t.wartet_kontakt_telefon,
            wartet_kontakt_email=t.wartet_kontakt_email,
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
    id: UUID
    nummer: int
    titel: str
    status: AuswahlWertRef
    prioritaet: AuswahlWertRef
    zugewiesen_an: UserRef | None = None
    eroeffnet_am: datetime
