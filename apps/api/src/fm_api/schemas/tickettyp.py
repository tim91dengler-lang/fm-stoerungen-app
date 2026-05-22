from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead


class TickettypBase(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    beschreibung: str | None = None
    icon: str | None = Field(default=None, max_length=64)
    farbe: str | None = Field(default=None, max_length=32)
    pflichtfelder: list[Any] = Field(default_factory=list)
    default_reminder_tage: int = 0
    reihenfolge: int = 0


class TickettypCreate(TickettypBase):
    pass


class TickettypUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    beschreibung: str | None = None
    icon: str | None = Field(default=None, max_length=64)
    farbe: str | None = Field(default=None, max_length=32)
    pflichtfelder: list[Any] | None = None
    default_reminder_tage: int | None = None
    reihenfolge: int | None = None


class TickettypRead(TimestampedRead, TickettypBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    ist_system: bool


class TickettypMini(BaseModel):
    id: UUID
    key: str
    label: str
    icon: str | None = None
    farbe: str | None = None
