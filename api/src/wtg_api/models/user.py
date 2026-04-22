from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wtg_api.db import Base, TimestampMixin

if TYPE_CHECKING:
    from wtg_api.models.alert import Alert
    from wtg_api.models.favourite import Favourite
    from wtg_api.models.membership import Membership
    from wtg_api.models.trip import Trip


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )

    memberships: Mapped[list[Membership]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    trips: Mapped[list[Trip]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    favourites: Mapped[list[Favourite]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    alerts: Mapped[list[Alert]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
