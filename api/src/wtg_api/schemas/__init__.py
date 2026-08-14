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


# --- Public country data (SSR pages) ---
#
# These mirror `CountryData` in `web/src/lib/types.ts` field for field, in the
# web's camelCase rather than the API's usual snake_case: the SSR pages hand
# the parsed JSON straight to their components, and a rename here would mean a
# reshaping layer on the other side for no gain.
#
# Every optional field is optional because the pipeline may genuinely not know
# it — Natural Earth carries no capital for a handful of countries, a polygon
# may have no wind series, and a country no government has published an
# advisory for has no advisory. The web renders the absence rather than a
# placeholder. The four *premium* variables are absent by design and have no
# fields here at all: country pages are statically generated, so anything in
# this schema is in the public HTML.


class ClimateSeries(BaseModel):
    months: list[str]
    t: list[float]
    tMin: list[float]  # noqa: N815 - mirrors the web's field name
    tMax: list[float]  # noqa: N815
    r: list[float]  # mm / month, for display
    rDay: list[float]  # noqa: N815 - mm / day, what the scoring rule consumes
    s: list[float]
    w: list[float] | None = None


class BestMonth(BaseModel):
    month: str
    score: int
    note: str


class RegionRow(BaseModel):
    name: str
    slug: str
    # The admin-1 polygon id (`adm1_code`), which is also the feature `id` the
    # tiles carry — it is how a click on the map addresses one exact region.
    # Optional because the response model filters the payload: a bundle
    # published before the field existed must keep serving, not 500 every
    # region page until the pipeline is re-run.
    code: str | None = None
    score: int
    tl: list[float]
    rl: list[float]
    sl: list[float]


class AdvisoryCombined(BaseModel):
    level: int = Field(ge=1, le=4)
    label: str


class AdvisorySource(BaseModel):
    gov: str
    level: int = Field(ge=1, le=4)
    label: str
    date: str
    url: str


class AdvisorySummary(BaseModel):
    combined: AdvisoryCombined
    lastUpdated: str  # noqa: N815
    sources: list[AdvisorySource]
    # WS-4's `regional-L<n>` sentinel: somewhere in this country is worse than
    # the national level, but no scraper could say where. Deliberately absent
    # from the tiles — it names no polygon — so the country page is the only
    # surface that can report it.
    regionalMax: int | None = Field(default=None, ge=1, le=4)  # noqa: N815
    regionalMaxLabel: str | None = None  # noqa: N815


class RelatedCountry(BaseModel):
    slug: str
    name: str
    sub: str
    score: int


class CountryRef(BaseModel):
    slug: str
    name: str
    iso2: str
    region: str


class CountryData(BaseModel):
    slug: str
    name: str
    iso2: str
    region: str
    summary: str
    climate: ClimateSeries
    bestMonths: list[BestMonth]  # noqa: N815
    regions: list[RegionRow]
    related: list[RelatedCountry]
    monthNotes: dict[str, str]  # noqa: N815
    capital: str | None = None
    tz: str | None = None
    area: str | None = None
    advisories: AdvisorySummary | None = None
    # "admin1-mean" marks a country the map suppresses: it has no national
    # polygon, so these figures are the mean of its own regions.
    climateBasis: Literal["country", "admin1-mean"] = "country"  # noqa: N815


class CountryRegion(BaseModel):
    country: CountryData
    region: RegionRow


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
