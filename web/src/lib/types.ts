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
  date: string;
  url: string;
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
// FastAPI owns auth; these types mirror the `/api/me` payload shape that
// Phase 5.5 will finalise. The mock session plumbing in `lib/session.ts`
// returns objects of this shape so the UI can be built before the API
// endpoint exists.

export type AccountPlan =
  | "free"
  | "premium"
  | "agency_starter"
  | "agency_pro"
  | "agency_enterprise";

export type AgencyRole =
  | "agency_owner"
  | "agency_admin"
  | "agency_agent"
  | "agency_viewer";

export type AccountRole = "consumer" | AgencyRole;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  plan: AccountPlan;
  role: AccountRole;
  signedInAt: string;
  memberSince: string;
  org?: {
    id: string;
    name: string;
    slug: string;
    plan: AccountPlan;
    seatCap: number;
    seatsUsed: number;
    ownerName: string;
    memberSince: string;
  };
};

export type Entitlement = {
  premium: boolean;
  agency: boolean;
  seatCap?: number;
};

// ─── Trip ────────────────────────────────────────────────────────────

export type TripPref = {
  key: string;
  label: string;
  range: string;
  icon?: "temp" | "rain" | "sun" | "wind" | "shield";
  matched?: boolean;
};

export type TripDestination = {
  rank: number;
  region: string;
  country: string;
  score: number;
  t: string;
  r: string;
  s: string;
  tag: string;
};

export type TripData = {
  id: string;
  title: string;
  country: string;
  countrySlug: string;
  months: readonly string[];
  year: number;
  score: number;
  shareUrl: string;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string;
  owner:
    | { kind: "consumer"; name: string }
    | { kind: "agency"; agency: string; orgSlug: string; client: string; clientId?: string; plan: string };
  prefs: {
    free: readonly TripPref[];
    premium: readonly TripPref[];
  };
  destinations: readonly TripDestination[];
};

// ─── Account (consumer) ──────────────────────────────────────────────

export type TripSummary = {
  id: string;
  title: string;
  months: string;
  country: string;
  score: number;
  regions: number;
  updated: string;
};

export type FavouriteRow = {
  slug: string;
  name: string;
  sub: string;
  best: string;
};

export type AlertRow = {
  id: string;
  label: string;
  cadence: "Realtime" | "Daily" | "Weekly";
  last: string;
  on: boolean;
};

export type InvoiceRow = {
  date: string;
  id: string;
  amount: string;
  status: "Paid" | "Failed" | "Refunded";
  note?: string;
};

export type ActivityRow = {
  date: string;
  text: string;
  tag: string;
};

export type ConsumerAccount = {
  trips: readonly TripSummary[];
  favourites: readonly FavouriteRow[];
  alerts: readonly AlertRow[];
  invoices: readonly InvoiceRow[];
  activity: readonly ActivityRow[];
  renewsAt?: string;
  price?: string;
};

// ─── Agency ──────────────────────────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Agent" | "Viewer";
  last: string;
  trips: number;
  status: "active" | "invited";
  you?: boolean;
};

export type ClientSummary = {
  id: string;
  name: string;
  country: string;
  trips: number;
  last: string;
  agent: string;
  tag: string;
};

export type AgencyActivityRow = {
  t: string;
  who: string;
  act: string;
  obj: string;
  ctx: string;
  kind:
    | "SHARE"
    | "EDIT"
    | "CREATE"
    | "EXPORT"
    | "TEAM"
    | "CLIENT"
    | "ALERT"
    | "BILLING";
};

export type AgencyAccount = {
  team: readonly TeamMember[];
  clients: readonly ClientSummary[];
  activity: readonly AgencyActivityRow[];
  tripsYTD: number;
  activeTrips: number;
  archivedThisMonth: number;
  invoices: readonly InvoiceRow[];
};

// ─── Client detail ───────────────────────────────────────────────────

export type ClientPref = {
  key: string;
  label: string;
  value: string;
  icon?: "temp" | "rain" | "sun" | "wind" | "shield";
  pro?: boolean;
};

export type ClientRestriction = { label: string; value: string };

export type ClientNote = {
  author: string;
  when: string;
  kind: "call" | "email" | "meeting" | "internal" | "client" | "lead";
  body: string;
};

export type ClientActivityRow = {
  t: string;
  who: string;
  act: string;
  obj: string;
  kind: "CREATE" | "EDIT" | "SHARE" | "EXPORT" | "VIEW" | "NOTE" | "TAG" | "SYSTEM";
};

export type ClientTrip = {
  id: string;
  title: string;
  country: string;
  months: string;
  created: string;
  updated: string;
  agent: string;
  score: number;
  status: "shared" | "draft" | "archived";
};

export type ClientRecord = {
  id: string;
  name: string;
  shortName: string;
  kind: string;
  email: string;
  phone: string;
  city: string;
  since: string;
  tags: readonly string[];
  nextTouch: string;
  primaryAgent: { name: string; role: string; email: string };
  prefs: {
    ranges: readonly ClientPref[];
    restrictions: readonly ClientRestriction[];
  };
  trips: readonly ClientTrip[];
  activity: readonly ClientActivityRow[];
  notes: readonly ClientNote[];
};
