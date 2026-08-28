/**
 * Shared types. These mirror the shape of the API responses (FastAPI side)
 * and the mock fixtures in `mock-data.ts`. Units are documented per field so
 * no caller has to guess — all temperatures °C, rainfall mm/month, sunshine
 * hr/day, wind km/h, snow cm, humidity %.
 *
 * Keep this file free of runtime code; it's imported by both RSC and client.
 */

import type { MonthSlug } from "./months";

export type AdvisoryLevel = 1 | 2 | 3 | 4;

export type AdvisorySource = {
  gov: string;
  level: AdvisoryLevel;
  label: string;
  /**
   * When this government last *changed* its advisory. A stable position keeps
   * this date for years, so it says nothing about whether the data is fresh.
   */
  date: string;
  url: string;
  /**
   * When this government was last *read* — `checked` in the published bundle,
   * declared on the API's `AdvisorySource` so it survives the response model.
   *
   * Optional because a bundle published before the pipeline emitted it has
   * none, and the absence means "cannot judge freshness", never "stale".
   */
  checked?: string;
};

export type AdvisorySummary = {
  combined: { level: AdvisoryLevel; label: string; color?: string };
  lastUpdated: string;
  sources: AdvisorySource[];
  /**
   * Somewhere in this country carries a higher advisory than the national
   * level, but no scraper could resolve *where*. Deliberately absent from the
   * tiles — it names no polygon and would paint the whole country at the
   * carve-out's level — so the country page is the only surface that can
   * report it. See `pipeline/processing/advisories.py` § regional carve-outs.
   */
  regionalMax?: AdvisoryLevel;
  regionalMaxLabel?: string;
};

/** 12-length array, indexed Jan=0 ... Dec=11. */
export type Monthly = readonly [
  number, number, number, number, number, number,
  number, number, number, number, number, number,
];

/**
 * The free-tier climatology, as the API publishes it.
 *
 * The four premium variables (snow, sea-surface temperature, heat index,
 * humidity) are **not** here and cannot be: country pages are statically
 * generated, so one HTML document serves every visitor and anything in this
 * type is in public view-source. The pipeline already treats the tier boundary
 * as a file boundary (`FREE_VARIABLES` in `build_geojson.py`); this is the
 * same boundary. The premium charts on the country page render as locked
 * placeholders, and the real series live on the map, behind a signed tile URL.
 */
export type ClimateSeries = {
  months: readonly string[];
  t: Monthly;       // °C mean
  tMin: Monthly;    // °C 10th percentile
  tMax: Monthly;    // °C 90th percentile
  r: Monthly;       // mm / month — for display
  /**
   * mm / day — the unit the scoring rule consumes, and the one the map paints.
   * `r` is this series times the length of each month; keeping both means the
   * page can print a monthly total without the score having to round-trip
   * through it. See `preferenceScore` in `scoring.ts`.
   */
  rDay: Monthly;
  s: Monthly;       // hr / day
  /** Absent where the polygon carries no wind series. */
  w?: Monthly;
};

export type BestMonth = {
  month: string;
  score: number;
  note: string;
};

export type RegionRow = {
  name: string;
  /**
   * URL slug, assigned by the pipeline so that two regions whose names slug
   * identically still get one URL each. Falls back to slugifying `name`.
   */
  slug?: string;
  /**
   * Admin-1 polygon id (`adm1_code`) — the same value the tiles carry as a
   * feature's `id`. Absent on a fixture, or on a bundle published before the
   * field existed.
   */
  code?: string;
  /**
   * A travel advisory that applies to *this region* and is worse than the
   * country-wide one — the case where a government carved out a specific
   * subdivision and a scraper could resolve it to an ISO-3166-2 code. Absent
   * when the region carries only its country's level, which the country-wide
   * safety panel on the same page already states.
   */
  advisory?: { level: AdvisoryLevel; label: string; code: string };
  /**
   * Ids of the curated activities that name *this* subdivision, resolved by
   * the pipeline against ISO-3166-2 so the web never needs that code. Absent
   * when none do — which is most regions, and is why the section is omitted
   * rather than rendered empty.
   */
  activities?: readonly string[];
  score: number;
  tl: Monthly;      // °C mean
  /** mm / day. Absent on a region the pipeline has no rainfall for. */
  rl?: Monthly;
  /** hr / day. Absent on a region the pipeline has no sunshine for. */
  sl?: Monthly;
};

export type RelatedCountry = {
  slug: string;
  name: string;
  sub: string;
  score: number;
};

/**
 * What a traveller can actually *do* in a place, and when — the one curated,
 * hand-authored dataset in the payload.
 *
 * Everything else here is derived from ERA5 or scraped from a government, and
 * the prose built from it is checkable against the chart beside it. Activities
 * cannot work that way: no climatology tells you the classic Inca Trail closes
 * every February while Machu Picchu itself stays open all year. So each item
 * carries `sources`, and the pipeline
 * (`processing/activities.py`) — not this app — turns the structured fields
 * into sentences. Nothing on the web side composes a claim about a place.
 */
export type ActivityStatus = "closed" | "limited" | "best" | "open";

export type ActivitySource = {
  url: string;
  /** ISO date a human last read that URL and confirmed it says this. */
  checked: string;
};

export type ActivityItem = {
  id: string;
  name: string;
  kind: string;
  /** ISO-3166-2 codes this names, if any. Empty means country-wide. */
  regions: readonly string[];
  yearRound: boolean;
  /**
   * A thing that happens on a date rather than a thing that is open — a
   * festival. It is absent from months it does not fall in, rather than listed
   * as "closed" in eleven of them, which would be both false and useless.
   */
  datedEvent: boolean;
  /** 1-12 months in which it is actually on. */
  onMonths: readonly number[];
  sources: readonly ActivitySource[];
};

/** One activity's state in one month. `id` keys back into `items`. */
export type ActivityMonthRow = {
  id: string;
  status: ActivityStatus;
  reason: string;
};

export type ActivityMonth = {
  /** The generated one-line lede. Counts only what `rows` shows. */
  lede: string;
  /** Worst status first, so a closure is never below something a reader scrolls past. */
  rows: readonly ActivityMonthRow[];
};

export type ActivityBlock = {
  /** ISO date a human last reviewed the whole country file. */
  reviewed: string;
  /** The year-level lede, for the country page. */
  lede: string;
  items: readonly ActivityItem[];
  /** Keyed by the same three-letter month labels as `monthNotes`. */
  months: Record<string, ActivityMonth>;
};

/**
 * One country, as `/v1/countries/{slug}` returns it.
 *
 * The optional fields are optional because the pipeline may genuinely not know
 * them. Natural Earth is the source of record for the boundary vintage and it
 * carries no local-language name, currency or official language at all, and no
 * capital for a handful of territories; a country no government has published
 * an advisory for has no advisory. Every surface that renders one of these
 * omits the row rather than printing a placeholder — the alternative is a
 * hand-kept table that drifts away from the polygons it describes.
 */
export type CountryData = {
  slug: string;
  name: string;
  iso2: string;
  region: string;
  /** Generated from the series below — factual, and checkable against them. */
  summary: string;
  bestMonths: readonly BestMonth[];
  climate: ClimateSeries;
  regions: readonly RegionRow[];
  related: readonly RelatedCountry[];
  monthNotes: Record<string, string>;
  /**
   * Absent for most countries, and that is the design: coverage is tiered by
   * how travelled a country is, and a page with no curated activities renders
   * no section rather than an empty one. See `activity_data/README.md`.
   */
  activities?: ActivityBlock;
  capital?: string;
  /** IANA zone id, e.g. `America/Lima`. */
  tz?: string;
  area?: string;
  advisories?: AdvisorySummary;
  /**
   * `"admin1-mean"` marks one of the ten suppressed countries: the map paints
   * no national polygon for it (a single colour for Russia or Argentina is a
   * claim the data does not support), so these figures are the mean of its own
   * regions. The generated summary says so on the page.
   */
  climateBasis?: "country" | "admin1-mean";
};

export type MonthDetail = {
  country: CountryData;
  month: MonthSlug;
  monthName: string;
  monthIdx: number;
  /** Editorial verdict — one-line hook drawn from `monthNotes` or overrides. */
  verdict: string;
  narrative: string;
  score: number;
  rank: number;
};

export type TierId = "free" | "premium" | "starter" | "pro" | "enterprise";

export type TierPrice = {
  monthly: number | null;
  yearly: number | null;
  suffix: string;
};

export type Tier = {
  id: TierId;
  name: string;
  shortName?: string;
  eyebrow: string;
  featured?: boolean;
  agency?: boolean;
  price: TierPrice;
  priceDisplay?: string;
  yearlyNote?: string;
  seats?: string;
  cta: { label: string; kind: "primary" | "outline" | "ghost" };
  subline: string;
  featuredBullets?: readonly string[];
  features: readonly string[];
};

// ─── Session / entitlement ───────────────────────────────────────────
//
// FastAPI owns auth; these mirror the `MeResponse` schema in
// `api/src/wtg_api/schemas/__init__.py` field for field, in camelCase. The
// **plan vocabulary is the API's** — `consumer_premium`, not `premium`. The
// web used to keep its own shorthand, which meant `getEntitlement` compared
// `session.plan` against strings that no `/api/me` response ever contained.
//
// Parsing and entitlement derivation live in `lib/session-user.ts`; nothing
// should construct a `SessionUser` by hand outside the fixtures.

export type AccountPlan =
  | "free"
  | "consumer_premium"
  | "agency_starter"
  | "agency_pro"
  | "agency_enterprise";

/** A membership role within an organization — the API's `Role` enum. */
export type AccountRole = "owner" | "admin" | "agent" | "member";

/**
 * The organization the user's entitlement came from. Absent for a user with
 * no membership, which is everyone on the free plan.
 *
 * Only the fields the API can actually answer for: `Organization` carries no
 * slug and no owner name, and inventing either is how the account page came
 * to print an agency URL that resolves to nothing.
 */
export type SessionOrg = {
  id: string;
  name: string;
  plan: AccountPlan;
  seatCap: number;
  seatsUsed: number;
  /** ISO-8601 UTC. Null on a payload that predates the field. */
  createdAt: string | null;
  /**
   * True for the single-seat organization carrying one consumer's own
   * subscription. It is a wallet, not a workspace: no team, no clients, no
   * seats to sell. The account shell switches on this rather than on the plan
   * — see `isAgencyWorkspace` in `lib/session-user.ts`.
   */
  isPersonal: boolean;
};

export type SessionUser = {
  id: string;
  email: string;
  /** Null until the user gives one — magic-link sign-up collects an address. */
  name: string | null;
  plan: AccountPlan;
  /** Role in {@link SessionOrg}. Null when there is no org. */
  role: AccountRole | null;
  /** ISO-8601 UTC account-creation time. Render via `monthYear()`. */
  createdAt: string | null;
  org: SessionOrg | null;
};

export type Entitlement = {
  premium: boolean;
  agency: boolean;
  seatCap?: number;
};

// ─── Trip ────────────────────────────────────────────────────────────
//
// The trip view model lives in `lib/trip-server.ts`, next to the code that
// assembles it. What used to be here — `TripData`, `TripPref`,
// `TripDestination` — described the fixture rather than the API: an owner that
// was either a consumer or a named agency with a named client, nine
// preference criteria of which six name variables no scoring rule consults,
// and destinations carrying pre-formatted strings and editorial tags.

// ─── Account (consumer) ──────────────────────────────────────────────
//
// View models, assembled in `lib/account-server.ts` from the API's rows plus
// the published country payload. Every optional field is `null` where the data
// genuinely cannot say — an unpublished country, a trip saved with no month.
// Zero would be a claim about the weather; null is a claim about our data.
//
// There is deliberately no invoice or activity list here. The API has no event
// log and no cached invoices, and the fixtures that used to supply both were
// showing invented billing history to real users. Invoices arrive with the
// Paddle customer portal in WS-B.

export type AccountTrip = {
  id: string;
  title: string;
  countryName: string | null;
  countrySlug: string | null;
  monthName: string | null;
  monthSlug: MonthSlug | null;
  /** 0–100 for the trip's month under the trip's own saved preferences. */
  score: number | null;
  /** Admin-1 regions of that country clearing the "Good" threshold. */
  matchingRegions: number | null;
};

export type AccountFavourite = {
  id: string;
  name: string;
  /** Sub-line: the country, for a region; the world region, for a country. */
  sub: string;
  /** Null for a favourite whose country the registry cannot resolve. */
  href: string | null;
  /** The pipeline's own best months, not a number recomputed here. */
  best: string | null;
};

export type AccountAlert = {
  id: string;
  /** Assembled from the alert's fields, so it always says what will be checked. */
  label: string;
  conditions: string;
  active: boolean;
};

// `InvoiceRow` used to live here. Nothing renders one any more: WS-A took the
// invoice table off the consumer account and WS-C took it off the agency one,
// because Paddle is merchant of record and the invoices are behind a portal
// session. A type with no source of truth behind it is an invitation to
// fabricate rows for it again.

export type ConsumerAccount = {
  trips: readonly AccountTrip[];
  favourites: readonly AccountFavourite[];
  alerts: readonly AccountAlert[];
};

// ─── Agency ──────────────────────────────────────────────────────────
//
// View models for the agency surfaces, assembled in `lib/agency-server.ts`
// from `/api/orgs/*`. Every field here is one the API can actually answer for,
// which is a much shorter list than the fixtures carried: there is no event
// log, so no activity feed; no cached invoices, so no invoice table; no
// per-member "last active" or trips-authored counter, because nothing records
// either. The design's versions of those rows were invented, and an agency
// looking at a team list of five people who do not exist is the same class of
// failure as the fixture client record that was readable by id.
//
// What *is* real: who is in the org, who has been invited and not yet
// accepted, which seats that consumes, and the client records with their
// assigned trips and notes.

export type TeamMember = {
  /** Membership id — what a revoke addresses. */
  id: string;
  userId: string;
  /** Null until the person has given one; the email always exists. */
  name: string | null;
  email: string;
  role: AccountRole;
  /** ISO-8601 UTC — when they joined the org, not when they last logged in. */
  joinedAt: string | null;
  /** The signed-in user's own row, so the UI can mark it and refuse to remove it. */
  you: boolean;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: AccountRole;
  /** ISO-8601 UTC. The invitation dies on its own at this point. */
  expiresAt: string | null;
  invitedAt: string | null;
};

export type ClientSummary = {
  id: string;
  name: string;
  email: string | null;
  /** Trips assigned to this client across the whole org. */
  trips: number;
  createdAt: string | null;
};

/**
 * The agency dashboard.
 *
 * `seatsUsed` counts memberships and `seatsPending` counts open invitations;
 * the cap applies to their sum, which is the same rule the API enforces. Two
 * numbers rather than one because "2 of 3 seats, 1 invite out" is the sentence
 * the team page has to be able to write.
 */
export type AgencyAccount = {
  team: readonly TeamMember[];
  invites: readonly PendingInvite[];
  clients: readonly ClientSummary[];
  seatsUsed: number;
  seatsPending: number;
  seatCap: number;
};

// ─── Client detail ───────────────────────────────────────────────────

export type ClientNote = {
  id: string;
  /** The author's name, or their email, or null once they have left the org. */
  author: string | null;
  /** ISO-8601 UTC. */
  when: string;
  body: string;
};

export type ClientTrip = {
  id: string;
  title: string;
  /** Null where the trip's country is not one the pipeline has published. */
  countryName: string | null;
  countrySlug: string | null;
  monthName: string | null;
  /** Whoever in the org authored it — trips belong to agents, not to clients. */
  agent: string;
  /** ISO-8601 UTC. */
  updatedAt: string;
  /** Whether a share link exists. Never the link itself. */
  shared: boolean;
};

export type ClientRecord = {
  id: string;
  name: string;
  email: string | null;
  /** The profile's free-text field, distinct from the dated `notes` timeline. */
  profileNotes: string | null;
  createdAt: string | null;
  trips: readonly ClientTrip[];
  notes: readonly ClientNote[];
};
