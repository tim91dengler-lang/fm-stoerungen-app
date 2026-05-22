from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.ticket import UserRef

ProjektStatusLiteral = Literal["geplant", "laufend", "abgeschlossen", "storniert"]


class ProjektBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    beschreibung: str | None = None
    objekt_id: UUID | None = None
    verantwortlich_user_id: UUID | None = None
    start_am: date | None = None
    ende_am: date | None = None
    status: ProjektStatusLiteral = "geplant"
    notizen: str | None = None


class ProjektCreate(ProjektBase):
    pass


class ProjektUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    objekt_id: UUID | None = None
    verantwortlich_user_id: UUID | None = None
    start_am: date | None = None
    ende_am: date | None = None
    status: ProjektStatusLiteral | None = None
    notizen: str | None = None


class ProjektMini(BaseModel):
    id: UUID
    name: str
    status: str


class ProjektRead(TimestampedRead, ProjektBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    verantwortlich: UserRef | None = None
    ticket_count: int = 0
