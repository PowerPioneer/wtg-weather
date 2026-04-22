from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from wtg_api.db import Base, TimestampMixin

if TYPE_CHECKING:
    from wtg_api.models.client import Client
    from wtg_api.models.user import User


JsonB = JSON().with_variant(JSONB(), "postgresql")


class Trip(Base, TimestampMixin):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    country_iso2: Mapped[str | None] = mapped_column(String(2), nullable=True)
    region_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..12
    preferences: Mapped[dict[str, Any]] = mapped_column(JsonB, nullable=False, default=dict)

    owner: Mapped[User] = relationship(back_populates="trips")
    client: Mapped[Client | None] = relationship(back_populates="trips")
