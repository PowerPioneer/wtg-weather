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
- **Auth state**: server-side via `cookies()` in RSC, client-side via
  a `useSession()` hook that reads a lightweight `/api/me` endpoint.

## Rules

- Never fetch climate data from the browser; it's baked into PMTiles.
  Browser only fetches: signed tile URL, user's own trips/favourites,
  `/api/me`, and Paddle checkout URLs.
- SSR pages must be renderable with ZERO client JS for SEO — progressive
  enhancement only. Test with JS disabled.
- Use `next/image` for everything non-map. Never `<img>` in RSC.
- No `localStorage` for preferences — use an HttpOnly cookie set via API,
  or URL search params for shareable states.
- Lighthouse budget: LCP < 2.0s, CLS < 0.05, TBT < 100ms. Regressions
  block merge.

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
- `dynamicParams` is **on** everywhere, because the image is built inside
  `docker build` where the API is not reachable and `generateStaticParams` can
  legitimately return nothing. An unknown slug still 404s — `getCountry`
  returns `null` and the page calls `notFound()`. Build with the API up (dev,
  or CI with the stack running) to get the full pre-rendered tree.
- Every SSR page: canonical URL, OpenGraph image (generated at build),
  structured data (`TouristDestination` schema), internal links to
  related months and neighbouring countries.
