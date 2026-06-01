from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from fm_api.schemas.common import TimestampedRead


class TickettypBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    block_key: str
    label: str
    region: str
    reihenfolge: int
    ist_system_block: bool
    collapsible_default_open: bool


class TickettypFeldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    feld_key: str
    label: str
    ist_system_feld: bool
    sichtbar: bool
    pflicht: bool
    nur_admin_sichtbar: bool
    reihenfolge: int
    # Stufe C: Zuordnung zu einer Block-Gruppierung (None ⇒ Auffang-Block "weitere").
    block_id: UUID | None = None


class TickettypFeldUpdate(BaseModel):
    """Bulk-Update der Felder einer Vorlage. Felder werden anhand `feld_key`
    identifiziert; unbekannte Keys werden vom Backend ignoriert (keine neuen
    System-Felder per API)."""

    feld_key: str = Field(min_length=1, max_length=64)
    sichtbar: bool | None = None
    pflicht: bool | None = None
    nur_admin_sichtbar: bool | None = None
    reihenfolge: int | None = None
    label: str | None = Field(default=None, min_length=1, max_length=120)


class BlockLayoutWrite(BaseModel):
    """Ein Block im Layout-Payload (Stufe C). Identifikation über ``block_key``
    (stabil, pro Vorlage eindeutig). Neue Blöcke bringen einen neuen Key mit —
    der Server löst Keys NUR innerhalb dieser Vorlage auf (kein Cross-Vorlage-/
    Cross-Mandant-Reparenting möglich)."""

    block_key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    region: Literal["links", "rechts"]
    reihenfolge: int = 0
    collapsible_default_open: bool = True


class FeldLayoutWrite(BaseModel):
    """Ein Feld im Layout-Payload: Zuordnung zu einem Block (per ``block_key``),
    block-lokale Reihenfolge, Sichtbarkeit/Pflicht und optionale Umbenennung."""

    feld_key: str = Field(min_length=1, max_length=64)
    block_key: str = Field(min_length=1, max_length=64)
    reihenfolge: int = 0
    sichtbar: bool = True
    pflicht: bool = False
    label: str | None = Field(default=None, min_length=1, max_length=120)


class LayoutWrite(BaseModel):
    """Vollständiges Layout einer Vorlage (Designer-Save, transaktional)."""

    bloecke: list[BlockLayoutWrite]
    felder: list[FeldLayoutWrite]

    @model_validator(mode="after")
    def _no_duplicate_keys(self) -> "LayoutWrite":
        # Doppelte Keys würden serverseitig still zusammengeführt (ein ORM-Objekt
        # je Key) und so Layout-Intention verlieren — hart ablehnen (422).
        block_keys = [b.block_key for b in self.bloecke]
        if len(block_keys) != len(set(block_keys)):
            raise ValueError("Doppelte block_key im Layout-Payload.")
        feld_keys = [f.feld_key for f in self.felder]
        if len(feld_keys) != len(set(feld_keys)):
            raise ValueError("Doppelte feld_key im Layout-Payload.")
        return self


class TickettypBase(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    beschreibung: str | None = None
    icon: str | None = Field(default=None, max_length=64)
    farbe: str | None = Field(default=None, max_length=32)
    pflichtfelder: list[Any] = Field(default_factory=list)
    default_reminder_tage: int = 0
    reihenfolge: int = 0
    aktiv: bool = True


class TickettypCreate(TickettypBase):
    pass


class TickettypUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    beschreibung: str | None = None
    icon: str | None = Field(default=None, max_length=64)
    farbe: str | None = Field(default=None, max_length=32)
    pflichtfelder: list[Any] | None = None
    default_reminder_tage: int | None = None
    reihenfolge: int | None = None
    aktiv: bool | None = None


class TickettypRead(TimestampedRead, TickettypBase):
    model_config = ConfigDict(from_attributes=True)

    mandant_id: UUID
    ist_system: bool
    ist_alles_vorlage: bool = False
    felder: list[TickettypFeldRead] = Field(default_factory=list)
    bloecke: list[TickettypBlockRead] = Field(default_factory=list)


class TickettypMini(BaseModel):
    id: UUID
    key: str
    label: str
    icon: str | None = None
    farbe: str | None = None
