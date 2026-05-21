from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from fm_api.db.base import Base


class SystemAudit(Base):
    """Append-only audit log written by Postgres triggers — see pattern audit-trigger-postgres."""

    __tablename__ = "system_audit"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mandant_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("mandanten.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    aktor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    aktor_rolle_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    tabelle: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    datensatz_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    aktion: Mapped[str] = mapped_column(String(16), nullable=False)
    vorher: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    nachher: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    zeit: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
