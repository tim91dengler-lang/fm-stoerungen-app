from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.ticket import UserRef


class TicketPhotoRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    ticket_id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    beschreibung: str | None
    annotations: list[dict[str, Any]]
    uploaded_by: UserRef | None = None


class TicketPhotoUpdate(BaseModel):
    beschreibung: str | None = None
    annotations: list[dict[str, Any]] | None = Field(default=None)
