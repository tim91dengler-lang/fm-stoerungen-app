"""Dev seed — creates a default tenant + admin user + sample roles.

Idempotent: re-running is safe; existing rows are kept.

Usage (inside the api container):
    python -m fm_api.scripts.seed_dev
"""

import asyncio
import os
import sys

from sqlalchemy import select

from fm_api.core.security import hash_password
from fm_api.db.session import SessionLocal
from fm_api.models import Mandant, Role, User

DEFAULT_TENANT_SLUG = "fm-staging-default"
DEFAULT_ADMIN_EMAIL = os.environ.get("DEV_ADMIN_EMAIL", "admin@fm-staging.local")
DEFAULT_ADMIN_PASSWORD = os.environ.get("DEV_ADMIN_PASSWORD", "admin-dev-pass-12")


async def main() -> int:
    async with SessionLocal() as db:
        tenant = (
            await db.execute(select(Mandant).where(Mandant.slug == DEFAULT_TENANT_SLUG))
        ).scalar_one_or_none()
        if tenant is None:
            tenant = Mandant(name="FM-Staging Default", slug=DEFAULT_TENANT_SLUG)
            db.add(tenant)
            await db.flush()
            print(f"[seed] created tenant '{tenant.slug}'")

        roles_to_have = ["admin", "techniker", "leitstand"]
        existing_roles = {
            r.name: r
            for r in (await db.execute(select(Role).where(Role.mandant_id == tenant.id)))
            .scalars()
            .all()
        }
        for role_name in roles_to_have:
            if role_name not in existing_roles:
                r = Role(mandant_id=tenant.id, name=role_name)
                db.add(r)
                await db.flush()
                existing_roles[role_name] = r
                print(f"[seed] created role '{role_name}'")

        admin = (
            await db.execute(
                select(User).where(
                    User.mandant_id == tenant.id,
                    User.email == DEFAULT_ADMIN_EMAIL,
                )
            )
        ).scalar_one_or_none()
        if admin is None:
            admin = User(
                mandant_id=tenant.id,
                email=DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
                full_name="Dev Admin",
                is_active=True,
                roles=[existing_roles["admin"]],
            )
            db.add(admin)
            await db.flush()
            print(f"[seed] created admin '{DEFAULT_ADMIN_EMAIL}'")

        await db.commit()
        print("[seed] done.")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
