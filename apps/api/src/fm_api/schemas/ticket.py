from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from fm_api.models.ticket import TicketPrioritaet, TicketStatus
from fm_api.schemas.common import ORMModel, TimestampedRead


class UserRef(ORMModel):
    id: UUID
    full_name: str


class TicketCreate(BaseModel):
    titel: str = Field(min_length=1, max_length=200)
    beschreibung: str = ""
    prioritaet: TicketPrioritaet = TicketPrioritaet.MITTEL
    zugewiesen_an_id: UUID | None = None


class TicketUpdate(BaseModel):
    titel: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    prioritaet: TicketPrioritaet | None = None
    status: TicketStatus | None = None
    zugewiesen_an_id: UUID | None = None


class TicketRead(TimestampedRead):
    mandant_id: UUID
    nummer: int
    titel: str
    beschreibung: str
    status: TicketStatus
    prioritaet: TicketPrioritaet

    eroeffnet_von: UserRef
    zugewiesen_an: UserRef | None = None

    eroeffnet_am: datetime
    zugewiesen_am: datetime | None = None
    erledigt_am: datetime | None = None
    geschlossen_am: datetime | None = None


class TicketSummary(ORMModel):
    id: UUID
    nummer: int
    titel: str
    status: TicketStatus
    prioritaet: TicketPrioritaet
    zugewiesen_an: UserRef | None = None
    eroeffnet_am: datetime
