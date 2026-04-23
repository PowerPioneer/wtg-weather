/**
 * Mock country data. In production, SSR pages fetch from the internal API
 * (`INTERNAL_API_URL`). In dev and previews, we read from here so the page
 * tree renders without the full pipeline running. `USE_MOCK_DATA` in `env.ts`
 * decides which path is taken.
 *
 * Numbers are grounded placeholders (ERA5-shaped, realistic for each country)
 * copied from `web/design/country/peruData.js` — Phase 5.4 will replace these
 * with real API calls once the pipeline is wired end-to-end.
 */

import type {
  AgencyAccount,
  ClientRecord,
  ConsumerAccount,
  CountryData,
  Monthly,
  RegionRow,
  SessionUser,
  TripData,
} from "./types";

const zeros: Monthly = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const PERU: CountryData = {
  slug: "peru",
  name: "Peru",
  nameLocal: "República del Perú",
  capital: "Lima",
  region: "South America",
  coastal: true,
  hasSnow: true,
  currency: "PEN",
  language: "Spanish, Quechua, Aymara",
  tz: "UTC−5",
  area: "1,285,216 km²",
  population: "34.0M",
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
    r: [148, 168, 142, 72, 28, 12, 8, 12, 28, 62, 88, 118],
    s: [5.8, 5.6, 5.9, 6.8, 7.2, 7.4, 7.6, 7.5, 7.1, 6.6, 6.2, 5.9],
    w: [10.2, 10.8, 11.1, 10.4, 9.8, 10.1, 10.6, 11.2, 11.8, 11.5, 10.9, 10.5],
    snow: [0, 0, 0, 0, 2, 6, 8, 7, 4, 1, 0, 0],
    sst: [22.8, 23.4, 23.2, 22.1, 20.4, 18.9, 18.2, 18.0, 18.4, 19.2, 20.3, 21.6],
    heat: [25.4, 26.1, 25.7, 23.8, 21.2, 19.5, 18.7, 19.0, 19.8, 21.0, 22.7, 24.5],
    hum: [82, 83, 82, 80, 78, 76, 75, 76, 78, 80, 81, 82],
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
    combined: { level: 2, label: "Exercise increased caution", color: "#B88A2E" },
    lastUpdated: "Apr 18, 2026",
    sources: [
      { gov: "United States", level: 2, label: "Exercise increased caution", date: "Apr 12, 2026", url: "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/Peru.html" },
      { gov: "United Kingdom", level: 2, label: "See our travel advice", date: "Apr 15, 2026", url: "https://www.gov.uk/foreign-travel-advice/peru" },
      { gov: "Canada", level: 2, label: "Exercise a high degree of caution", date: "Apr 10, 2026", url: "https://travel.gc.ca/destinations/peru" },
      { gov: "Australia", level: 1, label: "Exercise normal safety precautions", date: "Apr 16, 2026", url: "https://www.smartraveller.gov.au/destinations/americas/peru" },
      { gov: "Germany", level: 2, label: "Teilreisewarnung", date: "Apr 14, 2026", url: "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/peru-node" },
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

const JAPAN: CountryData = derive({
  slug: "japan",
  name: "Japan",
  nameLocal: "日本",
  capital: "Tokyo",
  region: "Asia",
  coastal: true,
  hasSnow: true,
  currency: "JPY",
  language: "Japanese",
  tz: "UTC+9",
  area: "377,975 km²",
  population: "125.7M",
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
    r: [52, 56, 118, 124, 138, 168, 153, 168, 210, 197, 92, 51],
    s: [6.1, 6.0, 5.8, 6.0, 5.6, 4.4, 5.5, 6.3, 4.6, 4.8, 5.2, 5.4],
    w: [11.0, 11.4, 12.0, 12.2, 11.6, 11.0, 11.4, 11.8, 12.2, 11.6, 11.0, 10.8],
    snow: [4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    sst: [14.1, 13.6, 14.2, 16.1, 18.8, 21.8, 24.9, 26.4, 25.1, 22.2, 18.6, 15.4],
    heat: [5.0, 5.6, 8.6, 14.0, 19.2, 24.3, 28.9, 30.7, 25.2, 18.8, 12.6, 7.2],
    hum: [52, 53, 58, 62, 66, 75, 77, 73, 72, 66, 60, 55],
  },
  regions: [],
  advisories: {
    combined: { level: 1, label: "Exercise normal precautions", color: "#7AA67A" },
    lastUpdated: "Apr 18, 2026",
    sources: [
      { gov: "United States", level: 1, label: "Exercise normal precautions", date: "Apr 12, 2026", url: "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/Japan.html" },
      { gov: "United Kingdom", level: 1, label: "See our travel advice", date: "Apr 15, 2026", url: "https://www.gov.uk/foreign-travel-advice/japan" },
      { gov: "Canada", level: 1, label: "Exercise normal security precautions", date: "Apr 10, 2026", url: "https://travel.gc.ca/destinations/japan" },
      { gov: "Australia", level: 1, label: "Exercise normal safety precautions", date: "Apr 16, 2026", url: "https://www.smartraveller.gov.au/destinations/asia/japan" },
      { gov: "Germany", level: 1, label: "Keine Reisewarnung", date: "Apr 14, 2026", url: "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/japan-node" },
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

const ICELAND: CountryData = derive({
  slug: "iceland",
  name: "Iceland",
  nameLocal: "Ísland",
  capital: "Reykjavík",
  region: "Europe",
  coastal: true,
  hasSnow: true,
  currency: "ISK",
  language: "Icelandic",
  tz: "UTC+0",
  area: "103,000 km²",
  population: "0.4M",
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
    r: [76, 72, 82, 58, 44, 50, 52, 62, 68, 86, 73, 79],
    s: [0.5, 1.9, 3.6, 4.8, 5.8, 6.2, 5.9, 5.4, 4.1, 2.6, 0.9, 0.2],
    w: [22.4, 21.8, 21.2, 19.6, 17.8, 16.4, 15.8, 16.2, 18.4, 20.1, 21.4, 22.2],
    snow: [14, 12, 10, 4, 1, 0, 0, 0, 1, 3, 8, 12],
    sst: [6.4, 5.8, 5.4, 5.6, 6.8, 8.4, 10.2, 10.6, 9.8, 8.4, 7.2, 6.6],
    heat: [-0.2, 0.4, 0.9, 3.1, 6.8, 9.9, 11.8, 11.2, 8.6, 5.2, 2.0, 0.0],
    hum: [80, 79, 77, 74, 74, 76, 78, 80, 80, 80, 81, 81],
  },
  regions: [],
  advisories: {
    combined: { level: 1, label: "Exercise normal precautions", color: "#7AA67A" },
    lastUpdated: "Apr 18, 2026",
    sources: [
      { gov: "United States", level: 1, label: "Exercise normal precautions", date: "Apr 12, 2026", url: "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/Iceland.html" },
      { gov: "United Kingdom", level: 1, label: "See our travel advice", date: "Apr 15, 2026", url: "https://www.gov.uk/foreign-travel-advice/iceland" },
      { gov: "Canada", level: 1, label: "Exercise normal security precautions", date: "Apr 10, 2026", url: "https://travel.gc.ca/destinations/iceland" },
      { gov: "Australia", level: 1, label: "Exercise normal safety precautions", date: "Apr 16, 2026", url: "https://www.smartraveller.gov.au/destinations/europe/iceland" },
      { gov: "Germany", level: 1, label: "Keine Reisewarnung", date: "Apr 14, 2026", url: "https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/island-node" },
    ],
  },
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
    role: "consumer",
    signedInAt: "Today · Lyon · Safari 17",
    memberSince: "Mar 2026",
  },
  premium: {
    id: "usr_lea",
    name: "Léa Marchetti",
    email: "lea.marchetti@gmail.com",
    plan: "premium",
    role: "consumer",
    signedInAt: "Today · Lyon · Safari 17",
    memberSince: "Sep 2024",
  },
  agency: {
    id: "usr_elena",
    name: "Elena Quiroz",
    email: "elena@cordillera.tours",
    plan: "agency_pro",
    role: "agency_owner",
    signedInAt: "2 min ago · Lima · Chrome",
    memberSince: "Feb 2024",
    org: {
      id: "org_cordillera",
      name: "Cordillera Voyages",
      slug: "cordillera",
      plan: "agency_pro",
      seatCap: 10,
      seatsUsed: 7,
      ownerName: "Elena Quiroz",
      memberSince: "Feb 2024",
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

const HONEYMOON_TRIP: TripData = {
  id: "trp_8h2k9p",
  title: "Honeymoon · Andes & Sacred Valley",
  country: "Peru",
  countrySlug: "peru",
  months: ["April", "May"],
  year: 2026,
  score: 87,
  shareUrl: "atlasweather.io/t/8h2k9p-honeymoon",
  createdAt: "Apr 12, 2026",
  updatedAt: "Apr 22, 2026",
  ownerUserId: "usr_elena",
  owner: {
    kind: "agency",
    agency: "Cordillera Voyages",
    orgSlug: "cordillera",
    client: "M. & A. Westfield",
    clientId: "cli_westfield_8421",
    plan: "Agency Pro",
  },
  prefs: {
    free: [
      { key: "temp", label: "Temperature", range: "14 – 22 °C", icon: "temp", matched: true },
      { key: "rain", label: "Rainfall", range: "< 60 mm / mo", icon: "rain", matched: true },
      { key: "sun", label: "Sunshine", range: "> 6 hr / day", icon: "sun", matched: true },
      { key: "wind", label: "Wind speed", range: "< 25 km/h", icon: "wind", matched: true },
      { key: "safety", label: "Safety", range: "Level 2 or safer", icon: "shield", matched: true },
    ],
    premium: [
      { key: "snow", label: "Snow depth", range: "0 cm at lodging", matched: true },
      { key: "sst", label: "Sea surface", range: "> 18 °C (Pacific)", matched: true },
      { key: "heat", label: "Heat index", range: "< 30 °C feels-like", matched: true },
      { key: "humidity", label: "Humidity", range: "40 – 70 %", matched: true },
    ],
  },
  destinations: [
    { rank: 1, region: "Cusco", country: "Peru", score: 93, t: "13 / 20 °C", r: "52 mm", s: "7.0 hr", tag: "Sacred Valley · Machu Picchu" },
    { rank: 2, region: "Arequipa", country: "Peru", score: 91, t: "11 / 22 °C", r: "8 mm", s: "8.4 hr", tag: "Colca Canyon · white city" },
    { rank: 3, region: "Moquegua", country: "Peru", score: 89, t: "12 / 23 °C", r: "4 mm", s: "8.6 hr", tag: "Quiet south coast" },
    { rank: 4, region: "Apurímac", country: "Peru", score: 88, t: "10 / 21 °C", r: "32 mm", s: "7.3 hr", tag: "Choquequirao trek" },
    { rank: 5, region: "Tacna", country: "Peru", score: 87, t: "14 / 23 °C", r: "0 mm", s: "8.7 hr", tag: "Border desert" },
    { rank: 6, region: "Ayacucho", country: "Peru", score: 86, t: "11 / 22 °C", r: "38 mm", s: "7.0 hr", tag: "Colonial highland" },
    { rank: 7, region: "Huancavelica", country: "Peru", score: 85, t: "6 / 17 °C", r: "46 mm", s: "6.8 hr", tag: "High páramo" },
    { rank: 8, region: "Áncash", country: "Peru", score: 84, t: "10 / 21 °C", r: "40 mm", s: "6.9 hr", tag: "Cordillera Blanca · Huaraz" },
    { rank: 9, region: "Junín", country: "Peru", score: 83, t: "6 / 18 °C", r: "60 mm", s: "6.6 hr", tag: "Mantaro valley" },
    { rank: 10, region: "Puno", country: "Peru", score: 82, t: "4 / 17 °C", r: "38 mm", s: "7.2 hr", tag: "Lake Titicaca · altiplano" },
  ],
};

export const TRIP_FIXTURES: Record<string, TripData> = {
  "trp_8h2k9p": HONEYMOON_TRIP,
};

export function findTripData(id: string): TripData | null {
  return TRIP_FIXTURES[id] ?? null;
}

// ─── Consumer account fixtures (keyed by session id) ─────────────────

const FREE_ACCOUNT: ConsumerAccount = {
  trips: [],
  favourites: [],
  alerts: [],
  invoices: [],
  activity: [
    { date: "Today", text: "Welcome to Atlas Weather. Magic link sent to sam.patel@hey.com", tag: "AUTH" },
    { date: "Today", text: "Account created · Free plan", tag: "PLAN" },
  ],
};

const PREMIUM_ACCOUNT: ConsumerAccount = {
  renewsAt: "Sep 14, 2026",
  price: "€2.99 / mo",
  trips: [
    { id: "trp_8h2k9p", title: "Honeymoon · Andes & Sacred Valley", months: "Apr – May", country: "Peru", score: 87, regions: 10, updated: "2d ago" },
    { id: "trp_4n7q2m", title: "Backpack Japan", months: "Oct – Nov", country: "Japan", score: 92, regions: 14, updated: "1w ago" },
    { id: "trp_2c5x1v", title: "Family Christmas — somewhere warm", months: "Dec", country: "Multi · 8", score: 84, regions: 22, updated: "3w ago" },
  ],
  favourites: [
    { slug: "peru", name: "Peru", sub: "Andes + coast + Amazon", best: "Jun – Aug" },
    { slug: "japan", name: "Japan", sub: "Honshu temperate", best: "Apr · Oct – Nov" },
    { slug: "portugal", name: "Portugal", sub: "Atlantic Mediterranean", best: "May – Sep" },
    { slug: "morocco", name: "Morocco", sub: "Coast & High Atlas", best: "Mar – May · Oct" },
    { slug: "norway", name: "Norway", sub: "Fjords & Lofoten", best: "Jun – Aug" },
  ],
  alerts: [
    { id: "a1", label: "Notify me when Cusco scores 90+ for July with my honeymoon prefs", cadence: "Daily", last: "Apr 22 · score 87 (no change)", on: true },
    { id: "a2", label: "Email me when Peru rainfall in May drops below 30 mm/mo nationally", cadence: "Weekly", last: "Apr 19 · 41 mm (above threshold)", on: true },
    { id: "a3", label: "Alert if any Level-3 advisory is issued for my favourite countries", cadence: "Realtime", last: "No change · 7 countries watched", on: true },
    { id: "a4", label: "Tell me when Japan cherry blossom forecast updates", cadence: "Realtime", last: "Last forecast Mar 02", on: false },
  ],
  invoices: [
    { date: "Apr 14, 2026", id: "INV-29841", amount: "€2.99", status: "Paid" },
    { date: "Mar 14, 2026", id: "INV-28709", amount: "€2.99", status: "Paid" },
    { date: "Feb 14, 2026", id: "INV-27502", amount: "€2.99", status: "Paid" },
    { date: "Jan 14, 2026", id: "INV-26301", amount: "€2.99", status: "Paid" },
  ],
  activity: [
    { date: "Apr 22", text: 'Trip "Honeymoon · Andes & Sacred Valley" updated · Cusco moved 2 pts', tag: "TRIP" },
    { date: "Apr 19", text: 'Alert "Peru rainfall in May < 30 mm" checked · 41 mm (above threshold)', tag: "ALERT" },
    { date: "Apr 14", text: "Favourited Norway", tag: "FAV" },
    { date: "Apr 02", text: 'Trip "Backpack Japan" created from /map?country=japan&month=oct', tag: "TRIP" },
  ],
};

export const CONSUMER_ACCOUNTS: Record<string, ConsumerAccount> = {
  usr_sam: FREE_ACCOUNT,
  usr_lea: PREMIUM_ACCOUNT,
};

export function findConsumerAccount(userId: string): ConsumerAccount | null {
  return CONSUMER_ACCOUNTS[userId] ?? null;
}

// ─── Agency account fixtures ─────────────────────────────────────────

const CORDILLERA_ACCOUNT: AgencyAccount = {
  tripsYTD: 312,
  activeTrips: 84,
  archivedThisMonth: 3,
  team: [
    { id: "tm_elena", name: "Elena Quiroz", email: "elena@cordillera.tours", role: "Owner", last: "2 min ago", trips: 87, status: "active", you: true },
    { id: "tm_matias", name: "Matías Soto", email: "matias@cordillera.tours", role: "Admin", last: "14 min ago", trips: 64, status: "active" },
    { id: "tm_renata", name: "Renata Ibáñez", email: "renata@cordillera.tours", role: "Agent", last: "1 hr ago", trips: 58, status: "active" },
    { id: "tm_carlos", name: "Carlos Mendez", email: "carlos@cordillera.tours", role: "Agent", last: "Yesterday", trips: 41, status: "active" },
    { id: "tm_sofia", name: "Sofía Huamán", email: "sofia@cordillera.tours", role: "Agent", last: "3d ago", trips: 34, status: "active" },
    { id: "tm_javier", name: "Javier Rosales", email: "javier@cordillera.tours", role: "Agent", last: "5d ago", trips: 22, status: "active" },
    { id: "tm_lucia", name: "Lucía Bermúdez", email: "lucia@cordillera.tours", role: "Viewer", last: "Never", trips: 0, status: "invited" },
  ],
  clients: [
    { id: "cli_westfield_8421", name: "Westfield, M. & A.", country: "Peru", trips: 1, last: "2d ago", agent: "Elena Quiroz", tag: "Honeymoon" },
    { id: "cli_hartwell", name: "Hartwell family", country: "Japan", trips: 3, last: "4d ago", agent: "Matías Soto", tag: "Family" },
    { id: "cli_okafor", name: "Okafor, T.", country: "Morocco", trips: 2, last: "1w ago", agent: "Renata Ibáñez", tag: "Solo" },
    { id: "cli_lindqvist", name: "Lindqvist party", country: "Norway", trips: 1, last: "1w ago", agent: "Carlos Mendez", tag: "Group · 6" },
    { id: "cli_dubois", name: "Dubois, C.", country: "Portugal", trips: 2, last: "2w ago", agent: "Sofía Huamán", tag: "Retirement" },
    { id: "cli_patel_singh", name: "Patel-Singh", country: "Peru", trips: 4, last: "3w ago", agent: "Elena Quiroz", tag: "Return client" },
    { id: "cli_yamamoto", name: "Yamamoto, K.", country: "Peru", trips: 1, last: "3w ago", agent: "Matías Soto", tag: "Corporate" },
    { id: "cli_nguyen_tran", name: "Nguyen & Tran", country: "Peru", trips: 2, last: "Apr 01", agent: "Renata Ibáñez", tag: "Honeymoon" },
    { id: "cli_brightman", name: "Brightman, R.", country: "Colombia", trips: 1, last: "Mar 28", agent: "Carlos Mendez", tag: "Solo" },
    { id: "cli_alfassi", name: "Al-Fassi, N.", country: "Bolivia", trips: 3, last: "Mar 22", agent: "Elena Quiroz", tag: "Group · 4" },
    { id: "cli_oconnor", name: "O\u2019Connor, D.", country: "Chile", trips: 1, last: "Mar 18", agent: "Sofía Huamán", tag: "Solo" },
    { id: "cli_weissman", name: "Weissman, H.", country: "Ecuador", trips: 2, last: "Mar 12", agent: "Javier Rosales", tag: "Anniversary" },
  ],
  activity: [
    { t: "2 min ago", who: "Elena Quiroz", act: "shared trip", obj: "Honeymoon · Andes & Sacred Valley", ctx: "for Westfield, M. & A.", kind: "SHARE" },
    { t: "14 min ago", who: "Matías Soto", act: "updated prefs on", obj: "Osaka & Kyoto — Nov", ctx: "temp range 10–22 °C", kind: "EDIT" },
    { t: "58 min ago", who: "Renata Ibáñez", act: "created trip", obj: "Marrakech & Atlas — Oct", ctx: "for Okafor, T.", kind: "CREATE" },
    { t: "1 hr ago", who: "Carlos Mendez", act: "exported PDF", obj: "Arctic Circle · Lofoten", ctx: "Lindqvist party · 12 pp", kind: "EXPORT" },
    { t: "2 hr ago", who: "Elena Quiroz", act: "invited", obj: "lucia@cordillera.tours", ctx: "role: Viewer", kind: "TEAM" },
    { t: "3 hr ago", who: "Matías Soto", act: "archived client", obj: "Feldman, E.", ctx: "trip completed Apr 04", kind: "CLIENT" },
    { t: "Yesterday", who: "Sofía Huamán", act: "created trip", obj: "Douro Valley — Sep", ctx: "for Dubois, C.", kind: "CREATE" },
    { t: "Yesterday", who: "Renata Ibáñez", act: "added alert to", obj: "Morocco coastal swell — Oct", ctx: "weekly · SST > 22 °C", kind: "ALERT" },
    { t: "2d ago", who: "Elena Quiroz", act: "upgraded plan", obj: "Agency Starter → Agency Pro", ctx: "€149 / mo · +7 seats", kind: "BILLING" },
    { t: "2d ago", who: "Carlos Mendez", act: "modified safety threshold", obj: "Colombia · Brightman, R.", ctx: "Level 2 → Level 3 accepted", kind: "EDIT" },
    { t: "3d ago", who: "Matías Soto", act: "duplicated trip", obj: "Cusco Apr 2025 → Cusco Apr 2026", ctx: "for Patel-Singh", kind: "CREATE" },
    { t: "3d ago", who: "Elena Quiroz", act: "changed role", obj: "Javier Rosales", ctx: "Agent → Agent (no change logged)", kind: "TEAM" },
  ],
  invoices: [
    { date: "Apr 14, 2026", id: "INV-AG-01421", amount: "€149", status: "Paid", note: "7 seats × €15 + unused buffer" },
    { date: "Mar 14, 2026", id: "INV-AG-01198", amount: "€149", status: "Paid" },
    { date: "Feb 14, 2026", id: "INV-AG-00985", amount: "€149", status: "Paid" },
    { date: "Jan 14, 2026", id: "INV-AG-00772", amount: "€149", status: "Paid" },
  ],
};

export const AGENCY_ACCOUNTS: Record<string, AgencyAccount> = {
  org_cordillera: CORDILLERA_ACCOUNT,
};

export function findAgencyAccount(orgId: string): AgencyAccount | null {
  return AGENCY_ACCOUNTS[orgId] ?? null;
}

// ─── Client record fixtures ──────────────────────────────────────────

const WESTFIELD_CLIENT: ClientRecord = {
  id: "cli_westfield_8421",
  name: "Westfield, Maya & Adam",
  shortName: "Westfield",
  kind: "Honeymoon party · 2 pax",
  email: "maya.westfield@gmail.com",
  phone: "+1 (415) 555-0117",
  city: "San Francisco, CA",
  since: "Mar 14, 2026",
  primaryAgent: { name: "Elena Quiroz", role: "Owner", email: "elena@cordillera.tours" },
  tags: ["Honeymoon", "High-budget", "Repeat referral"],
  nextTouch: "May 02 · check in before trip",
  trips: [
    { id: "trp_8h2k9p", title: "Honeymoon · Andes & Sacred Valley", country: "Peru", months: "Apr – May", created: "Apr 12", updated: "2d ago", agent: "Elena Quiroz", score: 87, status: "shared" },
    { id: "trp_3p8w2k", title: "Scouting · Lake District", country: "Chile", months: "Feb", created: "Mar 22", updated: "3w ago", agent: "Elena Quiroz", score: 82, status: "draft" },
  ],
  prefs: {
    ranges: [
      { key: "temp", label: "Temperature", value: "14 – 22 °C daytime", icon: "temp" },
      { key: "rain", label: "Rainfall", value: "< 60 mm / month", icon: "rain" },
      { key: "sun", label: "Sunshine", value: "≥ 6 hours / day", icon: "sun" },
      { key: "wind", label: "Wind", value: "< 25 km/h average", icon: "wind" },
      { key: "safety", label: "Safety ceiling", value: "Level 2 or safer", icon: "shield" },
      { key: "humidity", label: "Humidity", value: "40 – 70 %", pro: true },
      { key: "heat", label: "Heat index", value: "< 30 °C feels-like", pro: true },
    ],
    restrictions: [
      { label: "Dietary", value: "Vegetarian (Maya) · no pork (Adam)" },
      { label: "Mobility", value: "No issues · both fit, hikers" },
      { label: "Altitude", value: "First time > 3,000 m · acclimatisation day required" },
      { label: "Flights", value: "Economy plus preferred · no red-eyes" },
      { label: "Budget", value: "€12,000 · flexible +15%" },
      { label: "Languages", value: "English · some French" },
    ],
  },
  notes: [
    {
      author: "Elena Quiroz",
      when: "Apr 22",
      kind: "call",
      body: "Post-proposal call. Both loved the Sacred Valley option. Flagged: Maya gets altitude headaches — we should plan the Cusco arrival as a rest day, not a tour day. Mention Colca as a softer alternative on Day 6 if needed.\n\nAdam asked about internet on trek — OK to tell them \"patchy, assume offline two days\".",
    },
    {
      author: "Matías Soto",
      when: "Apr 18",
      kind: "internal",
      body: "Cross-checked June availability at **Inkaterra Hacienda Urubamba** — held two nights on soft option. Expires **May 10**.",
    },
    {
      author: "Elena Quiroz",
      when: "Apr 12",
      kind: "client",
      body: "Kickoff · 45 min video. Honeymoon in May, can shift a week either side. Must-haves: Machu Picchu, one hike ≥ half day, zero Lima tourist circuit, finish on a beach somewhere.\n\nTentatively split: 6 nights Sacred Valley + 3 nights Pacific coast. Exploring Máncora vs. Paracas.",
    },
    {
      author: "Renata Ibáñez",
      when: "Mar 14",
      kind: "lead",
      body: "Intake from referral (Patel-Singh). Dates \"flexible, Q2 2026\". Budget stated 12k€ for two. No agency history.",
    },
  ],
  activity: [
    { t: "2d ago", who: "Elena Quiroz", act: "shared trip", obj: "Honeymoon · Andes & Sacred Valley", kind: "SHARE" },
    { t: "2d ago", who: "Elena Quiroz", act: "updated prefs", obj: "temperature 12–20 → 14–22 °C", kind: "EDIT" },
    { t: "3d ago", who: "Matías Soto", act: "added note", obj: "Inkaterra Hacienda Urubamba hold", kind: "NOTE" },
    { t: "5d ago", who: "Elena Quiroz", act: "exported PDF", obj: "Honeymoon · Andes & Sacred Valley", kind: "EXPORT" },
    { t: "Apr 18", who: "Matías Soto", act: "viewed trip", obj: "Honeymoon · Andes & Sacred Valley", kind: "VIEW" },
    { t: "Apr 14", who: "Elena Quiroz", act: "added tag", obj: '"High-budget"', kind: "TAG" },
    { t: "Apr 12", who: "Elena Quiroz", act: "created trip", obj: "Honeymoon · Andes & Sacred Valley", kind: "CREATE" },
    { t: "Apr 12", who: "Elena Quiroz", act: "added note", obj: "Kickoff call summary", kind: "NOTE" },
    { t: "Mar 22", who: "Elena Quiroz", act: "created trip", obj: "Scouting · Lake District", kind: "CREATE" },
    { t: "Mar 14", who: "Renata Ibáñez", act: "created client record", obj: "—", kind: "CREATE" },
    { t: "Mar 14", who: "Renata Ibáñez", act: "added note", obj: "Lead intake", kind: "NOTE" },
    { t: "Mar 14", who: "System", act: "assigned primary agent", obj: "Elena Quiroz", kind: "SYSTEM" },
  ],
};

export const CLIENT_RECORDS: Record<string, ClientRecord> = {
  cli_westfield_8421: WESTFIELD_CLIENT,
};

export function findClientRecord(id: string): ClientRecord | null {
  return CLIENT_RECORDS[id] ?? null;
}
