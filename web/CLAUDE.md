# Web — Next.js 15 App Router

TypeScript strict. Tailwind v4. shadcn/ui (copy-paste, living in `components/ui`).

## Setup

```bash
cd web
pnpm install
pnpm dev
```

## Architecture

- **Server Components by default.** Only mark `"use client"` when you need
  state, effects, or browser APIs. The map container is a Client Component;
  the SSR country/region pages are Server Components that fetch from the API.
- **Data fetching**: SSR pages use `fetch(...)` to the internal API via
  `INTERNAL_API_URL` (docker network hostname). Client components use the
  typed `api-client.ts` wrapper. `WTG_USE_MOCK_DATA=1` swaps in the fixtures
  for a `pnpm dev` with no API running — it is opt-**in**, and must stay that
  way (it used to default on, which shipped a three-country site treating every
  visitor as premium).
- **Never read cookies or headers in the root layout.** A dynamic API there
  opts every route in the app out of static generation, including the ~2,800
  country pages below. The analytics split that used to need the session is
  resolved client-side in `AnalyticsSwitch` for exactly this reason.
- **Map stack**: `react-map-gl/maplibre` + `pmtiles` package registers the
  `pmtiles://` protocol on MapLibre. Style is a single JSON object in
  `lib/map-style.ts`. Paint expressions read `feature.properties.score`
  (0-3) and map to colours. Recomputing score on preference change
  happens client-side by updating style paint expressions — no re-fetch.
- **Scoring** lives in `lib/scoring.ts`. Pure functions, unit-tested,
  shared between the map paint expressions and the SSR pages.
- **The 0–100 score is never rendered.** It is how the rule, the paint
  expression and every sort order work, and it stops there: the rule has four
  outcomes, not a hundred (the four values are bucket centroids), so a numeral
  claimed a precision it does not have. Every surface shows one of four words —
  Perfect match / Good option / Acceptable / Avoid — via `ScoreBadge`,
  `ScoreGauge`, `MatchTooltip` or `ScoreRamp`. Do not reintroduce a numeral,
  a percentage, an "x/100", or a proportional gauge arc.
- **The safety limit is a veto, not a fourth variable.** `WeatherPreferences.
  safetyMax` (1–4, default 3) drops any place whose baked `safety` level is
  worse than it to "Avoid", whatever the weather does. It is applied in
  `scoreBucket`, in `readPreferenceScore` (both the baked and the computed
  path) and in `buildFillColorExpression`, which must agree — `map-style.test.
  ts` pins them together. It is deliberately absent from the pipeline's
  `pref_<mm>`: the answer differs per traveller, and the advisory moves weekly
  while the climatology moves yearly. Hence two predicates —
  `isDefaultPreferences` (climate only, decides whether the map may read the
  baked score) and `isDefaultPreferenceSet` (everything, for UI affordances).
- **Rainfall is chosen as a level, scored as a ceiling.** `RAIN_LEVELS` maps
  five words to mm/day ceilings. Four are the band's upper edge; "Light rain"
  selects **2.7**, the pipeline's own default, so that picking the default band
  cannot recolour the map for a traveller who changed nothing.
- **Units**: `lib/units.ts` converts and formats; every stored and scored value
  stays metric and is converted only at render. The preference is resolved in
  the browser by `UnitProvider` because country pages are statically generated,
  and it lives in a **readable** `wtg_unit` cookie — the one deliberate
  exception to the HttpOnly rule below, because client JS cannot read an
  HttpOnly cookie and a static page has no other way to know. Precedence:
  `?unit=` → cookie → metric. Signed-in users also carry it in their account
  record (`useStoredPreferences`), which loses to this browser's cookie.
  Render through `components/units` (`<Temperature>`, `<RainfallMonthly>`, …)
  rather than interpolating a unit into a string; note `<TemperatureDelta>`
  exists because a *difference* converts by ratio without the +32 offset.
- **Auth state**: server-side via `cookies()` in RSC, client-side via
  a `useSession()` hook that reads a lightweight `/api/me` endpoint.

## Rules

- Never fetch climate data from the browser; it's baked into PMTiles.
  Browser only fetches: signed tile URL, user's own trips/favourites,
  `/api/me`, Paddle transaction ids, and Paddle.js itself.
- **Checkout is an overlay, opened by transaction id.** The API creates the
  transaction after checking session and membership (`api/CLAUDE.md`), and
  `lib/paddle.ts` opens it — the browser never names a price and never composes
  `custom_data`. Paddle.js does now load in the browser, which the old contract
  forbade; that could not survive Paddle Billing, and it is confined to
  `lib/paddle.ts` and `/checkout/pay`. `/checkout/pay` is our **default payment
  link**, which Paddle requires before it will create any transaction at all
  and emails to customers for payment-method updates — it is not dead code.
- **The upgrade path is no longer no-JS.** `/upgrade` is still a real server
  route, still where `/login?next=` returns to, and still what every CTA anchor
  points at — but it redirects to a page that needs Paddle.js to open the
  checkout. Paddle Billing has no server-rendered checkout to redirect to, so
  this is a constraint rather than a regression to fix.
- SSR pages must be renderable with ZERO client JS for SEO — progressive
  enhancement only. Test with JS disabled.
- Use `next/image` for everything non-map. Never `<img>` in RSC.
- No `localStorage` for preferences — use an HttpOnly cookie set via API,
  or URL search params for shareable states. The one exception is `wtg_unit`
  (see Units above): it must be readable by client JS on a static page, it
  carries one of two words, and it is mirrored into the account record.
- Lighthouse budget: LCP < 2.0s, CLS < 0.05, TBT < 100ms. Regressions
  block merge. `ClimateChart` is a Client Component *only* so it can convert
  to °F/inches; it still server-renders its SVG, so a no-JS reader gets the
  whole chart.
- Mobile: the header wraps the full product name onto two tight lines below
  `sm` and collapses its nav into a `<details>` disclosure (no client JS, works
  with JS disabled). The climate panel is a bottom sheet on a phone and must
  stay dismissable by dragging it down — `useDragDismiss`; a corner × alone is
  not reachable with a thumb, and every native bottom sheet closes that way.

## Design reference

The canonical visual design for every screen lives in `web/design/`. Claude Code
implementing Phase 5 MUST match the visual language defined there (colours,
spacing, typography, component patterns). If a design artifact conflicts with a
technical constraint (a11y, performance budget, framework limitation), flag it
and propose an alternative rather than silently deviating.

Entry points (read in this order):

1. `web/design/HANDOFF.md` — design→engineering handoff, Phase 5 implementation plan
2. `web/design/tokens.md` — colour / type / spacing / motion spec (single source of truth)
3. `web/design/tailwind.theme.css` — Tailwind v4 `@theme` block, drop into `globals.css` verbatim
4. `web/design/components.md` — component tree and prop signatures
5. `web/design/AUDIT.md` — cross-screen consistency fixes to carry into implementation
6. `web/design/system.html` — live, interactive token viewer (open in browser)

Layout references (pixel-level source of truth — the `* Final.html` files
supersede earlier drafts):

- Pricing → `Pricing Final.html` · Country → `Country Page Final.html`
- Per-month → `Peru April.html` · Desktop map → `Desktop Map.html`
- Mobile map → `Mobile Map.html` · Display mode → `Display Mode.html`
- Trip detail → `Trip Detail.html` · Account → `Account.html`
- Agency → `Agency.html` · Client detail → `Client Detail.html`
- Auth → `Auth & Onboarding.html` · Upgrades → `Upgrades & Empty States.html`

JSX/CSS reference implementations for each screen live in `web/design/{map,
country,pricing,trip,account,mobile,display-mode,directions}/`.

Direction is locked to **Atlas** (light-only, credibility-first). Do not
re-litigate the design decisions listed in `HANDOFF.md` § "already made".

## Routes and SEO

- The route set comes from the API's published index (`/v1/countries`), not
  from the country registry: the registry is every ISO-2 code a *polygon* can
  carry, which is a larger set than the countries the pipeline has a complete
  climate series for. `routableCountries()` is the single gate.
- `/[country]` — `generateStaticParams` over every published country, static
  at build time, `revalidate: 60*60*24*30` (monthly).
- `/[country]/[month]` — same, ~195 × 12 pages.
- `/[country]/[region]` and `/[country]/[region]/[month]` — admin-1, rendered
  on demand and cached. ~4,600 admin-1 units × 12 months is ~55,000 pages;
  pre-rendering that is a batch job, not a build.
- `dynamicParams` is **on** everywhere, because `generateStaticParams` can
  legitimately return nothing when the API is unreachable (a `pnpm build` with
  no stack up). An unknown slug still 404s — `getCountry` returns `null` and
  the page calls `notFound()`.
- A production image is built with the API reachable so the country tree
  actually pre-renders — use `./infra/scripts/build-web.sh`, not
  `docker compose build web`. It puts the build on the compose network and
  passes the API by IP (the sandbox can route there but cannot resolve `api`),
  then checks the pre-render happened. Without it the build still succeeds and
  the site is still correct; every country page just renders on its first
  request instead.
- Every SSR page: canonical URL, OpenGraph image (generated at build),
  structured data (`TouristDestination` schema), internal links to
  related months and neighbouring countries.
