from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from fm_api.schemas.adresse import AdresseRead
from fm_api.schemas.common import TimestampedRead

PartnerTypLiteral = Literal["mieter", "eigentuemer", "auftraggeber", "nachunternehmer"]


class PartnerBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    ansprechpartner: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    telefon: str | None = Field(default=None, max_length=64)
    adresse_id: UUID | None = None
    notiz: str | None = None
    typen: list[PartnerTypLiteral] = Field(default_factory=list)


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    ansprechpartner: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    telefon: str | None = Field(default=None, max_length=64)
    adresse_id: UUID | None = None
    notiz: str | None = None
    typen: list[PartnerTypLiteral] | None = None


class PartnerRead(TimestampedRead, PartnerBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    adresse: AdresseRead | None = None
