from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from fm_api.core.deps import AuditedDbSession, CurrentUserDep
from fm_api.schemas.anlage import AnlageMini, KategorieRef
from fm_api.schemas.fehlercode import (
    FehlercodeCreate,
    FehlercodeRead,
    FehlercodeUpdate,
    PrioRef,
    TickettypMiniRef,
)
from fm_api.services import fehlercode_service
from fm_api.services.fehlercode_service import FehlercodeNotFoundError

router = APIRouter()


def _serialize(f: object, nutzung: int) -> FehlercodeRead:
    from fm_api.models.fehlercode import Fehlercode

    if not isinstance(f, Fehlercode):
        raise TypeError(f"expected Fehlercode, got {type(f).__name__}")
    return FehlercodeRead.model_validate(
        {
            "id": f.id,
            "mandant_id": f.mandant_id,
            "code": f.code,
            "titel": f.titel,
            "beschreibung": f.beschreibung,
            "loesung": f.loesung,
            "kategorie_wert_id": f.kategorie_wert_id,
            "prio_default_wert_id": f.prio_default_wert_id,
            "tickettyp_default_id": f.tickettyp_default_id,
            "anlage_id": f.anlage_id,
            "quelle": f.quelle,
            "aktiv": f.aktiv,
            "created_at": f.created_at,
            "updated_at": f.updated_at,
            "kategorie": (
                KategorieRef(
                    id=f.kategorie_wert.id,
                    key=f.kategorie_wert.key,
                    label=f.kategorie_wert.label,
                    farbe=f.kategorie_wert.farbe,
                    icon_name=f.kategorie_wert.icon_name,
                )
                if f.kategorie_wert is not None
                else None
            ),
            "prio_default": (
                PrioRef(
                    id=f.prio_default_wert.id,
                    key=f.prio_default_wert.key,
                    label=f.prio_default_wert.label,
                    farbe=f.prio_default_wert.farbe,
                )
                if f.prio_default_wert is not None
                else None
            ),
            "tickettyp_default": (
                TickettypMiniRef(
                    id=f.tickettyp_default.id,
                    key=f.tickettyp_default.key,
                    label=f.tickettyp_default.label,
                )
                if f.tickettyp_default is not None
                else None
            ),
            "anlage": (
                AnlageMini(
                    id=f.anlage.id,
                    bezeichnung=f.anlage.bezeichnung,
                    icon_name=f.anlage.icon_name,
                )
                if f.anlage is not None
                else None
            ),
            "nutzung_count": nutzung,
        }
    )


@router.get("", response_model=list[FehlercodeRead])
async def list_fehlercodes(
    db: AuditedDbSession,
    current: CurrentUserDep,
    search: str | None = Query(default=None, max_length=200),
    anlage_id: UUID | None = Query(default=None),
    aktiv_only: bool = Query(default=False),
) -> list[FehlercodeRead]:
    items = await fehlercode_service.list_fehlercodes(
        db,
        current.mandant_id,
        search=search,
        anlage_id=anlage_id,
        aktiv_only=aktiv_only,
    )
    return [_serialize(f, c) for f, c in items]


@router.get("/{fehlercode_id}", response_model=FehlercodeRead)
async def get_fehlercode(
    fehlercode_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> FehlercodeRead:
    try:
        f, c = await fehlercode_service.get_fehlercode(db, current.mandant_id, fehlercode_id)
    except FehlercodeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize(f, c)


@router.post("", response_model=FehlercodeRead, status_code=status.HTTP_201_CREATED)
async def create_fehlercode(
    payload: FehlercodeCreate, db: AuditedDbSession, current: CurrentUserDep
) -> FehlercodeRead:
    f = await fehlercode_service.create_fehlercode(
        db, current.mandant_id, payload=payload.model_dump()
    )
    return _serialize(f, 0)


@router.patch("/{fehlercode_id}", response_model=FehlercodeRead)
async def update_fehlercode(
    fehlercode_id: UUID,
    payload: FehlercodeUpdate,
    db: AuditedDbSession,
    current: CurrentUserDep,
) -> FehlercodeRead:
    try:
        f = await fehlercode_service.update_fehlercode(
            db, current.mandant_id, fehlercode_id, payload.model_dump(exclude_unset=True)
        )
        _, c = await fehlercode_service.get_fehlercode(db, current.mandant_id, fehlercode_id)
    except FehlercodeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _serialize(f, c)


@router.delete("/{fehlercode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fehlercode(
    fehlercode_id: UUID, db: AuditedDbSession, current: CurrentUserDep
) -> None:
    try:
        await fehlercode_service.soft_delete_fehlercode(db, current.mandant_id, fehlercode_id)
    except FehlercodeNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return None
