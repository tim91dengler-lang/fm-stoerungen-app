from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.ticket import UserRef


class TicketMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    mentions: list[str] = Field(default_factory=list)


class TicketMessageRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    ticket_id: UUID
    text: str
    mentions: list[str]
    gelesen_von: list[str] = Field(default_factory=list)
    autor: UserRef | None = None
