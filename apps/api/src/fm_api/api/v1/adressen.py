from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.adresse import (
    AdresseCreate,
    AdresseRead,
    AdresseSuggestion,
    AdresseUpdate,
)
from fm_api.schemas.common import PaginatedResponse
from fm_api.services import adresse_service, photon_service
from fm_api.services.adresse_service import AdresseNotFoundError

router = APIRouter()


@router.get(
    "/suggest",
    response_model=list[AdresseSuggestion],
    summary="Adress-Vorschläge via Photon (Komoot/OSM, EU-gehostet)",
)
async def suggest_adresse(
    current: CurrentUserDep,
    q: str = Query(min_length=2, max_length=200),
    country: str | None = Query(default="de", min_length=2, max_length=2),
    limit: int = Query(default=5, ge=1, le=10),
) -> list[AdresseSuggestion]:
    # Auth-Gate: nur eingeloggte User dürfen Photon zubinden, sonst könnten wir
    # zum Open-Proxy für anonyme Geocoding-Anfragen werden.
    _ = current
    return await photon_service.suggest(q, country=country, limit=limit)


@router.get(
    "",
    response_model=PaginatedResponse[AdresseRead],
    summary="Adressen-Liste",
)
async def list_adressen(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[AdresseRead]:
    items, total = await adresse_service.list_adressen(
        db, current.mandant_id, search=search, limit=limit, offset=offset
    )
    return PaginatedResponse[AdresseRead](
        items=[AdresseRead.model_validate(a) for a in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=AdresseRead,
    status_code=status.HTTP_201_CREATED,
    summary="Adresse anlegen",
)
async def create_adresse(
    payload: AdresseCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AdresseRead:
    adresse = await adresse_service.create_adresse(
        db, current.mandant_id, payload=payload.model_dump()
    )
    return AdresseRead.model_validate(adresse)


@router.get(
    "/{adresse_id}",
    response_model=AdresseRead,
    summary="Adress-Detail",
)
async def get_adresse(
    adresse_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AdresseRead:
    try:
        adresse = await adresse_service.get_adresse(db, adresse_id, current.mandant_id)
    except AdresseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AdresseRead.model_validate(adresse)


@router.patch(
    "/{adresse_id}",
    response_model=AdresseRead,
    summary="Adresse bearbeiten",
)
async def update_adresse(
    adresse_id: UUID,
    payload: AdresseUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> AdresseRead:
    try:
        adresse = await adresse_service.update_adresse(
            db,
            adresse_id,
            current.mandant_id,
            payload.model_dump(exclude_unset=True),
        )
    except AdresseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AdresseRead.model_validate(adresse)


@router.delete(
    "/{adresse_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Adresse löschen",
)
async def delete_adresse(
    adresse_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await adresse_service.delete_adresse(db, adresse_id, current.mandant_id)
    except AdresseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
