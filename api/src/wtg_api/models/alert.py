from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wtg_api.db import Base, TimestampMixin
from wtg_api.models.trip import JsonB

if TYPE_CHECKING:
    from wtg_api.models.user import User


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    country_iso2: Mapped[str | None] = mapped_column(String(2), nullable=True)
    region_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1..12
    preferences: Mapped[dict[str, Any]] = mapped_column(JsonB, nullable=False, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_matched: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: 0–100 as of the last completed run. What the email prints as "previous
    #: run"; NULL until the alert has been scored once.
    last_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: 0–100 as of the last email we sent about this alert (or the baseline run,
    #: which sends nothing). The `alert_score_delta_points` guard measures
    #: against *this*, not against last week — otherwise a slow drift would
    #: never accumulate past the threshold because each week's step is small.
    baseline_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped[User] = relationship(back_populates="alerts")
