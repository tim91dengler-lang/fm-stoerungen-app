from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.ticket import UserRef

DokumentTargetLiteral = Literal["ticket", "projekt", "objekt", "partner"]


class DokumentLinkRef(BaseModel):
    target_type: DokumentTargetLiteral
    target_id: UUID


class DokumentRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    name: str
    filename: str
    mime_type: str
    size_bytes: int
    kategorie: str | None
    beschreibung: str | None
    hochgeladen_von: UserRef | None = None
    links: list[DokumentLinkRef] = Field(default_factory=list)


class DokumentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    kategorie: str | None = Field(default=None, max_length=64)
    beschreibung: str | None = None
    links: list[DokumentLinkRef] | None = None
