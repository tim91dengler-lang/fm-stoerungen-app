from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.ticket import UserRef

NotificationTypLiteral = Literal["mention", "zuweisung", "status", "chat", "wartung_faellig"]


class NotificationRead(TimestampedRead):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    ticket_id: UUID | None
    typ: NotificationTypLiteral
    text: str
    ref_message_id: UUID | None
    ausloeser: UserRef | None = None
    gelesen: bool


class NotificationMarkRead(BaseModel):
    ids: list[UUID]
