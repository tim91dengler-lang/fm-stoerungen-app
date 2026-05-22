from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.common import TimestampedRead


class GespeicherteAnsichtBase(BaseModel):
    view_key: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    config: dict[str, Any]
    ist_default: bool = False


class GespeicherteAnsichtCreate(GespeicherteAnsichtBase):
    pass


class GespeicherteAnsichtUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    config: dict[str, Any] | None = None
    ist_default: bool | None = None


class GespeicherteAnsichtRead(TimestampedRead, GespeicherteAnsichtBase):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
