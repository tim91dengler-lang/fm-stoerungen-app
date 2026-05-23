from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.anlage import AnlageMini, KategorieRef
from fm_api.schemas.common import TimestampedRead


class FehlercodeBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    titel: str = Field(min_length=1, max_length=200)
    beschreibung: str | None = None
    loesung: str | None = None
    kategorie_wert_id: UUID | None = None
    prio_default_wert_id: UUID | None = None
    tickettyp_default_id: UUID | None = None
    anlage_id: UUID | None = None
    quelle: str | None = Field(default=None, max_length=64)
    aktiv: bool = True


class FehlercodeCreate(FehlercodeBase):
    pass


class FehlercodeUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    loesung: str | None = None
    kategorie_wert_id: UUID | None = None
    prio_default_wert_id: UUID | None = None
    tickettyp_default_id: UUID | None = None
    anlage_id: UUID | None = None
    quelle: str | None = Field(default=None, max_length=64)
    aktiv: bool | None = None


class TickettypMiniRef(BaseModel):
    id: UUID
    key: str
    label: str


class PrioRef(BaseModel):
    id: UUID
    key: str
    label: str
    farbe: str | None = None


class FehlercodeRead(TimestampedRead, FehlercodeBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    kategorie: KategorieRef | None = None
    prio_default: PrioRef | None = None
    tickettyp_default: TickettypMiniRef | None = None
    anlage: AnlageMini | None = None
    nutzung_count: int = 0


class FehlercodeMini(BaseModel):
    id: UUID
    code: str
    titel: str
    beschreibung: str | None = None
