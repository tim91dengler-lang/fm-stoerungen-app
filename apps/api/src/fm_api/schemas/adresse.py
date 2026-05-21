from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from fm_api.schemas.common import TimestampedRead


class AdresseBase(BaseModel):
    strasse: str = Field(min_length=1, max_length=200)
    hausnummer: str | None = Field(default=None, max_length=32)
    adresszusatz: str | None = Field(default=None, max_length=100)
    plz: str = Field(min_length=1, max_length=20)
    ort: str = Field(min_length=1, max_length=120)
    land: str = Field(default="DE", min_length=2, max_length=2)
    bemerkung: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geocode_source: str | None = Field(default=None, max_length=32)

    @field_validator("land", mode="before")
    @classmethod
    def _upper_land(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.upper()


class AdresseCreate(AdresseBase):
    pass


class AdresseUpdate(BaseModel):
    strasse: str | None = Field(default=None, min_length=1, max_length=200)
    hausnummer: str | None = Field(default=None, max_length=32)
    adresszusatz: str | None = Field(default=None, max_length=100)
    plz: str | None = Field(default=None, min_length=1, max_length=20)
    ort: str | None = Field(default=None, min_length=1, max_length=120)
    land: str | None = Field(default=None, min_length=2, max_length=2)
    bemerkung: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geocode_source: str | None = Field(default=None, max_length=32)


class AdresseRead(TimestampedRead, AdresseBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID


class AdresseSuggestion(BaseModel):
    """Ergebnis aus Photon-API, normalisiert auf unsere Felder."""

    strasse: str | None = None
    hausnummer: str | None = None
    plz: str | None = None
    ort: str | None = None
    land: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    label: str = ""  # Anzeige-Text für das Dropdown
