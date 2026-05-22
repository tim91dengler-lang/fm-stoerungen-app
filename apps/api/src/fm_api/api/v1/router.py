from fastapi import APIRouter

from fm_api.api.v1 import (
    adressen,
    ansichten,
    auswahllisten,
    auth,
    health,
    objekte,
    partner,
    ticket_messages,
    ticket_photos,
    tickets,
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
api_router.include_router(partner.router, prefix="/partner", tags=["partner"])
api_router.include_router(ansichten.router, prefix="/ansichten", tags=["ansichten"])
