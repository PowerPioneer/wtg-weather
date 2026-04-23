from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from wtg_api.models import Plan, Role


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkResponse(BaseModel):
    sent: bool = True


class MeResponse(ORMModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None = None
    plan: Plan
    organization_id: uuid.UUID | None = None
    is_premium: bool
    is_agency: bool


# --- Trips / favourites / alerts ---


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    country_iso2: str | None = Field(default=None, min_length=2, max_length=2)
    region_code: str | None = Field(default=None, max_length=20)
    month: int | None = Field(default=None, ge=1, le=12)
    preferences: dict[str, Any] = Field(default_factory=dict)
    client_id: uuid.UUID | None = None


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    country_iso2: str | None = Field(default=None, min_length=2, max_length=2)
    region_code: str | None = Field(default=None, max_length=20)
    month: int | None = Field(default=None, ge=1, le=12)
    preferences: dict[str, Any] | None = None
    client_id: uuid.UUID | None = None


class TripRead(ORMModel):
    id: uuid.UUID
    title: str
    country_iso2: str | None
    region_code: str | None
    month: int | None
    preferences: dict[str, Any]
    client_id: uuid.UUID | None


class FavouriteCreate(BaseModel):
    country_iso2: str = Field(min_length=2, max_length=2)
    region_code: str | None = Field(default=None, max_length=20)


class FavouriteRead(ORMModel):
    id: uuid.UUID
    country_iso2: str
    region_code: str | None


class AlertCreate(BaseModel):
    country_iso2: str | None = Field(default=None, min_length=2, max_length=2)
    region_code: str | None = Field(default=None, max_length=20)
    month: int | None = Field(default=None, ge=1, le=12)
    preferences: dict[str, Any] = Field(default_factory=dict)


class AlertRead(ORMModel):
    id: uuid.UUID
    country_iso2: str | None
    region_code: str | None
    month: int | None
    preferences: dict[str, Any]
    active: bool


# --- Orgs / memberships / clients ---


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class OrganizationRead(ORMModel):
    id: uuid.UUID
    name: str
    plan: Plan
    seat_cap: int


class MembershipInvite(BaseModel):
    email: EmailStr
    role: Literal["admin", "agent", "member"] = "agent"


class MembershipRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    organization_id: uuid.UUID
    role: Role


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    notes: str | None = None


class ClientRead(ORMModel):
    id: uuid.UUID
    name: str
    email: str | None
    notes: str | None


# --- Tiles ---


class SignedTileURLResponse(BaseModel):
    url: str
    expires_at: int
    tier: Literal["free", "premium"]


# --- Onboarding ---


OnboardingKind = Literal["consumer", "agency"]


class OnboardingState(BaseModel):
    kind: OnboardingKind | None = None
    step: int = Field(default=0, ge=0, le=10)
    completed: bool = False
    data: dict[str, Any] = Field(default_factory=dict)


class OnboardingPatch(BaseModel):
    kind: OnboardingKind | None = None
    step: int | None = Field(default=None, ge=0, le=10)
    completed: bool | None = None
    data: dict[str, Any] | None = None


# --- Paddle ---


class PaddleCheckoutRequest(BaseModel):
    plan: Literal[
        "consumer_premium",
        "agency_starter",
        "agency_pro",
    ]
    organization_id: uuid.UUID | None = None


class PaddleCheckoutResponse(BaseModel):
    checkout_url: str
    sandbox: bool
    plan: str
