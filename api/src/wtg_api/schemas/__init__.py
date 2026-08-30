from __future__ import annotations

import uuid
from datetime import datetime
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


class MeOrganization(ORMModel):
    """The org the user's entitlement came from.

    `seats_used` is the membership count, which is what the seat cap is
    enforced against — an invite that has not been accepted yet is already a
    membership, so it counts.
    """

    id: uuid.UUID
    name: str
    plan: Plan
    seat_cap: int
    seats_used: int
    created_at: datetime
    # True for the single-seat organization that carries one consumer's own
    # subscription (`Organization.personal_user_id`). It is not a workspace and
    # has no team, no clients and no seats to sell — the web switches its
    # account shell on this rather than on the plan, because an agency that has
    # created its organization but not yet paid is still an agency.
    is_personal: bool = False


class MeResponse(ORMModel):
    """The whole session contract, in one place.

    The web mirrors this field for field (`SessionUser` in
    `web/src/lib/types.ts`) and derives its two *presentation* gates from
    `plan` against the same vocabulary — which is why the vocabulary is now
    shared rather than translated. `is_premium` / `is_agency` are this side's
    own answer, from the plan ranking in `services.entitlements`, and are what
    a client that does not want to model that ranking should read. Neither is
    an access control: `/api/tiles/url` re-resolves the entitlement against
    the database before it signs anything.

    `created_at` and `role` exist so the account surface has something true to
    print. It rendered fixture strings ("Member since Mar 2026") for every
    signed-in user before, because the payload carried nothing else.
    """

    id: uuid.UUID
    email: EmailStr
    name: str | None = None
    plan: Plan
    organization_id: uuid.UUID | None = None
    is_premium: bool
    is_agency: bool
    # The user's role *in the entitling org*. Null for a user with no
    # membership at all — i.e. everyone on the free plan.
    role: Role | None = None
    created_at: datetime
    organization: MeOrganization | None = None


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
    # Present only for the owner, and null until they share. The owner needs it
    # to build (and to recognise) the link they are handing out.
    share_token: str | None = None


class TripShareRead(BaseModel):
    share_token: str


class TripPublicRead(BaseModel):
    """A shared trip, as an anonymous viewer sees it.

    Deliberately not `TripRead`: no `id`, so a share link cannot be turned into
    an owner-scoped request; no `client_id`, because which of an agency's
    clients a trip was built for is the agency's business and not the
    recipient's; no `share_token` echo.
    """

    title: str
    country_iso2: str | None
    region_code: str | None
    month: int | None
    preferences: dict[str, Any]


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


class AlertUpdate(BaseModel):
    """Partial update. `active` is the field the account page's toggle sets —
    pausing an alert has to be distinct from deleting it, or a user who wants
    quiet for a month loses the definition."""

    country_iso2: str | None = Field(default=None, min_length=2, max_length=2)
    region_code: str | None = Field(default=None, max_length=20)
    month: int | None = Field(default=None, ge=1, le=12)
    preferences: dict[str, Any] | None = None
    active: bool | None = None


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


class OrganizationDetail(OrganizationRead):
    """The org plus what the seat meter needs.

    `seats_used` is the membership count — the same number `/api/me` reports,
    unchanged. `seats_pending` is the invitations still open, and the cap is
    enforced against the *sum*: an unaccepted invite has already promised a
    seat, so counting only memberships would let a 3-seat agency invite ten
    people and end up with ten members.
    """

    seats_used: int
    seats_pending: int


class MembershipInvite(BaseModel):
    email: EmailStr
    role: Literal["admin", "agent", "member"] = "agent"


class MembershipRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    organization_id: uuid.UUID
    role: Role


class MemberRead(ORMModel):
    """A membership with the person attached.

    The team table has to print a name and an address, and `MembershipRead`
    carries neither — the web filled that gap from a fixture, which is how a
    real agency's team list showed five people who do not exist.
    """

    id: uuid.UUID
    user_id: uuid.UUID
    organization_id: uuid.UUID
    role: Role
    email: EmailStr
    name: str | None = None
    created_at: datetime


class InvitationRead(ORMModel):
    """A pending invitation, as its own organization sees it.

    Deliberately no token: the token is a bearer credential for a mailbox and
    the only place it belongs is that mailbox. An owner who needs to reach an
    invitee again revokes and re-invites, which also re-dates the expiry.
    """

    id: uuid.UUID
    organization_id: uuid.UUID
    email: EmailStr
    role: Role
    expires_at: datetime
    created_at: datetime


class InvitationPreview(BaseModel):
    """What the accept page may show *before* the invitation is spent.

    No organization id and no membership list — this is answered to an
    unauthenticated caller holding a token, so it says only what the recipient
    already knows from the email that carried it.
    """

    organization_name: str
    email: EmailStr
    role: Role
    expires_at: datetime


class InvitationAcceptRequest(BaseModel):
    token: str = Field(min_length=10)


class InvitationAccepted(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    role: Role


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    notes: str | None = None


class ClientRead(ORMModel):
    id: uuid.UUID
    name: str
    email: str | None
    notes: str | None
    # How many trips are assigned to this client, across the whole org — the
    # clients table prints it, and a per-row round trip to get it would be one
    # request per client.
    trip_count: int = 0
    created_at: datetime | None = None


class ClientTripRead(BaseModel):
    """A trip assigned to a client, listed for the client's own page.

    Not `TripRead`: it belongs to whichever agent authored it, so it carries
    that agent rather than pretending the caller owns it, and it never carries
    `share_token` — the token is the owner's to hand out.
    """

    id: uuid.UUID
    title: str
    country_iso2: str | None
    region_code: str | None
    month: int | None
    owner_name: str | None
    owner_email: EmailStr
    shared: bool
    updated_at: datetime


class ClientNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ClientNoteRead(BaseModel):
    id: uuid.UUID
    body: str
    # Null when the author has left the organization; the note survives them.
    author_name: str | None
    author_email: EmailStr | None
    created_at: datetime


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


class RegionAdvisory(BaseModel):
    """A carve-out that applies to this region rather than its whole country.

    Present only where a government named a specific subdivision *and* the
    pipeline could resolve that prose to an ISO-3166-2 code, and only when the
    level is worse than the country's — the country-wide summary already
    states that one.
    """

    level: int = Field(ge=1, le=4)
    label: str
    code: str


class ActivitySource(BaseModel):
    """Where a curated activity claim came from, and when a human last read it."""

    url: str
    checked: str


class ActivityItem(BaseModel):
    """One thing a traveller can do, with the part that does not vary by month."""

    id: str
    name: str
    kind: str
    regions: list[str] = Field(default_factory=list)
    yearRound: bool = False  # noqa: N815
    # A thing that happens on a calendar rather than standing open — a
    # festival, a migration, a bloom. It is absent from the months it does not
    # fall in rather than listed as closed in them.
    datedEvent: bool = False  # noqa: N815
    onMonths: list[int] = Field(default_factory=list)  # noqa: N815
    sources: list[ActivitySource] = Field(default_factory=list)


class ActivityMonthRow(BaseModel):
    """One activity's state in one month. `id` keys back into `items`."""

    id: str
    status: Literal["closed", "limited", "best", "open"]
    reason: str


class ActivityMonth(BaseModel):
    # Generated by the pipeline, and driven entirely by counts taken from
    # `rows` — so the sentence cannot contradict the list it introduces.
    lede: str
    rows: list[ActivityMonthRow]


class ActivityBlock(BaseModel):
    """The curated "what's actually open" block for one country.

    Hand-authored data, unlike everything else in this payload, which is
    derived from ERA5 or scraped from a government. Each item carries its
    sources because no climatology can tell you that the classic Inca Trail
    closes every February while Machu Picchu stays open all year.
    """

    reviewed: str
    lede: str
    items: list[ActivityItem]
    # Keyed by the same three-letter month labels as `monthNotes`.
    months: dict[str, ActivityMonth]


class RegionRow(BaseModel):
    name: str
    slug: str
    # Ids of the curated activities that name *this* subdivision, resolved by
    # the pipeline against ISO-3166-2. Optional for the same reason `code` is:
    # the response model filters the payload, so a bundle published before the
    # field existed must keep serving. Most regions have none, and the web
    # omits the section rather than rendering it empty.
    activities: list[str] | None = None
    # The admin-1 polygon id (`adm1_code`), which is also the feature `id` the
    # tiles carry — it is how a click on the map addresses one exact region.
    # Optional because the response model filters the payload: a bundle
    # published before the field existed must keep serving, not 500 every
    # region page until the pipeline is re-run.
    code: str | None = None
    # Same reason `code` is optional: the response model filters the payload,
    # so a bundle published before this field existed must keep serving.
    advisory: RegionAdvisory | None = None
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
    # When this government last *moved*. A stable advisory keeps this date for
    # years, which is why it cannot answer "is this data fresh".
    date: str
    url: str
    # When this government was last *read*. The country page downgrades the
    # combined badge to neutral when every source's is more than 14 days old.
    #
    # Optional because the response model filters the payload: a bundle
    # published before `wtg publish api-data` emitted this field must keep
    # serving, and the web treats its absence as "cannot judge" rather than
    # "stale". Declaring it here is the whole reason it reaches the client at
    # all — an undeclared field is dropped silently, however correct the
    # pipeline's output is.
    checked: str | None = None


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
    # Absent for most countries: activity coverage is tiered by how travelled a
    # country is, and an uncurated one renders no section at all. Optional also
    # because this model *filters* the payload — an undeclared key is dropped
    # silently however correct the pipeline's output is, which is the whole
    # reason this field has to be named here.
    activities: ActivityBlock | None = None
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
    """A Paddle transaction the caller may open a checkout against.

    `transaction_id` is the one the browser uses —
    `Paddle.Checkout.open({transactionId})`. `checkout_url` is the same
    transaction's hosted link (our default payment link + `?_ptxn=`), returned
    for the server-side `/upgrade` redirect. Both address one transaction that
    was created *after* this API checked the caller's session and membership,
    which is what keeps `custom_data` trustworthy at webhook time.
    """

    transaction_id: str
    checkout_url: str | None
    sandbox: bool
    plan: str


class BillingSummaryResponse(BaseModel):
    """What `/account` → Billing prints. No renewal date, no payment method.

    Both live at Paddle and reaching them means a portal session, so this model
    deliberately has nowhere to put a stale copy of either.
    """

    plan: str
    has_subscription: bool
    portal_available: bool
    sandbox: bool
    organization_id: uuid.UUID | None = None
    seat_cap: int | None = None


class BillingPortalResponse(BaseModel):
    portal_url: str
    sandbox: bool
