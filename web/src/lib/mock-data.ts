/**
 * Mock country data. SSR pages fetch from the internal API
 * (`INTERNAL_API_URL`); these fixtures are what `USE_MOCK_DATA` swaps in so
 * that `pnpm dev` and the component tests render the page tree with no API and
 * no pipeline outputs on disk. They are no longer what production runs on.
 *
 * Numbers are grounded placeholders (ERA5-shaped, realistic for each country)
 * copied from `web/design/country/peruData.js`. They carry only the free-tier
 * series, because that is all the API publishes — see `ClimateSeries` for why
 * a statically generated page cannot hold the premium four.
 */

import type { CountryRef } from "./countries";
import type {
  CountryData,
  Monthly,
  RegionRow,
  SessionUser,
} from "./types";

/** mm/day from a monthly total — the unit the scoring rule consumes. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function perDay(monthly: Monthly): Monthly {
  return monthly.map(
    (mm, i) => Math.round((mm / DAYS_IN_MONTH[i]) * 100) / 100,
  ) as unknown as Monthly;
}

const zeros: Monthly = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const PERU_RAIN: Monthly = [148, 168, 142, 72, 28, 12, 8, 12, 28, 62, 88, 118];

const PERU: CountryData = {
  slug: "peru",
  name: "Peru",
  iso2: "PE",
  capital: "Lima",
  region: "South America",
  tz: "America/Lima",
  area: "1,285,216 km²",
  summary:
    "Peru spans three climates in one country: the rainless Pacific coast, the high Andean sierra with cool-dry days and cold nights, and the humid Amazon lowlands. The coast stays mild year-round; the sierra is best from May through September when skies are clear; the jungle is warm and wet almost always. National averages hide all of this — the regional view below is the one that matters.",
  bestMonths: [
    { month: "June", score: 94, note: "Dry sierra, clear skies, peak trekking" },
    { month: "July", score: 92, note: "Coolest, driest — cold nights in Cusco" },
    { month: "August", score: 89, note: "Still dry, warmer days returning" },
  ],
  climate: {
    months: MONTH_LABELS,
    t: [22.1, 22.6, 22.2, 20.8, 18.7, 17.2, 16.4, 16.6, 17.3, 18.5, 19.8, 21.2],
    tMin: [15.8, 16.2, 15.9, 14.5, 12.1, 10.3, 9.4, 9.7, 10.8, 12.2, 13.5, 14.9],
    tMax: [28.4, 29.1, 28.7, 27.2, 25.3, 24.1, 23.3, 23.6, 24.2, 25.1, 26.3, 27.7],
    r: PERU_RAIN,
    rDay: perDay(PERU_RAIN),
    s: [5.8, 5.6, 5.9, 6.8, 7.2, 7.4, 7.6, 7.5, 7.1, 6.6, 6.2, 5.9],
    w: [10.2, 10.8, 11.1, 10.4, 9.8, 10.1, 10.6, 11.2, 11.8, 11.5, 10.9, 10.5],
  },
  regions: [
    { name: "Amazonas", score: 71, tl: [26, 26, 26, 26, 25, 24, 24, 25, 26, 26, 26, 26] },
    { name: "Áncash", score: 84, tl: [19, 19, 19, 19, 18, 17, 17, 17, 18, 19, 19, 19] },
    { name: "Apurímac", score: 88, tl: [15, 15, 15, 15, 13, 12, 11, 12, 14, 15, 15, 15] },
    { name: "Arequipa", score: 91, tl: [17, 17, 17, 16, 14, 13, 13, 14, 15, 16, 17, 17] },
    { name: "Ayacucho", score: 86, tl: [16, 16, 16, 15, 13, 12, 12, 13, 14, 15, 16, 16] },
    { name: "Cajamarca", score: 79, tl: [15, 15, 15, 15, 14, 13, 13, 14, 15, 15, 15, 15] },
    { name: "Callao", score: 74, tl: [23, 24, 23, 22, 20, 18, 17, 17, 18, 19, 20, 22] },
    { name: "Cusco", score: 93, tl: [13, 13, 13, 13, 11, 10, 9, 11, 12, 13, 13, 13] },
    { name: "Huancavelica", score: 85, tl: [10, 10, 10, 10, 8, 7, 6, 7, 9, 10, 10, 10] },
    { name: "Huánuco", score: 77, tl: [19, 19, 19, 19, 18, 17, 17, 17, 18, 19, 19, 19] },
    { name: "Ica", score: 78, tl: [23, 24, 23, 22, 20, 18, 17, 17, 18, 19, 20, 22] },
    { name: "Junín", score: 83, tl: [12, 12, 12, 12, 10, 9, 8, 10, 11, 12, 12, 12] },
    { name: "La Libertad", score: 76, tl: [22, 23, 22, 21, 19, 18, 17, 17, 18, 19, 20, 21] },
    { name: "Lambayeque", score: 72, tl: [24, 25, 24, 23, 21, 19, 18, 19, 20, 21, 22, 23] },
    { name: "Lima", score: 74, tl: [23, 24, 23, 22, 20, 18, 17, 17, 18, 19, 20, 22] },
    { name: "Loreto", score: 62, tl: [26, 26, 26, 26, 26, 25, 25, 26, 26, 26, 26, 26] },
    { name: "Madre de Dios", score: 64, tl: [26, 26, 26, 26, 24, 22, 22, 24, 26, 26, 26, 26] },
    { name: "Moquegua", score: 89, tl: [18, 18, 18, 17, 15, 14, 13, 14, 15, 16, 17, 18] },
    { name: "Pasco", score: 81, tl: [10, 10, 10, 10, 9, 8, 7, 8, 9, 10, 10, 10] },
    { name: "Piura", score: 70, tl: [26, 27, 26, 25, 23, 21, 20, 20, 21, 22, 23, 25] },
    { name: "Puno", score: 82, tl: [10, 10, 9, 9, 6, 4, 3, 5, 7, 8, 9, 10] },
    { name: "San Martín", score: 68, tl: [25, 25, 25, 25, 24, 23, 22, 23, 24, 25, 25, 25] },
    { name: "Tacna", score: 87, tl: [19, 19, 19, 18, 16, 14, 14, 14, 15, 16, 17, 18] },
    { name: "Tumbes", score: 73, tl: [26, 27, 27, 26, 25, 24, 23, 23, 23, 24, 25, 26] },
    { name: "Ucayali", score: 66, tl: [26, 26, 26, 26, 25, 24, 23, 24, 25, 26, 26, 26] },
  ],
  advisories: {
    combined: { level: 2, label: "Exercise increased caution" },
    lastUpdated: "2026-04-18",
    regionalMax: 3,
    regionalMaxLabel: "Reconsider travel",
    sources: [
      { gov: "Australia", level: 1, label: "Exercise normal safety precautions", date: "2026-04-16", url: "https://www.smartraveller.gov.au/destinations/americas/peru" },
      { gov: "Canada", level: 2, label: "Exercise a high degree of caution", date: "2026-04-10", url: "https://travel.gc.ca/destinations/peru" },
      { gov: "Germany", level: 1, label: "Keine Reisewarnung", date: "2026-04-14", url: "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/peru-node" },
      { gov: "Netherlands", level: 2, label: "Exercise increased caution", date: "2026-04-17", url: "https://www.nederlandwereldwijd.nl/peru/reisadvies" },
      { gov: "United Kingdom", level: 2, label: "See our travel advice", date: "2026-04-15", url: "https://www.gov.uk/foreign-travel-advice/peru" },
      { gov: "United States", level: 2, label: "Exercise increased caution", date: "2026-04-12", url: "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/Peru.html" },
    ],
  },
  related: [
    { slug: "ecuador", name: "Ecuador", sub: "Similar coastal + highland split", score: 86 },
    { slug: "bolivia", name: "Bolivia", sub: "Shares the altiplano climate", score: 84 },
    { slug: "colombia", name: "Colombia", sub: "Tropical Andes, warmer overall", score: 82 },
    { slug: "chile", name: "Chile", sub: "Atacama mirrors dry Peru coast", score: 88 },
    { slug: "brazil", name: "Brazil", sub: "Shared Amazon basin to the east", score: 75 },
    { slug: "argentina", name: "Argentina", sub: "Andean neighbour, temperate south", score: 80 },
  ],
  monthNotes: {
    Jan: "Coast warm and humid; Andes wet (trekking season closed); Amazon peak rains.",
    Feb: "Wettest month in the sierra. Inca Trail closed. Coastal cities pleasant.",
    Mar: "Rains tapering. Carnival. Lima still warm, Cusco still wet.",
    Apr: "Shoulder — green sierra, lighter rains. Fewer tourists, lower prices.",
    May: "Dry season begins. Cool, clear in the highlands. Great value.",
    Jun: "Peak trekking. Inti Raymi in Cusco. Cold nights, sunny days.",
    Jul: "Coolest, driest month. Peak tourism — book ahead.",
    Aug: "Dry continues. Amazon lowest water levels — easier wildlife viewing.",
    Sep: "Shoulder returning. Fewer crowds, still mostly dry.",
    Oct: "Rains returning to sierra. Coast beginning to warm.",
    Nov: "Transition month. Wet in the Andes, summer building on coast.",
    Dec: "High summer on the coast, full wet season inland. Christmas crowds.",
  },
};

/**
 * Build a lightly-customised country from a template. Only used for Japan
 * and Iceland mocks, which keep Peru's shape but shift numbers so each
 * country feels distinct in previews.
 */
function derive(base: Omit<CountryData, "regions"> & { regions?: readonly RegionRow[] }): CountryData {
  return {
    ...base,
    regions: base.regions ?? [],
  };
}

const JAPAN_RAIN: Monthly = [52, 56, 118, 124, 138, 168, 153, 168, 210, 197, 92, 51];

const JAPAN: CountryData = derive({
  slug: "japan",
  name: "Japan",
  iso2: "JP",
  capital: "Tokyo",
  region: "Asia",
  tz: "Asia/Tokyo",
  area: "377,975 km²",
  summary:
    "Japan stretches 3,000 km from subarctic Hokkaido to subtropical Okinawa, so the national average is almost meaningless. Cherry blossoms push north from late March; the rainy season (tsuyu) dominates most of the archipelago in June; autumn colours descend south through October and November. Pick a region, not a country.",
  bestMonths: [
    { month: "April", score: 92, note: "Cherry blossoms, mild, busy" },
    { month: "October", score: 91, note: "Autumn colours, dry and clear" },
    { month: "November", score: 88, note: "Later foliage, cool evenings" },
  ],
  climate: {
    months: MONTH_LABELS,
    t: [5.2, 5.8, 8.9, 14.2, 18.6, 22.1, 25.8, 27.3, 23.4, 18.2, 12.8, 7.6],
    tMin: [1.2, 1.4, 4.1, 9.3, 14.1, 18.6, 22.9, 24.1, 20.2, 14.6, 8.9, 3.7],
    tMax: [9.8, 10.4, 14.0, 19.2, 23.2, 25.6, 28.8, 30.4, 26.8, 21.8, 16.7, 11.8],
    r: JAPAN_RAIN,
    rDay: perDay(JAPAN_RAIN),
    s: [6.1, 6.0, 5.8, 6.0, 5.6, 4.4, 5.5, 6.3, 4.6, 4.8, 5.2, 5.4],
    w: [11.0, 11.4, 12.0, 12.2, 11.6, 11.0, 11.4, 11.8, 12.2, 11.6, 11.0, 10.8],
  },
  regions: [],
  advisories: {
    combined: { level: 1, label: "Exercise normal precautions" },
    lastUpdated: "2026-04-18",
    sources: [
      { gov: "Australia", level: 1, label: "Exercise normal safety precautions", date: "2026-04-16", url: "https://www.smartraveller.gov.au/destinations/asia/japan" },
      { gov: "Canada", level: 1, label: "Exercise normal security precautions", date: "2026-04-10", url: "https://travel.gc.ca/destinations/japan" },
      { gov: "Germany", level: 1, label: "Keine Reisewarnung", date: "2026-04-14", url: "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/japan-node" },
      { gov: "United Kingdom", level: 1, label: "See our travel advice", date: "2026-04-15", url: "https://www.gov.uk/foreign-travel-advice/japan" },
      { gov: "United States", level: 1, label: "Exercise normal precautions", date: "2026-04-12", url: "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/Japan.html" },
    ],
  },
  related: [
    { slug: "peru", name: "Peru", sub: "Comparable shoulder-season patterns", score: 80 },
    { slug: "iceland", name: "Iceland", sub: "Similar autumn sweet-spot", score: 74 },
  ],
  monthNotes: {
    Jan: "Cold and dry on the Pacific side; deep snow in the north and along the Sea of Japan.",
    Feb: "Snow peaks in Hokkaido. Sapporo Snow Festival. Clear, cold days in Tokyo.",
    Mar: "Cherry blossoms open from the south. Tokyo peaks late March to early April.",
    Apr: "Prime hanami season. Mild days, fresh green. Crowds and prices spike.",
    May: "Golden Week crowds, then calm. Warm, dry, good for rural travel.",
    Jun: "Tsuyu (rainy season) covers most of Honshu and Kyushu. Hokkaido stays dry.",
    Jul: "Hot and humid; rainy season ending late in the month. Typhoon risk begins.",
    Aug: "Peak heat and humidity. Summer festivals. Hokkaido is the best escape.",
    Sep: "Typhoon season. Heat breaks late month. Silver Week crowds.",
    Oct: "Best-in-class weather. Autumn colours arrive in the north.",
    Nov: "Foliage moves south. Clear, cool, dry. Excellent value after mid-month.",
    Dec: "Cold, dry, crisp. Illuminations across major cities.",
  },
});

const ICELAND_RAIN: Monthly = [76, 72, 82, 58, 44, 50, 52, 62, 68, 86, 73, 79];

const ICELAND: CountryData = derive({
  slug: "iceland",
  name: "Iceland",
  iso2: "IS",
  capital: "Reykjavík",
  region: "Europe",
  tz: "Atlantic/Reykjavik",
  area: "103,000 km²",
  summary:
    "Iceland's weather is not hot or cold so much as relentlessly variable. Summer (June–August) offers long daylight, open highlands, and the calmest seas. Winter trades weather for aurora: short days, storm windows, and dramatic light. Shoulder seasons are cheaper but less predictable; build slack into any itinerary.",
  bestMonths: [
    { month: "July", score: 91, note: "Long days, open highland roads" },
    { month: "August", score: 89, note: "Warmest water, settled skies" },
    { month: "June", score: 86, note: "Midnight sun, fewer crowds" },
  ],
  climate: {
    months: MONTH_LABELS,
    t: [-0.2, 0.4, 0.9, 3.1, 6.8, 9.9, 11.8, 11.2, 8.6, 5.2, 2.0, 0.0],
    tMin: [-4.1, -3.6, -3.0, -1.2, 2.4, 5.8, 8.2, 7.8, 5.0, 1.8, -1.6, -3.8],
    tMax: [3.4, 3.8, 4.4, 7.2, 11.1, 14.2, 15.8, 15.2, 12.4, 8.6, 5.4, 3.6],
    r: ICELAND_RAIN,
    rDay: perDay(ICELAND_RAIN),
    s: [0.5, 1.9, 3.6, 4.8, 5.8, 6.2, 5.9, 5.4, 4.1, 2.6, 0.9, 0.2],
    w: [22.4, 21.8, 21.2, 19.6, 17.8, 16.4, 15.8, 16.2, 18.4, 20.1, 21.4, 22.2],
  },
  regions: [],
  // Nobody has published one. The section renders that, rather than asserting
  // "normal precautions" on no government's authority.
  advisories: undefined,
  related: [
    { slug: "japan", name: "Japan", sub: "Parallel autumn windows", score: 72 },
    { slug: "peru", name: "Peru", sub: "Highland-trek shoulder parallels", score: 68 },
  ],
  monthNotes: {
    Jan: "Short days, aurora potential, storm fronts — plan buffer days.",
    Feb: "Longer days, still deep winter. Good aurora, hard highland access.",
    Mar: "Light returning; highland roads stay closed. Calmer crowds.",
    Apr: "Shoulder. Variable weather, cheaper flights. Highlands not yet open.",
    May: "Spring emerging. First puffins. Ring road reliable.",
    Jun: "Midnight sun. Highlands beginning to open. Cool but settled.",
    Jul: "Warmest. Peak road access. Book huts and campsites well ahead.",
    Aug: "Last of midnight sun. First aurora possible late August.",
    Sep: "Autumn colours on tundra. Aurora season begins in earnest.",
    Oct: "Shoulder — aurora, fewer crowds, early snow on highlands.",
    Nov: "Winter returns. Good aurora, limited daylight.",
    Dec: "Shortest days. Jólasveinar and Reykjavík festive lights.",
  },
});

export const COUNTRY_DATA: Record<string, CountryData> = {
  peru: PERU,
  japan: JAPAN,
  iceland: ICELAND,
};

/** Returns the mock fixture for a slug, or `null` if we don't have one. */
export function findCountryData(slug: string): CountryData | null {
  return COUNTRY_DATA[slug] ?? null;
}

/** All mocked country slugs — `generateStaticParams` uses this in dev. */
export function mockCountrySlugs(): string[] {
  return Object.keys(COUNTRY_DATA);
}

/**
 * The fixtures' stand-in for `/v1/countries`. Same shape, same job: it is what
 * the route tree is generated from when `USE_MOCK_DATA` is on, so a `pnpm dev`
 * with no API builds three countries' pages rather than 237 empty ones.
 */
export function mockCountryRefs(): readonly CountryRef[] {
  return Object.values(COUNTRY_DATA).map((c) => ({
    slug: c.slug,
    name: c.name,
    iso2: c.iso2,
    region: c.region,
  }));
}

export { zeros as MONTHLY_ZEROS };

// ─── Session fixtures ────────────────────────────────────────────────
//
// Three personas keep the UI exercised without hitting the real API.
// The fourth "persona" is the unauthenticated state — represented by
// returning `null` from `getSessionServer`.

export const SESSION_FIXTURES: Record<string, SessionUser> = {
  free: {
    id: "usr_sam",
    name: "Sam Patel",
    email: "sam.patel@hey.com",
    plan: "free",
    role: null,
    createdAt: "2026-03-04T09:12:00Z",
    org: null,
  },
  premium: {
    id: "usr_lea",
    name: "Léa Marchetti",
    email: "lea.marchetti@gmail.com",
    plan: "consumer_premium",
    role: "owner",
    createdAt: "2024-09-14T17:40:00Z",
    org: {
      id: "org_lea",
      name: "Léa Marchetti",
      plan: "consumer_premium",
      seatCap: 1,
      seatsUsed: 1,
      createdAt: "2024-09-14T17:40:00Z",
      // A consumer's subscription hangs off a single-seat org of their own.
      isPersonal: true,
    },
  },
  agency: {
    id: "usr_elena",
    name: "Elena Quiroz",
    email: "elena@cordillera.tours",
    plan: "agency_pro",
    role: "owner",
    createdAt: "2024-02-19T11:05:00Z",
    org: {
      id: "org_cordillera",
      name: "Cordillera Voyages",
      plan: "agency_pro",
      seatCap: 10,
      seatsUsed: 7,
      createdAt: "2024-02-19T11:05:00Z",
      isPersonal: false,
    },
  },
};

/** Map any mock session key or id back to a SessionUser. */
export function findSession(key: string | undefined | null): SessionUser | null {
  if (!key) return null;
  if (SESSION_FIXTURES[key]) return SESSION_FIXTURES[key]!;
  const byId = Object.values(SESSION_FIXTURES).find((s) => s.id === key);
  return byId ?? null;
}

// ─── Trip fixtures ───────────────────────────────────────────────────
//
// Deliberately gone. `/trip/[id]` reads the owner's trip from the API and
// `/trip/share/[token]` reads a shared one; there is nothing a fixture trip
// can stand in for. The one that lived here — a honeymoon in Peru belonging to
// a fixture agency user — was the only trip the site could render, was
// reachable by anyone signed in or not, and was linked from the account page's
// empty state as "See an example trip".

// ─── Consumer account fixtures ───────────────────────────────────────
//
// Deliberately gone. `/account` reads trips, favourites and alerts from the
// API via `lib/account-server.ts`; under `USE_MOCK_DATA` it renders an empty
// account, which is what a dev with no API running actually has. The fixtures
// that used to live here described a subscriber with four invoices and a
// month of activity, and no session id outside this file ever matched them —
// so every real user saw the empty states anyway, and any future fixture
// persona would have shown invented billing history.

// ─── Agency account fixtures ─────────────────────────────────────────

/**
 * The agency fixtures are gone, not ported.
 *
 * They described a shape the API cannot answer for — an activity feed, cached
 * invoices, per-agent trip counts, a client's phone number and "primary agent"
 * — so keeping them would have meant maintaining a second view model whose
 * only job was to look convincing. WS-C rebuilt the agency surfaces on
 * `/api/orgs/*`, and their empty state is `EMPTY_AGENCY_ACCOUNT` in
 * `lib/agency-server.ts`.
 *
 * The client record fixture in particular was reachable by id: the page looked
 * it up from the URL with no org scoping and no `WTG_USE_MOCK_DATA` gate, so
 * any agency-entitled user could read a fabricated client's name, email, phone
 * and advisor notes. `agency-server.test.ts` still pins that no such record
 * resolves, with the flag on or off.
 */
