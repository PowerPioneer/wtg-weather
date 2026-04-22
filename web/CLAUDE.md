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
  typed `api-client.ts` wrapper.
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

## Routes and SEO

- `/[country]` — `generateStaticParams` over all ~195 countries, static
  at build time, `revalidate: 60*60*24*30` (monthly).
- `/[country]/[month]` — same, 195 × 12 = 2,340 pages.
- `/[country]/[region]` and `/[country]/[region]/[month]` — admin-1 SSR.
- Every SSR page: canonical URL, OpenGraph image (generated at build),
  structured data (`TouristDestination` schema), internal links to
  related months and neighbouring countries.
