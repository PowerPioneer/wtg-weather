from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wtg_api.db import Base, TimestampMixin

if TYPE_CHECKING:
    from wtg_api.models.user import User


class Favourite(Base, TimestampMixin):
    __tablename__ = "favourites"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "country_iso2",
            "region_code",
            name="uq_favourite_user_country_region",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_iso2: Mapped[str] = mapped_column(String(2), nullable=False)
    region_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    user: Mapped[User] = relationship(back_populates="favourites")
