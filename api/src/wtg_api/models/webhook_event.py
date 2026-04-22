from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from wtg_api.db import Base, TimestampMixin


class PaddleWebhookEvent(Base, TimestampMixin):
    """Idempotency ledger: we record each Paddle event_id once so replays no-op."""

    __tablename__ = "paddle_webhook_events"

    event_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
