from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.ticket import AuswahlWertRef, ObjektRef, UserRef


def _normalize_slug(v: str | None) -> str | None:
    if v is None:
        return None
    return v.strip().lower()


class ProjektCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    beschreibung: str | None = None
    projekttyp_slug: str = Field(min_length=1, max_length=64)
    status_slug: str = Field(default="geplant", max_length=64)
    verantwortlich_user_id: UUID | None = None
    start_am: date | None = None
    ende_am: date | None = None
    notizen: str | None = None
    objekt_ids: list[UUID] = Field(default_factory=list)

    @field_validator("projekttyp_slug", "status_slug", mode="before")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return _normalize_slug(v)


class ProjektUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    beschreibung: str | None = None
    projekttyp_slug: str | None = Field(default=None, max_length=64)
    status_slug: str | None = Field(default=None, max_length=64)
    verantwortlich_user_id: UUID | None = None
    start_am: date | None = None
    ende_am: date | None = None
    notizen: str | None = None
    objekt_ids: list[UUID] | None = None

    @field_validator("projekttyp_slug", "status_slug", mode="before")
    @classmethod
    def _lower(cls, v: str | None) -> str | None:
        return _normalize_slug(v)


class ProjektMini(BaseModel):
    """Mini-Repräsentation für Embedding (z. B. in Ticket.projekt)."""

    id: UUID
    name: str
    status: str  # slug (key) — Legacy-kompatibel für TicketRead.projekt.status


class ProjektRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    name: str
    beschreibung: str | None = None
    projekttyp: AuswahlWertRef
    status: AuswahlWertRef
    verantwortlich: UserRef | None = None
    start_am: date | None = None
    ende_am: date | None = None
    notizen: str | None = None
    objekte: list[ObjektRef] = Field(default_factory=list)
    ticket_count: int = 0
