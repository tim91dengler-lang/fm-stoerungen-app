from fastapi import APIRouter

from fm_api.api.v1 import (
    adressen,
    anlagen,
    ansichten,
    auswahllisten,
    auth,
    dokumente,
    fehlercodes,
    health,
    notifications,
    objekte,
    objektstruktur,
    partner,
    projekte,
    ticket_messages,
    ticket_photos,
    tickets,
    tickettypen,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(
    ticket_messages.router,
    prefix="/tickets/{ticket_id}/messages",
    tags=["tickets"],
)
api_router.include_router(
    ticket_photos.router,
    prefix="/tickets/{ticket_id}/photos",
    tags=["tickets"],
)
api_router.include_router(auswahllisten.router, prefix="/auswahllisten", tags=["auswahllisten"])
api_router.include_router(adressen.router, prefix="/adressen", tags=["adressen"])
api_router.include_router(objekte.router, prefix="/objekte", tags=["objekte"])
api_router.include_router(objektstruktur.router, prefix="/objektstruktur", tags=["objekte"])
api_router.include_router(partner.router, prefix="/partner", tags=["partner"])
api_router.include_router(ansichten.router, prefix="/ansichten", tags=["ansichten"])
api_router.include_router(tickettypen.router, prefix="/tickettypen", tags=["tickettypen"])
api_router.include_router(projekte.router, prefix="/projekte", tags=["projekte"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(dokumente.router, prefix="/dokumente", tags=["dokumente"])
api_router.include_router(anlagen.router, prefix="/anlagen", tags=["anlagen"])
api_router.include_router(fehlercodes.router, prefix="/fehlercodes", tags=["fehlercodes"])
