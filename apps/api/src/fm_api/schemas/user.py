from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from fm_api.schemas.common import TimestampedRead


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)


class UserCreate(UserBase):
    password: str = Field(min_length=12, max_length=200)
    role_ids: list[UUID] = []


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None
    role_ids: list[UUID] | None = None
    password: str | None = Field(default=None, min_length=12, max_length=200)


class RoleRead(BaseModel):
    id: UUID
    name: str
    beschreibung: str | None = None

    model_config = {"from_attributes": True}


class UserRead(TimestampedRead):
    mandant_id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    roles: list[RoleRead] = []
