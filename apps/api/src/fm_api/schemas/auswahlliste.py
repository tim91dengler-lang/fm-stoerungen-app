from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead


class AuswahllistenWertCreate(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=200)
    reihenfolge: int = 0
    farbe: str | None = Field(default=None, max_length=32)
    icon_name: str | None = Field(default=None, max_length=64)
    ist_aktiv: bool = True
    meta: dict[str, Any] | None = None


class AuswahllistenWertUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    reihenfolge: int | None = None
    farbe: str | None = Field(default=None, max_length=32)
    icon_name: str | None = Field(default=None, max_length=64)
    ist_aktiv: bool | None = None
    meta: dict[str, Any] | None = None


class AuswahllistenWertRead(TimestampedRead):
    auswahlliste_id: UUID
    key: str
    label: str
    reihenfolge: int
    farbe: str | None
    icon_name: str | None
    ist_aktiv: bool
    ist_system: bool
    meta: dict[str, Any] | None


class AuswahllisteCreate(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=200)
    beschreibung: str | None = None


class AuswahllisteUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None


class AuswahllisteRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    key: str
    label: str
    beschreibung: str | None
    ist_system: bool
    werte: list[AuswahllistenWertRead] = Field(default_factory=list)
