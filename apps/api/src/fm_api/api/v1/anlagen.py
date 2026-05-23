from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.anlage import (
    AnlageCreate,
    AnlageRead,
    AnlageUpdate,
    KategorieRef,
    ObjektMini,
    StockwerkMini,
)
from fm_api.services import anlage_service
from fm_api.services.anlage_service import AnlageNotFoundError

router = APIRouter()


def _serialize(a: object) -> AnlageRead:
    from fm_api.models.anlage import Anlage

    if not isinstance(a, Anlage):
        raise TypeError(f"expected Anlage, got {type(a).__name__}")
    return AnlageRead.model_validate(
        {
            "id": a.id,
            "mandant_id": a.mandant_id,
            "bezeichnung": a.bezeichnung,
            "beschreibung": a.beschreibung,
            "icon_name": a.icon_name,
            "kategorie_wert_id": a.kategorie_wert_id,
            "objekt_id": a.objekt_id,
            "stockwerk_id": a.stockwerk_id,
            "aktiv": a.aktiv,
            "reihenfolge": a.reihenfolge,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
            "kategorie": (
                KategorieRef(
                    id=a.kategorie_wert.id,
                    key=a.kategorie_wert.key,
                    label=a.kategorie_wert.label,
                    farbe=a.kategorie_wert.farbe,
                    icon_name=a.kategorie_wert.icon_name,
                )
                if a.kategorie_wert is not None
                else None
            ),
            "objekt": ObjektMini(id=a.objekt.id, name=a.objekt.name) if a.objekt else None,
            "stockwerk": (
                StockwerkMini(id=a.stockwerk.id, bezeichnung=a.stockwerk.bezeichnung)
                if a.stockwerk
                else None
            ),
        }
    )


@router.get("", response_model=list[AnlageRead])
async def list_anlagen(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    objekt_id: UUID | None = Query(default=None),
    aktiv_only: bool = Query(default=False),
) -> list[AnlageRead]:
    items = await anlage_service.list_anlagen(
        db,
        current.mandant_id,
        search=search,
        objekt_id=objekt_id,
        aktiv_only=aktiv_only,
    )
    return [_serialize(a) for a in items]


@router.get("/{anlage_id}", response_model=AnlageRead)
async def get_anlage(anlage_id: UUID, db: AuditedDbSession, current: CurrentUserDep) -> AnlageRead:
    try:
        a = await anlage_service.get_anlage(db, current.mandant_id, anlage_id)
    except AnlageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize(a)


@router.post("", response_model=AnlageRead, status_code=status.HTTP_201_CREATED)
async def create_anlage(
    payload: AnlageCreate, db: AuditedDbSession, current: CurrentUserDep
) -> AnlageRead:
    a = await anlage_service.create_anlage(db, current.mandant_id, payload=payload.model_dump())
    return _serialize(a)


@router.patch("/{anlage_id}", response_model=AnlageRead)
async def update_anlage(
    anlage_id: UUID,
    payload: AnlageUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AnlageRead:
    try:
        a = await anlage_service.update_anlage(
            db, current.mandant_id, anlage_id, payload.model_dump(exclude_unset=True)
        )
    except AnlageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize(a)


@router.delete("/{anlage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_anlage(anlage_id: UUID, db: AuditedDbSession, current: CurrentUserDep) -> None:
    try:
        await anlage_service.soft_delete_anlage(db, current.mandant_id, anlage_id)
    except AnlageNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
