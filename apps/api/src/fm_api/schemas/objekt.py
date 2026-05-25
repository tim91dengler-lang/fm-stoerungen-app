from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from fm_api.schemas.adresse import AdresseRead
from fm_api.schemas.common import TimestampedRead
from fm_api.schemas.partner import PartnerTypLiteral


class ObjektPartnerLink(BaseModel):
    """Verknüpfung Partner ↔ Objekt mit Rolle."""

    partner_id: UUID
    rolle: PartnerTypLiteral


class ObjektPartnerLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    partner_id: UUID
    rolle: PartnerTypLiteral
    partner_name: str


class ObjektBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    adresse_id: UUID | None = None
    notiz: str | None = None


class ObjektCreate(ObjektBase):
    partner_links: list[ObjektPartnerLink] = Field(default_factory=list)


class ObjektUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    adresse_id: UUID | None = None
    notiz: str | None = None
    partner_links: list[ObjektPartnerLink] | None = None


class ObjektRead(TimestampedRead, ObjektBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    gesperrt: bool = False
    adresse: AdresseRead | None = None
    partner_links: list[ObjektPartnerLinkRead] = Field(default_factory=list)
