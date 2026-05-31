from pydantic import BaseModel


class StatusWertMini(BaseModel):
    key: str
    label: str
    farbe: str | None = None


class StatusWorkflowRead(BaseModel):
    """Status-Werte (für Labels/Farben) + erlaubte Übergänge je Quell-Status."""

    status: list[StatusWertMini]
    uebergaenge: dict[str, list[str]]


class StatusWorkflowUpdate(BaseModel):
    uebergaenge: dict[str, list[str]]
