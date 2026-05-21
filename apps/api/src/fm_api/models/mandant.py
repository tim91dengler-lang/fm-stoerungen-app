from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fm_api.db.base import Base
from fm_api.models.mixins import TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from fm_api.models.role import Role
    from fm_api.models.ticket import Ticket
    from fm_api.models.user import User


class Mandant(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "mandanten"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    users: Mapped[list["User"]] = relationship(back_populates="mandant", lazy="raise")
    roles: Mapped[list["Role"]] = relationship(back_populates="mandant", lazy="raise")
    tickets: Mapped[list["Ticket"]] = relationship(back_populates="mandant", lazy="raise")
