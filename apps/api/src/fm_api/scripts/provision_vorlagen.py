"""Provision per-tenant base data on every deploy (idempotent).

Runs ``ensure_system_auswahllisten`` + ``ensure_default_vorlagen`` for ALL
existing tenants — unlike ``seed_dev`` (which targets a single dev tenant and
also creates a dev admin + roles). Safe to run on every deploy: only missing
rows are added, existing rows are kept.

This is the hook that keeps the Stufe-C vorlagen complete on staging without
manual SSH: blocks + full field catalog + the self-growing Alles-Vorlage are
reconciled here, so a fresh deploy (or a newly added catalog field) lands on
staging automatically. See also the ``tenant-provisioning-base-data`` rule:
per-tenant base data must be ensured for every tenant, not only seeded once.

Usage (inside the api container):
    python -m fm_api.scripts.provision_vorlagen
"""

import asyncio
import sys

from sqlalchemy import select

from fm_api.db.session import SessionLocal
from fm_api.models import Mandant
from fm_api.services.auswahlliste_service import ensure_system_auswahllisten
from fm_api.services.tickettyp_service import ensure_default_vorlagen


async def main() -> int:
    failures = 0
    async with SessionLocal() as db:
        tenants = (await db.execute(select(Mandant))).scalars().all()
        if not tenants:
            print("[provision] no tenants found — nothing to do.")
            return 0
        # Pro Mandant committen + isoliert fangen: ein kaputter Mandant darf den
        # Provision-Lauf für die übrigen NICHT killen (Session-Vergiftung). Bei
        # mind. einem Fehler Exit 1 → der Deploy-Schritt meldet es sichtbar.
        for tenant in tenants:
            try:
                await ensure_system_auswahllisten(db, tenant.id)
                await ensure_default_vorlagen(db, tenant.id)
                await db.commit()
                print(f"[provision] ensured base data for tenant '{tenant.slug}'")
            except Exception as exc:
                await db.rollback()
                failures += 1
                print(f"[provision] FAILED for tenant '{tenant.slug}': {exc!r}")
        print(f"[provision] done — {len(tenants)} tenant(s), {failures} failed.")
        return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
