from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wtg_api.db import Base, TimestampMixin

if TYPE_CHECKING:
    from wtg_api.models.client import Client
    from wtg_api.models.membership import Membership


class Plan(str, enum.Enum):
    free = "free"
    consumer_premium = "consumer_premium"
    agency_starter = "agency_starter"
    agency_pro = "agency_pro"
    agency_enterprise = "agency_enterprise"


PREMIUM_PLANS = frozenset(
    {Plan.consumer_premium, Plan.agency_starter, Plan.agency_pro, Plan.agency_enterprise}
)
AGENCY_PLANS = frozenset({Plan.agency_starter, Plan.agency_pro, Plan.agency_enterprise})

DEFAULT_SEAT_CAP: dict[Plan, int] = {
    Plan.free: 1,
    Plan.consumer_premium: 1,
    Plan.agency_starter: 3,
    Plan.agency_pro: 10,
    Plan.agency_enterprise: 9999,
}


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    plan: Mapped[Plan] = mapped_column(
        Enum(Plan, name="plan"), nullable=False, default=Plan.free
    )
    seat_cap: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    paddle_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paddle_subscription_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )

    memberships: Mapped[list[Membership]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    clients: Mapped[list[Client]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
