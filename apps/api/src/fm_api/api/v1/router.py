from fastapi import APIRouter

from fm_api.api.v1 import adressen, auswahllisten, auth, health, tickets, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(auswahllisten.router, prefix="/auswahllisten", tags=["auswahllisten"])
api_router.include_router(adressen.router, prefix="/adressen", tags=["adressen"])
