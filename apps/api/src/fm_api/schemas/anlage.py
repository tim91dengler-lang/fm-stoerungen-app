from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead


class AnlageBase(BaseModel):
    bezeichnung: str = Field(min_length=1, max_length=200)
    beschreibung: str | None = None
    icon_name: str | None = Field(default=None, max_length=64)
    kategorie_wert_id: UUID | None = None
    objekt_id: UUID | None = None
    stockwerk_id: UUID | None = None
    aktiv: bool = True
    reihenfolge: int = 0


class AnlageCreate(AnlageBase):
    pass


class AnlageUpdate(BaseModel):
    bezeichnung: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    icon_name: str | None = Field(default=None, max_length=64)
    kategorie_wert_id: UUID | None = None
    objekt_id: UUID | None = None
    stockwerk_id: UUID | None = None
    aktiv: bool | None = None
    reihenfolge: int | None = None


class KategorieRef(BaseModel):
    id: UUID
    key: str
    label: str
    farbe: str | None = None
    icon_name: str | None = None


class ObjektMini(BaseModel):
    id: UUID
    name: str


class StockwerkMini(BaseModel):
    id: UUID
    bezeichnung: str


class AnlageRead(TimestampedRead, AnlageBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    kategorie: KategorieRef | None = None
    objekt: ObjektMini | None = None
    stockwerk: StockwerkMini | None = None


class AnlageMini(BaseModel):
    id: UUID
    bezeichnung: str
    icon_name: str | None = None
