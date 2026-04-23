from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
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

    onboarding_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)
    onboarding_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    onboarding_data: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict
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
