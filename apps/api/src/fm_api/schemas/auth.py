from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from fm_api.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserInToken(ORMModel):
    id: UUID
    email: EmailStr
    full_name: str
    mandant_id: UUID
    roles: list[str] = []


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInToken


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
