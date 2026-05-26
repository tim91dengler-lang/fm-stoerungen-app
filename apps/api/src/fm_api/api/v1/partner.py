"""Geschäftspartner-API (R6c-refactored).

Bestehende Endpoints (Liste/Create/Get/Update/Delete) bleiben pfadkompatibel,
neue Felder kommen in den Schemas dazu. Hard-DELETE liefert 409 wenn
Referenzen bestehen — Caller soll dann den Sperren-Endpoint verwenden.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.common import PaginatedResponse
from fm_api.schemas.partner import (
    PartnerAdresseCreate,
    PartnerAdresseRead,
    PartnerAdresseUpdate,
    PartnerCreate,
    PartnerHierarchieResponse,
    PartnerKontaktCreate,
    PartnerKontaktRead,
    PartnerKontaktUpdate,
    PartnerObjektLinkRead,
    PartnerProjektLinkRead,
    PartnerRead,
    PartnerSperrenResponse,
    PartnerTicketLinkRead,
    PartnerUpdate,
)
from fm_api.services import partner_service
from fm_api.services.partner_service import (
    PartnerAdresseNotFoundError,
    PartnerCircularHierarchyError,
    PartnerHasReferencesError,
    PartnerKontaktNotFoundError,
    PartnerNotFoundError,
)

router = APIRouter()


# ----- Partner --------------------------------------------------------------


@router.get(
    "",
    response_model=PaginatedResponse[PartnerRead],
    summary="Geschäftspartner-Liste",
)
async def list_partner(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    typ: list[UUID] | None = Query(default=None),
    gesperrt_filter: str = Query(default="aktiv", pattern="^(aktiv|gesperrt|alle)$"),
    parent_partner_id: UUID | None = Query(default=None),
    include_deleted: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> PaginatedResponse[PartnerRead]:
    items, total = await partner_service.list_partner(
        db,
        current.mandant_id,
        search=search,
        typ_filter=typ,
        gesperrt_filter=gesperrt_filter,
        parent_partner_id=parent_partner_id,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse[PartnerRead](
        items=[PartnerRead.model_validate(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=PartnerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Partner anlegen",
)
async def create_partner(
    payload: PartnerCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerRead:
    try:
        partner = await partner_service.create_partner(
            db, current.mandant_id, payload=payload.model_dump()
        )
    except PartnerNotFoundError as exc:  # parent_partner_id existiert nicht
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PartnerRead.model_validate(partner)


@router.get(
    "/{partner_id}",
    response_model=PartnerRead,
    summary="Partner-Detail",
)
async def get_partner(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerRead:
    try:
        partner = await partner_service.get_partner(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerRead.model_validate(partner)


@router.patch(
    "/{partner_id}",
    response_model=PartnerRead,
    summary="Partner bearbeiten",
)
async def update_partner(
    partner_id: UUID,
    payload: PartnerUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerRead:
    try:
        partner = await partner_service.update_partner(
            db, partner_id, current.mandant_id, payload.model_dump(exclude_unset=True)
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PartnerCircularHierarchyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return PartnerRead.model_validate(partner)


@router.delete(
    "/{partner_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Partner hart löschen (nur wenn keine Referenzen) — sonst sperren",
)
async def delete_partner(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await partner_service.hard_delete_partner(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PartnerHasReferencesError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": str(exc),
                "references": exc.references,
                "hint": "Partner hat noch Verknüpfungen — verwende den Sperren-Endpoint.",
            },
        ) from exc


@router.post(
    "/{partner_id}/sperren",
    response_model=PartnerSperrenResponse,
    summary="Partner + alle Filialen sperren",
)
async def sperren_partner(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerSperrenResponse:
    try:
        ids = await partner_service.sperren_partner(
            db, partner_id, current.mandant_id, gesperrt=True
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerSperrenResponse(betroffene_partner_ids=ids, anzahl=len(ids))


@router.post(
    "/{partner_id}/entsperren",
    response_model=PartnerSperrenResponse,
    summary="Partner + alle Filialen entsperren",
)
async def entsperren_partner(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerSperrenResponse:
    try:
        ids = await partner_service.sperren_partner(
            db, partner_id, current.mandant_id, gesperrt=False
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerSperrenResponse(betroffene_partner_ids=ids, anzahl=len(ids))


# ----- Kontakte (Sub-Resource) ---------------------------------------------


@router.get(
    "/{partner_id}/kontakte",
    response_model=list[PartnerKontaktRead],
    summary="Kontakte eines Partners auflisten",
)
async def list_kontakte(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[PartnerKontaktRead]:
    try:
        kontakte = await partner_service.list_kontakte(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [PartnerKontaktRead.model_validate(k) for k in kontakte]


@router.post(
    "/{partner_id}/kontakte",
    response_model=PartnerKontaktRead,
    status_code=status.HTTP_201_CREATED,
    summary="Kontakt anlegen",
)
async def create_kontakt(
    partner_id: UUID,
    payload: PartnerKontaktCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerKontaktRead:
    try:
        kontakt = await partner_service.create_kontakt(
            db, partner_id, current.mandant_id, payload=payload.model_dump()
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerKontaktRead.model_validate(kontakt)


@router.patch(
    "/kontakte/{kontakt_id}",
    response_model=PartnerKontaktRead,
    summary="Kontakt bearbeiten",
)
async def update_kontakt(
    kontakt_id: UUID,
    payload: PartnerKontaktUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerKontaktRead:
    try:
        kontakt = await partner_service.update_kontakt(
            db, kontakt_id, current.mandant_id, payload.model_dump(exclude_unset=True)
        )
    except PartnerKontaktNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerKontaktRead.model_validate(kontakt)


@router.delete(
    "/kontakte/{kontakt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Kontakt entfernen",
)
async def delete_kontakt(
    kontakt_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await partner_service.delete_kontakt(db, kontakt_id, current.mandant_id)
    except PartnerKontaktNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ----- Adressen-Junction (Sub-Resource) ------------------------------------


@router.get(
    "/{partner_id}/adressen",
    response_model=list[PartnerAdresseRead],
    summary="Adress-Verknüpfungen eines Partners",
)
async def list_partner_adressen(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[PartnerAdresseRead]:
    try:
        links = await partner_service.list_adressen(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [PartnerAdresseRead.model_validate(link) for link in links]


@router.post(
    "/{partner_id}/adressen",
    response_model=PartnerAdresseRead,
    status_code=status.HTTP_201_CREATED,
    summary="Adresse mit Partner verknüpfen",
)
async def create_partner_adresse(
    partner_id: UUID,
    payload: PartnerAdresseCreate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerAdresseRead:
    try:
        link = await partner_service.create_partner_adresse(
            db, partner_id, current.mandant_id, payload=payload.model_dump()
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerAdresseRead.model_validate(link)


@router.patch(
    "/adressen/{link_id}",
    response_model=PartnerAdresseRead,
    summary="Adress-Verknüpfung bearbeiten",
)
async def update_partner_adresse(
    link_id: UUID,
    payload: PartnerAdresseUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerAdresseRead:
    try:
        link = await partner_service.update_partner_adresse(
            db, link_id, current.mandant_id, payload.model_dump(exclude_unset=True)
        )
    except PartnerAdresseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerAdresseRead.model_validate(link)


@router.delete(
    "/adressen/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Adress-Verknüpfung lösen",
)
async def delete_partner_adresse(
    link_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> None:
    try:
        await partner_service.delete_partner_adresse(db, link_id, current.mandant_id)
    except PartnerAdresseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ----- Track 3: Hierarchie / verlinkte Listen ------------------------------


@router.get(
    "/{partner_id}/hierarchie",
    response_model=PartnerHierarchieResponse,
    summary="Filialen-Baum: Mutter + alle Töchter rekursiv",
)
async def get_partner_hierarchie(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> PartnerHierarchieResponse:
    try:
        tree = await partner_service.get_hierarchie(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return PartnerHierarchieResponse.model_validate(tree)


@router.get(
    "/{partner_id}/objekte",
    response_model=list[PartnerObjektLinkRead],
    summary="Objekte mit Bezug zum Partner",
)
async def get_partner_objekte(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[PartnerObjektLinkRead]:
    try:
        rows = await partner_service.list_objekte_fuer_partner(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [PartnerObjektLinkRead.model_validate(r) for r in rows]


@router.get(
    "/{partner_id}/projekte",
    response_model=list[PartnerProjektLinkRead],
    summary="Projekte mit transitivem Partner-Bezug (über Objekte)",
)
async def get_partner_projekte(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> list[PartnerProjektLinkRead]:
    try:
        rows = await partner_service.list_projekte_fuer_partner(db, partner_id, current.mandant_id)
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [PartnerProjektLinkRead.model_validate(r) for r in rows]


@router.get(
    "/{partner_id}/tickets",
    response_model=list[PartnerTicketLinkRead],
    summary="Tickets mit Partner-Bezug (direkter FK)",
)
async def get_partner_tickets(
    partner_id: UUID,
    db: AuditedDbSession,
    current: CurrentUserDep,
    include_erledigt: bool = Query(default=False),
) -> list[PartnerTicketLinkRead]:
    try:
        rows = await partner_service.list_tickets_fuer_partner(
            db, partner_id, current.mandant_id, include_erledigt=include_erledigt
        )
    except PartnerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [PartnerTicketLinkRead.model_validate(r) for r in rows]
