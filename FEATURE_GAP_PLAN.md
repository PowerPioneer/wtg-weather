# Feature-Gap Diagnostic & Fix Plan

Written 2026-08-04 after decoding the shipped PMTiles and auditing the web, API,
and pipeline code against `REBUILD_PLAN.md`. Each workstream below is scoped so
a single focused Claude Code (Opus) session can complete and verify it.
Workstream 1 blocks everything visual — do it first. 2–5 are independent of
each other once 1 lands.

---

## Part 1 — Confirmed root causes (with evidence)

### RC-1. Admin-1 boundaries only cover 9 countries → holes + vanishing countries

Decoding `tiles/free.pmtiles` and `tiles/premium.pmtiles` shows the `admin1`
layer contains features for exactly **9 countries**: `AU BR CA CN ID IN RU US ZA`.
The `country` layer has 228 ISO codes — including Georgia (`GE`) — but is
missing exactly the 10 `SUPPRESSED_COUNTRIES`
(`pipeline/src/wtg_pipeline/processing/country_rules.py:36`): RU CA US CN AU BR
IN AR KZ CL. That is by design — suppressed countries are supposed to render as
an admin-1 mosaic (`web/src/lib/map-style.ts:207`).

Root cause: the pipeline downloads **Natural Earth 1:50m admin-1**
(`pipeline/src/wtg_pipeline/sources/geoboundaries.py:38`), and NE only ships
admin-1 subdivisions for the largest countries at 50m/110m scale. Global
admin-1 coverage exists only in the **1:10m** dataset
(`ne_10m_admin_1_states_provinces`, ~4,600 features). The comment at
`pipeline/src/wtg_pipeline/processing/aggregate.py:294` shows this was known
("NE 50m only ships subdivisions for the largest countries") but treated as a
fallback case instead of fixed at the source.

User-visible consequences:

1. **Argentina, Chile, Kazakhstan are permanent holes at every zoom.** They are
   suppressed (no country feature) *and* have no admin-1 features, so the
   mosaic layer paints nothing. The other 7 suppressed countries happen to be
   in the 9-country set, which is why the bug looks country-specific.
2. **Every country except those 9 vanishes at mid-zoom.** The country fill
   layer stops at zoom 3.5 (`ZOOM_COUNTRY_MAX`, `web/src/lib/map-style.ts:58`),
   the admin-1 band runs 3.0–6.5 — but admin-1 has data for only 9 countries.
   Zooming into the Caucasus past z3.5 makes Georgia (present in tiles!)
   disappear while Russia stays painted. This is the reported "Georgia missing"
   symptom.
3. **The mainland whitelist never actually applies.** `apply_country_rules`
   (`aggregate.py:256`) recomputes FR/ES/NL/DK/PT/NO/GB/EC country means from
   admin-1 rows — none of those countries have admin-1 rows, so every one hits
   the "falling back to naive country aggregate" warning path. France's average
   still includes French Guiana etc. Silent data-quality defect, fixed by the
   same source switch.

Note: the aggregation cache (`data/intermediate/aggregated/admin1.parquet`) is
returned as-is unless `--force` (`aggregate.py:226`), so switching the download
URL alone changes nothing — the rebuild must force re-aggregation.

### RC-2. Premium tiles have no `admin2` layer at all

Decoded `tiles/premium.pmtiles` metadata: `vector_layers = [admin1, country]`.
The premium tier's headline feature (district-level zoom) is absent.
`run_build_pmtiles` (`pipeline/src/wtg_pipeline/pipeline_runner.py:349`) treats
missing admin-2 GeoJSON as a warning and builds anyway — so the failure was
silent. Either the geoBoundaries ADM2 download/aggregation never ran on the
build machine, or its percentiles were missing.

### RC-3. The web's country registry is 9 mock entries → clicks do nothing

`web/src/lib/countries.ts` contains 9 hard-coded countries (comment: "Expanded
to ~195 countries in Phase 5.4" — never happened). The map click handler
(`web/src/app/map/map-experience.tsx:91`) looks the clicked feature's `iso_a2`
up in that list and **silently returns** on a miss. So clicking works for at
most 9 countries and is a no-op everywhere else — the reported "can't click any
country". There is also no hover tooltip / climate panel on the map, so a
successful click's only effect is navigation, which makes even the working
cases feel dead.

### RC-4. "My preferences" does not exist as a feature

- There is **no PreferencesPanel component** anywhere in `web/src` (the plan's
  Phase 5 deliverable; design reference exists in `web/design/map/`).
- The "My Preferences" display mode paints the **baked default** `pref_<mm>`
  property computed by the pipeline with `DEFAULT_PREFERENCES`
  (`pipeline/src/wtg_pipeline/tiles/build_geojson.py:140`). No UI can change it.
- `web/src/lib/scoring.ts` contains only bin/label/colour helpers — the actual
  preference→score function required by `web/CLAUDE.md` ("shared between the
  map paint expressions and the SSR pages") was never written.
- The onboarding wizard collects preferences (`step-preferences.tsx`) but they
  are never applied to the map.

The raw ingredients are already in the tiles (`t_<mm>`, `r_<mm>`, `s_<mm>` p50
aliases per feature), so client-side scoring via paint expressions is possible
without a tile rebuild.

### RC-5. Safety mode has no data

The web expects a month-less `safety` feature property
(`web/src/lib/display-modes.ts:261`). The pipeline never emits any advisory
property — `build_geojson.py` has no advisory join at all. The five scrapers
exist (`pipeline/src/wtg_pipeline/sources/advisories/`) but their output goes
nowhere. The Safety display mode paints every polygon as missing-grey.

### RC-6. SSR country pages run on mocks; API contract mismatch

- `web/src/lib/api-client.ts:42` calls `GET /v1/countries/{slug}`; the API
  implements `GET /api/public/country/{iso2}` returning a placeholder with
  `climate: None` (`api/src/wtg_api/routers/public.py`). Different path,
  different key, no data — the real path has never worked.
- Production therefore effectively depends on `USE_MOCK_DATA`, and mock data
  covers ~3 countries; every other `/[country]` page 404s.
- `web/src/lib/session.ts:27` defaults the mock session to **"premium"** —
  with mocks on, every visitor is treated as premium.

### RC-8. Premium-only variables can never paint above admin-2 zoom

`web/src/lib/map-style.ts` sources **every** country and admin-1 layer from
`FREE_SOURCE_ID`. The premium archive is consulted for exactly one thing —
the `admin2` layer at zoom ≥ 6 (`map-style.ts:256`).

The pipeline does emit the premium variables into premium's country and
admin-1 GeoJSON (`PREMIUM_VARIABLES`, `build_geojson.py:77`), but the map never
reads those layers from the premium file. So a paying user who selects Snow
depth, Sea surface temp, Heat index or Humidity sees the *free* country/admin-1
polygons, which carry no such property, and the map paints entirely
missing-grey until they zoom past 6.

Two candidate fixes, and this is a product decision rather than a purely
technical one:

1. Point the country/admin-1 layers at `PREMIUM_SOURCE_ID` when a premium
   tile URL is present (rebuild the style on entitlement change). Costs a
   style rebuild, keeps one archive per tier.
2. Stop duplicating country/admin-1 into the premium archive and instead
   serve premium variables as a separate overlay source.

Option 1 is the smaller change. Note that premium's country/admin-1 duplication
is also what pushes its low-zoom tiles past tippecanoe's 500KB budget — the
premium build reports dropping up to 70% of features in some z1/z2 tiles
(`--drop-densest-as-needed`), whereas the free build drops nothing.

### RC-9. Wind is sold as a free variable but is absent from free tiles

`REBUILD_PLAN.md` § Pricing says the free tier includes "temp/rain/sun **+
wind**", and `display-modes.ts:124` marks the wind mode `tier: "free"`, so the
picker offers it to everyone. But `FREE_VARIABLES` / `FREE_SOURCE_VARIABLES`
(`build_geojson.py:76`, `:91`) omit `si10` entirely — free tiles carry no
`w_<mm>` property at any level.

Effect: every free user who picks "Wind speed" gets a fully grey map. Premium
users only see wind at admin-2 zoom, per RC-8.

Fix is one line — add `si10` to both free tuples — but it widens what the free
tier gives away and needs a tile rebuild, so it should be an explicit product
call rather than a silent change.

### RC-10. The map resets to world view every ~14 minutes

`map-canvas.tsx:100` keys the map-construction effect on
`[freeTilesUrl, premiumTilesUrl]`, and the effect body calls `map.remove()` and
builds a **new** `maplibregl.Map` at `INITIAL_CENTER` / `INITIAL_ZOOM`.

Tile URLs are signed for 15 minutes and `useTileUrls` re-signs them 60 seconds
before expiry (`use-tile-urls.ts:26`). Every refresh therefore produces a new
URL string, tears the map down, and drops the user back at world view — losing
their pan, zoom, and any hover state, roughly every 14 minutes, on both tiers.

Fix: keep the map instance and swap the style (or just the source URLs) in
place, rather than reconstructing on URL change; or hold the viewport in a ref
and restore it. This matters for RC-8 option 1, which makes the base layers
depend on the premium URL as well.

### RC-7. Minor but real

- `country` layer contains `iso_a2 = "-99"` features (Natural Earth sentinel
  for disputed/missing ISO codes) — unclickable, unroutable.
- `SUPPRESSED_COUNTRIES` is duplicated in Python and TS
  (`country_rules.py` / `map-style.ts:44`) with a keep-in-sync comment and no
  test enforcing it.
- Tile-content regression tests don't exist — RC-1 and RC-2 shipped silently.

---

## Part 2 — Feature diagnostic: plan vs. reality

| Feature (source: REBUILD_PLAN / CLAUDE.md) | Status |
|---|---|
| Country-level climate map, all ~195 countries | ⚠️ Broken for 10 suppressed countries (3 permanently invisible); all countries vanish at z3.5–6.5 except 9 (RC-1) |
| Admin-1 layer at mid-zoom | ❌ 9 countries only (RC-1) |
| Admin-2 premium zoom | ❌ Layer absent from premium tiles (RC-2); web gate/layer code exists |
| Preferences panel + client-side re-scoring | ❌ Not implemented (RC-4) |
| Month selector | ✅ Works (prev/next nudge on map) |
| Display modes: temp / rain / sun / wind, premium snow / SST / heat / humidity | ✅ Painted from tile props (data present in tiles) |
| Safety / advisory overlay | ❌ No data in tiles; scrapers orphaned (RC-5) |
| Click country → country page | ❌ Dead for all but 9 mock-registry countries (RC-3) |
| Hover tooltip / climate info panel on map | ❌ Components exist (`match-tooltip`, charts) but not wired into the map |
| SSR `/[country]` and `/[country]/[month]` pages, ~195 × 12 | ❌ Mock-backed, 3 countries; real API path mismatched and returns placeholder (RC-6) |
| Region (admin-1) SSR pages | ❌ Same as above |
| Auth (magic link + Google), sessions | ✅ API implemented (per Phase 4); web login UI exists |
| Tile signing + entitlements + Paddle | ✅ Implemented and previously fixed in production |
| Trips / favourites / account dashboard | ⚠️ UI exists, backed by mock data (`session.ts`, `account/*`); API routers exist — wiring unverified |
| Legend, upgrade prompts, display-mode picker | ✅ Implemented |

---

## Part 3 — Fix plan (ordered workstreams for Opus)

### WS-1 · Pipeline: global admin-1 + admin-2 + full tile rebuild  «blocker»

> **Status: code complete, production data rebuild outstanding.** See
> § "WS-1 progress" at the end of this document for what landed, what was
> discovered during implementation, and the exact commands still to run on the
> build box.


1. In `pipeline/src/wtg_pipeline/sources/geoboundaries.py` switch
   `NATURAL_EARTH_ADMIN1_URL` to the 10m dataset
   (`https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip`)
   and rename the target file accordingly (update
   `pipeline_runner._load_boundary_frames` which hardcodes
   `ne_50m_admin_1_states_provinces.zip`). Keep 50m for admin-0 (fine).
   The 10m file uses the same `iso_a2` / `iso_3166_2` / `name_en` columns.
2. Handle `iso_3166_2` gaps in the 10m data: some features have `''`/None —
   fall back to `adm1_code` for `polygon_id`, and normalise `iso_a2 == "-99"`
   via the parent country's code (`admin.sov_a3`/`iso_a2` fallback chain).
   While in there: apply the same `-99` normalisation to the country frame
   (RC-7) using `ISO_A2_EH` → `ISO_A2` → skip.
3. Ensure admin-2 inputs exist: `wtg download boundaries --source geoboundaries`
   (long; cached per country) and confirm `aggregate` + `percentiles` run for
   `admin2`. Investigate why the previous build lacked them (likely never run
   on the build box).
4. Force-rebuild the invalidated caches — the admin1 aggregate parquet is
   stale by design of the cache:
   `wtg process aggregate --level admin1 --force` (and admin2), then
   `wtg process percentiles --force`, then
   `wtg build geojson --tier free|premium --force`, then both pmtiles.
   Expect a large runtime; ERA5 raster × ~4,600 admin-1 polygons is heavy but
   exactextract-backed.
5. Make `run_build_pmtiles` **fail** (not warn) when `tier == "premium"` and
   the admin-2 GeoJSON is missing (RC-2's silent path,
   `pipeline_runner.py:349`).
6. Add a tile-content smoke test to `pipeline/tests/` that opens the built
   PMTiles (deps: `pmtiles`, `mapbox-vector-tile`) and asserts:
   - free + premium `admin1` layer has ≥ 150 distinct `iso_a2`,
   - every `SUPPRESSED_COUNTRIES` code has ≥ 1 admin-1 feature,
   - premium contains an `admin2` layer,
   - no feature has `iso_a2 == "-99"`.
   (An ad-hoc version of this script already proved RC-1/RC-2; recreate it as
   a proper test.)
7. Re-run the Phase 3a QA reference-country table and confirm the mainland
   whitelist now actually applies (grep the run log — the
   "falling back to naive country aggregate" warning must disappear for
   FR/ES/NL/DK/PT/NO/GB/EC).
8. Deploy: run `./infra/scripts/rebuild-tiles.sh` on the v2 server (it also
   purges bunny.net — required, tiles are immutable-cached at the CDN edge).

Acceptance: the map shows Argentina/Chile/Kazakhstan as admin-1 mosaics at
country zoom; Georgia stays visible when zooming from z2 → z6; premium map
shows districts past z6; smoke test green.

### WS-2 · Web: clickable countries + full registry

> **Status: complete.** See § "WS-2 progress" at the end of this document.

1. Generate the full country registry (~195 entries: slug, name, iso2, region)
   into `web/src/lib/countries.ts` — derive from the pipeline's country
   output or Natural Earth attributes at build time; do not hand-type.
2. Change `handleFeatureSelect` (`map-experience.tsx:91`) to stop silently
   dropping unknown ISO codes: log to analytics, and for admin-1/admin-2
   features route to the region page (`/{country}/{regionSlug}`) once WS-5
   lands; until then route to the parent country.
3. Wire the map's on-click/hover UX per the design (`web/design/map/`,
   `Desktop Map.html`): hover → `match-tooltip` with name + score badge;
   click → climate panel (charts components already exist under
   `components/charts`) with a "View country page" CTA, instead of an
   immediate hard navigation. This is what makes the map feel interactive.
4. `generateStaticParams`/sitemap: expand from the new registry (gated on
   WS-5's data path so 195 pages don't all 404).

Acceptance: clicking any painted polygon produces a visible response; hover
shows a tooltip; e2e-style test that a click on a mocked feature with
`iso_a2: "GE"` navigates/opens the panel.

### WS-3 · Web: the Preferences feature

> **Status: complete.** See § "WS-3 progress" at the end of this document.

1. Implement a preference→score function in `web/src/lib/scoring.ts`:
   inputs (temp range, max rain, min sun hours — match
   `DEFAULT_PREFERENCES` in `pipeline/processing/scoring.py` so defaults
   agree), output 0–100 mapped onto the existing four bins. Unit-test parity
   against the pipeline's `polygon_score` for the default prefs.
2. Build `PreferencesPanel` per `web/design/map/` (sliders/steppers for the
   free-tier trio; premium variables shown but gated). Mount it in
   `map-experience.tsx` next to the display/month controls.
3. Dynamic paint: extend `buildFillColorExpression` to accept preferences and,
   for the `preferences` mode, compute the score **in the expression** from the
   per-feature `t_<mm>` / `r_<mm>` / `s_<mm>` props (MapLibre expression
   arithmetic — interpolate/step/case), falling back to baked `pref_<mm>` when
   prefs are default. This satisfies the hard rule: preference change =
   `setPaintProperty`, never a tile refetch.
4. State: URL search params for shareability (extend `useMapState` — `nuqs` is
   already there), plus the API-backed preference store from onboarding for
   logged-in users. **No localStorage** (web/CLAUDE.md rule).

Acceptance: moving a slider recolours the map live with no tile requests
(verify in devtools network); shared URL reproduces the same view; scoring
unit tests green including the pipeline-parity case.

### WS-4 · Pipeline+API: safety/advisory data path

> **Status: code complete; deploy blocked on upstream scraper quality.** The
> join works and was exercised against a real six-source scrape on v2 — but
> two scrapers produce levels that cannot be shipped. See § "WS-4 progress"
> and § "WS-4 deploy attempt, 2026-08-06".

1. Join the normalised advisory output into `build_geojson.py`: emit a
   month-less `safety` property (1–4) per feature — country-level from
   `country_iso2`, admin-level rows where `region_code` matches. Missing →
   omit the property (web already paints missing as grey).
2. Advisories change weekly but tiles rebuild yearly — decide and implement
   the refresh path: the simplest consistent option is to have
   `weekly-advisories.sh` rebuild + re-sign tiles and purge the CDN;
   alternatively serve advisories as a small JSON overlay fetched by the map
   (would need a `web/CLAUDE.md` rule exception — flag to the owner, don't
   silently deviate).
3. Add fixture-based tests: a tile/geojson built from the 3 advisory snapshot
   fixtures contains the expected `safety` values.

Acceptance: Safety mode shows real colours; weekly cron path documented and
tested end-to-end on staging.

### WS-5 · API+Web: real SSR data path (kill the mocks)

1. Implement `GET /v1/countries/{slug}` and
   `/v1/countries/{slug}/regions/{region}` in `api/routers/public.py`
   returning the `CountryData` shape `web/src/lib/types.ts` expects (12-month
   climatology + percentile bands + best-months + advisory summary). Source:
   load the pipeline's final GeoJSON/Parquet into Postgres at deploy time (new
   `wtg publish api-data` step or an API startup loader) — do not have the API
   read pipeline files directly from disk unless they're mounted read-only in
   compose.
2. Align `api-client.ts` paths, delete the `/api/public/country` placeholder,
   and flip `USE_MOCK_DATA` off outside tests/preview.
3. Fix `session.ts` mock default: unauthenticated must resolve to **free**,
   not "premium" (RC-6) — this is entitlement-adjacent, note the security
   implication in the commit body per repo rules.
4. Expand `generateStaticParams` to the full registry; keep the SSR
   zero-JS-rendering rule (test with JS disabled per web/CLAUDE.md).

Acceptance: `/georgia` and `/argentina` render real data with JS disabled;
failure-path tests for unknown slug (404); no `USE_MOCK_DATA` in the prod
compose environment.

### WS-6 · Guardrails (cheap, do alongside)

- Test that TS `SUPPRESSED_COUNTRIES` === Python `SUPPRESSED_COUNTRIES`
  (generate the TS list from Python, or check in a shared JSON both import).
- CI job (or at minimum a pipeline test) running the WS-1 tile smoke test on
  any change under `pipeline/`.
- The zoom band constants (`ZOOM_*` in `map-style.ts`) duplicated against
  tippecanoe flags — assert free tiles' `max_zoom ≥ 5` in the smoke test.

---

## WS-1 progress

### Code changes landed

| Change | File | Why |
|---|---|---|
| admin-1 source switched 1:50m → **1:10m** | `sources/geoboundaries.py` | The fix for RC-1. 10m carries 4,596 units across 241 countries; 50m carries 9 countries. Filenames are now exported constants so the runner can't drift from the downloader. |
| admin-1 polygon identity switched `iso_3166_2` → `adm1_code` | `pipeline_runner.py` | **Newly discovered.** `iso_3166_2` is not unique in the 10m layer — 155 rows share a code with another row. Using it as the identity silently collapses those polygons onto each other during aggregation. `adm1_code` is unique per feature; `iso_3166_2` is retained as the whitelist key. |
| country identity switched to `ADM0_A3`, `-99` sentinel blanked | `pipeline_runner.py` | RC-7. Somaliland, Northern Cyprus and the Siachen Glacier have no ISO-2 code. They are still painted but carry an empty `iso_a2`, so they are non-routable rather than wrongly routable as a country called `-99`. |
| Country-rules join key corrected | `processing/aggregate.py` | **Newly discovered, caused by the change above.** The admin-1 → country recomputation stamped the ISO-2 code as `polygon_id` while the country layer is keyed by `ADM0_A3`. Left alone, all seven whitelisted countries would have failed their geometry join and dropped out of the tiles entirely — silently. |
| `MAINLAND_WHITELIST` regenerated for the 10m vintage | `processing/country_rules.py` + `scripts/generate_mainland_whitelist.py` | **Newly discovered.** The old table used 2016-era codes (`FR-ARA`, `GB-ENG`, post-2020 `NO-42`) that do not occur in the data, so *every* whitelisted country matched nothing and fell back to a naive aggregate — France's mean still included French Guiana and Réunion. The table is now generated from Natural Earth's own `type_en`/`region` attributes and checked in. |
| Premium build fails on missing admin-2 | `pipeline_runner.py` | RC-2. It used to warn and continue, shipping a premium archive that was just the free one at higher zoom. |
| Per-polygon attribute lookup de-quadratified | `processing/aggregate.py` | The old code rescanned the whole frame per polygon per month — fine at 9 countries, ~250M string comparisons at 4,596 polygons. Also raises on duplicate ids instead of silently overwriting. |
| NetCDF engine fallback (`netcdf4` → `h5netcdf`) | `processing/aggregate.py` | The `netcdf4` extension is not loadable in every environment (it is blocked outright by endpoint security policy on this dev machine). Pin with `WTG_NETCDF_ENGINE`. |

### Tests added

- `pipeline/tests/test_tiles_content.py` — decodes the built archives and asserts admin-1 country coverage, admin-2 presence in premium, a mosaic for every suppressed country, no `-99` sentinel, and the documented zoom range. **Verified to fail against the pre-fix tiles on all four defects**, which is the point: this is the check whose absence let them ship.
- `pipeline/tests/test_aggregate_country_rules.py` — pins the recomputation join key and the overseas-exclusion arithmetic.
- `pipeline/tests/test_country_rules.py` — rewritten against real 10m codes, plus a size guard that would catch another wrong-vintage table.
- `web/src/lib/map-style.test.ts` — parses the Python `SUPPRESSED_COUNTRIES` and asserts the TypeScript mirror matches.

### Follow-up round: RC-8 / RC-9 / RC-10 (decided and implemented)

Sequenced as agreed — archive layout and viewport first, then the source flip.

1. **RC-9, wind in the free tier.** `si10` added to `FREE_VARIABLES` and
   `FREE_SOURCE_VARIABLES`. Two tests pin the tier boundary in both
   directions: free must emit everything the product sells as free, and must
   not leak the four premium variables (the tier boundary is a file boundary,
   so anything in `free.pmtiles` is effectively public).
2. **Admin-2 zoom range.** Features at `admin2` now carry a per-feature
   `tippecanoe: {minzoom: 6}` hint (`LEVEL_MIN_ZOOM` in `build_geojson.py`),
   mirroring `ZOOM_ADMIN2_MIN` in the web style. Tippecanoe's `-Z` is global,
   so admin-2 was previously tiled from zoom 0 — tens of thousands of district
   polygons in world-view tiles that never render them, which is what pushed
   those tiles past the 500KB budget and made `--drop-densest-as-needed`
   discard country and admin-1 features. This had to be fixed *before* the
   source flip, or premium users would have seen a sparser world map than free
   users.
3. **RC-10, viewport reset.** `map-canvas.tsx` no longer keys map construction
   on the tile URLs. Construction is keyed on whether tiles exist at all; a
   re-issued signature now swaps the style via `setStyle`, which preserves the
   camera. `map-canvas.test.tsx` covers it with a mocked MapLibre: one instance
   survives a URL change, `setStyle` is called instead, mode/month changes do
   not restyle, and premium arriving lifts the zoom ceiling in place.
4. **RC-8, the source flip.** `buildMapStyle` now resolves a `baseSourceId`:
   the premium archive when a premium URL is present, the free archive
   otherwise. Country, admin-1 and the mosaic layers all follow it. The style
   declares only the source it actually uses, and a test asserts declared and
   referenced sources match exactly in both tiers.

Note for the production rebuild: `test_premium_tiles_carry_the_base_levels_too`
is new and load-bearing. Premium sessions now read country and admin-1 from the
premium archive, so an archive missing them blanks the map for paying users at
every zoom below admin-2.

### Still to run on the build box

The rebuild itself needs the real ERA5 archive, which is not on this machine —
`pipeline/data/raw/era5/` holds a single file (`t2m_2020.nc`), and
`geoboundaries/adm2/` holds a single country (Peru). Everything below must run
where the full dataset lives:

```bash
uv run --directory pipeline wtg download boundaries --source naturalearth --force
uv run --directory pipeline wtg download boundaries --source geoboundaries
uv run --directory pipeline wtg process aggregate --level all --years 2016-2025 --force
uv run --directory pipeline wtg process percentiles --level all --force
uv run --directory pipeline wtg build geojson --tier free --force
uv run --directory pipeline wtg build geojson --tier premium --force
uv run --directory pipeline pytest tests/test_tiles_content.py
./infra/scripts/rebuild-tiles.sh   # builds both tiers, purges bunny.net
```

`--force` on aggregate is not optional: the aggregate Parquet is cached and
returned untouched otherwise, so the boundary-source change alone would
produce no visible difference.

Two things to check on the box while this runs:

1. The log must contain **no** `falling back to naive country aggregate`
   warnings for FR/ES/NL/DK/PT/NO/EC. One means the whitelist is stale again.
2. `wtg build pmtiles --tier premium` now fails loudly if admin-2 is absent.
   If it does, admin-2 never made it through aggregate → percentiles → geojson;
   fix that rather than reverting the check.

## WS-2 progress

### Changes landed

| Change | File | Why |
|---|---|---|
| Country registry generated from Natural Earth, 9 entries → **237** | `pipeline/scripts/generate_country_registry.py` → `web/src/lib/countries.generated.ts` | RC-3. Generated from the *same* `ne_50m_admin_0_countries.zip` the tiles' country level is built from, with the same `-99` blanking, so the codes cannot drift from what the polygons carry. Territories Natural Earth files under a parent's code (Ashmore and Cartier under `AU`) collapse onto the parent; the three polygons with no ISO-2 at all are absent by construction, matching the pipeline's "painted but not routable" treatment. |
| Registry lookups are O(1) and case-insensitive | `web/src/lib/countries.ts` | The hover path runs on every pointer move; a linear scan of 237 entries per event is avoidable. `findCountryByIso2` is the one entry point the map uses. |
| Click opens a climate panel instead of navigating (or doing nothing) | `web/src/components/map/climate-panel.tsx`, `app/map/map-experience.tsx` | RC-3's second half: even the nine working countries only ever hard-navigated, so the map read as dead. The panel names the feature, scores the selected month, charts the year, and offers the country page as a deliberate next step. It opens for *every* polygon — a feature with no country page says so rather than silently doing nothing. |
| Unknown ISO codes are now telemetry, not a silent `return` | `app/map/map-experience.tsx` | `map_feature_select` carries `registry_miss`, which is how a future registry/tile-vintage drift becomes visible instead of becoming another dead map. |
| Hover card wired to the existing `match-tooltip` | `web/src/components/map/map-hover-card.tsx` | Reads the hovered feature's own tile properties — score, the variable currently painted, and the free trio — and flips against the map container's edges. Suppressed on touch, where there is no hover state. |
| Selection outline on the clicked polygon | `web/src/lib/map-style.ts`, `components/map/map-canvas.tsx` | One line layer per level, filtered on the `id` property (namespaced per level by the pipeline, so one id can never match two levels). Re-applied after a style swap, because a re-signed tile URL rebuilds every layer with its default filter. |
| Feature-property reader | `web/src/lib/feature-climate.ts` | Single typed path from `feature.properties` (typed `unknown`) to identity / series / percentile bands, returning `null` for anything the tier or level does not carry. No fetch — `web/CLAUDE.md`'s "climate is baked into the PMTiles" rule holds. |
| `MapCanvas` memoised | `components/map/map-canvas.tsx` | The page re-renders on every pointer move while the hover card follows the cursor; the canvas has nothing to do on those renders. |
| Route generation gated on the data path | `web/src/lib/country-routes.ts` + the three `generateStaticParams` and `sitemap.ts` | `dynamicParams = false` turns a generated slug with no data into a build-time 404, so widening the registry to the world would have shipped ~2,800 404s and a sitemap advertising them. `routableCountries()` is the fixtures while `USE_MOCK_DATA` is on and the full registry the moment WS-5 turns it off — no further edit needed there. |

### Tests added

- `web/src/lib/countries.test.ts` — size, uniqueness, code/slug shape, and that every `SUPPRESSED_COUNTRIES` code plus the reported-missing four (GE, AR, CL, KZ) resolve.
- `web/src/lib/feature-climate.test.ts` — property decoding, including the gap and wrong-type cases that would otherwise reach a chart as zeroes.
- `web/src/components/map/climate-panel.test.tsx` — the Georgia case end to end, region features naming their parent country, and the codeless-polygon copy.
- `web/src/app/map/map-experience.test.tsx` — a click on a mocked `iso_a2: "GE"` feature opens the panel, outlines the polygon, and emits `map_feature_select`; a registry miss still opens a panel and reports `registry_miss: true`; hover raises and clears the card; Escape closes.
- `web/src/components/map/map-canvas.test.tsx` — hover callback with pointer position, and the selection outline surviving a restyle.
- `web/src/lib/country-routes.test.ts` — the gate is the fixtures under mocks and the whole registry without them.

### Follow-ups this leaves for other workstreams

1. The panel and hover card score from the baked `pref_<mm>`. WS-3 should point
   both at the same client-side scoring function it gives the paint expression,
   or a user's own preferences will disagree with the number in the panel.
2. The CTA for an admin-1/admin-2 feature goes to the parent country page —
   WS-5 should route it to `/{country}/{regionSlug}` once those pages have data.
3. `routableCountries()` is the only thing standing between the registry and
   2,844 country/month pages. WS-5 turning `USE_MOCK_DATA` off is what opens
   that gate, so the API must answer for every slug in the registry by then.

## WS-3 progress

### Changes landed

| Change | File | Why |
|---|---|---|
| `preferenceScore` / `scoreBucket` + the `WeatherPreferences` model | `web/src/lib/scoring.ts` | RC-4. The module held only bin/label/colour helpers; the preference→score function `web/CLAUDE.md` requires was never written. It reproduces the pipeline's `polygon_score` bucket-for-bucket — **not** a nicer continuous score — because the map paints the baked `pref_<mm>` while preferences are default, and any other rule would make the map jump the moment a user dragged a slider back to where it started. |
| Score computed inside the paint expression | `web/src/lib/map-style.ts` (`buildPreferenceScoreExpression`) | The hard rule: a preference change is a `setPaintProperty` call, never a tile refetch. The three ingredients (`t_<mm>`, `r_<mm>`, `s_<mm>`) are already properties on every feature, so the whole rule pushes down into the paint. Default preferences still resolve to a single `get pref_<mm>` — same number, one lookup instead of twelve comparisons per polygon per frame. |
| `PreferencesPanel` — popout card on desktop, sheet on mobile | `web/src/components/map/preferences-panel.tsx`, `preferences-sheet.tsx`, `app/map/map-experience.tsx` | The Phase 5 deliverable that never shipped. Three controls, because three variables are what the score consults. |
| `RangeSlider` / `DualRangeSlider` | `web/src/components/ui/range-slider.tsx` | Native `<input type="range">` under a painted track rather than a pointer-driven custom widget: keyboard operation, role and value semantics come from the browser. The Atlas mock's two-thumb track is the one thing a native slider cannot do, so the dual variant stacks two transparent sliders over one track and re-enables pointer events on the thumbs only. |
| Preferences in the URL (`tmin`/`tmax`/`rmax`/`smin`) | `web/src/hooks/use-map-state.ts` | Shareability, and the only storage `web/CLAUDE.md` allows besides the API. nuqs drops a param equal to its default, so an untouched map keeps a clean URL and "default" and "absent" are the same state — which is what lets the store below know whether the URL had anything to say. |
| Durable preferences for signed-in users | `web/src/hooks/use-stored-preferences.ts` | The onboarding record already persists arbitrary per-user JSON through `PATCH /api/onboarding`; this writes into it under `mapPreferences` rather than adding a second store and a migration. URL wins over stored, so a shared link shows the sender's map. A 401 on the first read disables writes for the session instead of retrying per slider drag. |
| Panel + hover card score through the same function as the paint | `climate-panel.tsx`, `map-hover-card.tsx`, `lib/feature-climate.ts` | WS-2's follow-up #1. Both read `readPreferenceScore(props, month, preferences)`, which is the baked value under defaults and the computed one otherwise — so the number in the panel is the number that chose the colour. Both surfaces now say which of the two they are showing. |
| Tuning a slider switches the display mode back to `preferences` | `app/map/map-experience.tsx` | Only that mode reads preferences. Without this, moving a slider while Temperature is painted looks like the control is broken. |

### Tests added

- `web/src/lib/scoring.test.ts` — parses `processing/scoring.py` and `tiles/build_geojson.py` and asserts the TypeScript ranges, buffers, scored-variable set and 0–100 bucket mapping match the Python tables. Plus the bucket rule, its boundaries, absent-variable handling, and `null`-not-zero for a feature with no data.
- `web/src/lib/map-style.test.ts` — a small MapLibre expression evaluator runs the emitted paint expression across four preference sets × nine feature shapes and asserts it returns exactly what `preferenceScore` returns. These are two implementations of one rule and nothing else in the app compares them.
- `web/src/components/map/map-canvas.test.tsx` — a preference change calls `setPaintProperty` and leaves `setStyle` untouched (a restyle would refetch every tile).
- `web/src/components/map/preferences-panel.test.tsx` — control behaviour, thumbs that pin instead of crossing, Reset gated on being non-default, the premium gate, and an accessible name + `aria-valuetext` on all four sliders.
- `web/src/app/map/map-experience.test.tsx` — end to end on a stateful `useMapState`: a slider reaches the canvas without changing the tile URL, Georgia's panel score moves from the baked 82 ("Good option") to a computed 60 ("Acceptable"), the display mode switches back, Reset restores the defaults, and a signed-out visitor never writes to the store.

### Not verified

The map itself was not exercised in a browser: there are no PMTiles archives on this machine and no API to sign a tile URL, so a dev server would only render the map's error state. The paint expression is covered by the evaluator test instead, which is the same arithmetic MapLibre would run.

### Follow-ups this leaves for other workstreams

1. `web/CLAUDE.md` says scoring is "shared between the map paint expressions and the SSR pages". The paint half is done; the SSR country pages still do not score at all. WS-5 should call `preferenceScore` from the same module when it renders real data, or the country page and the map will disagree.
2. Premium variables are **not** scoring inputs anywhere — the pipeline's `SCORED_VARIABLES` is the free trio too. The panel's premium block is therefore worded as what it is today (four more map layers), not as extra matching criteria. Widening the score to premium variables is a product decision that needs the pipeline side first.
3. Wind is now a free tile variable (RC-9) but is deliberately not scored, because the pipeline does not score it either and parity with the baked `pref_<mm>` is what keeps the default map stable. Adding it means changing both sides together and re-baking tiles.
4. Anonymous visitors' preferences live only in the URL. That is the rule as written (no `localStorage`); if they should survive a fresh visit, it needs an HttpOnly cookie set via the API, which is an API change.
5. The `unit` query param (metric/imperial) is still unused — the panel reads °C / mm / h like the rest of the map. Imperial display is its own pass across the legend, hover card, panel and SSR pages.

## WS-4 progress

### The decision the plan left open

Step 2 asked for a call between baking advisories into the tiles and serving
them as a JSON overlay the map fetches. **Baked into the tiles**, with the
weekly rebuild made conditional. The overlay would need an explicit exception
to `web/CLAUDE.md`'s "never fetch climate data from the browser" rule plus a
client-side join through `setFeatureState` on every rendered polygon; baking
keeps one source of truth and costs a rebuild only in the weeks a government
actually moves a level. Advisory levels are far more static than the weekly
cadence suggests — most weeks the answer is "nothing changed", and the
conditional rebuild turns those weeks into a no-op.

### Changes landed

| Change | File | Why |
|---|---|---|
| Advisory consolidation module | `processing/advisories.py` (new) | RC-5. Six scrapers were writing dated JSON dumps that nothing read. This folds the newest dump per government into one state per country: consensus level (`max`, matching the web legend's "Highest of 5 sources"), every government's own level/summary/URL, and resolved subdivisions. |
| `safety` baked into both tiers | `tiles/build_geojson.py` | The property `web/src/lib/display-modes.ts` has always read and nothing ever wrote. Month-less, unlike every other mode's `<prop>_<mm>`. Emitted at country, admin-1 *and* admin-2 so the colour survives zooming past the country handover; in both tiers, because Safety is a free mode and premium sessions read the base levels from the premium archive (RC-8). |
| `wtg process advisories` | `cli.py`, `pipeline_runner.py` | The step between `download advisories` and `build geojson` that did not exist. Also runs inside `wtg pipeline full`, where a missing scrape is a warning rather than a failure — a failed scrape degrades one display mode and must not block the yearly climate rebuild. |
| Two outputs, deliberately split | `data/final/advisories.json` + `data/intermediate/advisories/safety_index.json` | The detail file (per-government levels, summaries, dates) is what WS-5's `AdvisorySummary` needs. The index is levels only, byte-stable by construction. Separating them is what lets a reworded advisory reach the country page without costing every user a re-download of the PMTiles archive. |
| `last_changed` carried forward across scrapes | `processing/advisories.py` | A government saying the same thing this week as last week has not changed its advisory. Dating it "today" would both lie on the country page and make every weekly run a change, which would defeat the conditional rebuild. |
| `generated_at` derived from the data, not the clock | `processing/advisories.py` | `pipeline/CLAUDE.md`: re-running a step with the same inputs is a no-op. A wall-clock timestamp would make every run a diff. |
| `weekly-advisories.sh` rewritten | `infra/scripts/weekly-advisories.sh` | **The old script could never have run.** It called `docker compose exec pipeline`, and there is no `pipeline` service in `docker-compose.yml`; it invoked `wtg process aggregate --only advisories`, a flag that does not exist; and it purged `https://v2.…/advisories.json`, a path the Caddyfile does not route. It now runs `uv` on the host like `rebuild-tiles.sh`, hashes the safety index either side of the scrape, and delegates to `rebuild-tiles.sh` only when a level moved (`FORCE_REBUILD=1` overrides). |

### The regional carve-out problem

No scraper resolves a sub-national advisory to a polygon. What they emit is a
sentinel — `region_code: "regional-L4"` — meaning "somewhere in this country
is a level 4, we could not parse where". Three ways to handle it, and only one
is honest:

- Fold it into the country level → the whole of Mexico paints "Do Not Travel"
  on the strength of four states. This is the claim the carve-out contradicts.
- Drop it → the country page loses information the scrapers already extracted.
- **Keep it out of the tiles, carry it in `advisories.json` as
  `regional_max`.** The map shows the country-wide consensus; the country page
  can say "parts of this country carry a higher advisory".

The join for *real* ISO-3166-2 codes is already wired and tested against
`admin1_code`, so the detail-page geocoding pass, when it lands, needs no
build change — only scraper output. A region code whose prefix doesn't match
its country is rejected, so a mis-parsed detail page cannot stamp one
country's level onto another's subdivision.

### Tests added

- `pipeline/tests/test_advisories_consolidate.py` — runs the real scrapers over the recorded fixtures and pins: the `max` consensus where the sources disagree (Colombia: US 3, AU 3, DE 2 → 3), a country only one government lists surviving (Egypt), the sentinel never raising the country level, cross-country region codes rejected, `last_changed` surviving an unchanged rescrape but moving when a level moves, and a reworded summary changing the detail file while leaving the index byte-identical — the exact distinction the cron branches on.
- `pipeline/tests/test_advisories_tiles.py` — the plan's step 3: a GeoJSON built from the three snapshot fixtures carries the expected `safety` values, at all three levels, in both tiers, with no `safety_<mm>` variant, and with the property absent for a country nobody lists. Plus `run_process_advisories` writing both artifacts and reporting the second run as unchanged.
- `pipeline/tests/test_tiles_content.py` — three new checks against the built archives: the country layer's `safety` agrees with the index it was built from, every level is on the 1–4 ladder, and admin-1 carries levels too (without which Safety goes grey past zoom 3.5). Skipped until the archives exist.
- `pipeline/tests/test_cli_process.py` — `changed` / `unchanged` in the CLI's output, since the shell script's control flow depends on the underlying no-op behaviour.

### Still to run on the build box

```bash
uv run --directory pipeline wtg download advisories --source all
uv run --directory pipeline wtg process advisories
./infra/scripts/rebuild-tiles.sh          # or: FORCE_REBUILD=1 ./infra/scripts/weekly-advisories.sh
uv run --directory pipeline pytest tests/test_tiles_content.py
```

The scrapers' mapping tables are the thing to watch: `mappings/README.md` says
bootstrap coverage is "intentionally narrow — enough to exercise the parser".
An unmapped country name is dropped with a debug-level log, so the first real
scrape should be run with `-v` and the `unmapped country` lines counted. Low
country coverage in `safety_index.json` means the mapping tables need filling,
not that the join is broken — `test_country_layer_carries_the_advisory_levels`
requires ≥100 countries to overlap and will fail loudly if they don't.

### API: no change, by design

Nothing in `api/` needed to move for the map. The advisory level reaches the
browser inside the tiles, and the SSR country page's `AdvisorySummary` is
WS-5's data path, not a second one. `advisories.json` is shaped as that
handoff — `{iso2, level, label, sources[{source, level, label, summary, url,
last_changed}], regional_max}` maps onto `web/src/lib/types.ts`
`AdvisorySummary` field for field. WS-5 should load it alongside the climate
data (its step 1 already proposes a `wtg publish api-data` step); it is
deliberately *not* exposed as a public file, since no route serves it and
adding an unauthenticated one for a consumer that doesn't exist yet is
speculative.

### Follow-ups this leaves for other workstreams

1. `infra/scripts/yearly-era5.sh` has the same latent defect the old
   `weekly-advisories.sh` had — it shells into a `pipeline` compose service
   that `docker-compose.yml` does not define. Out of scope here, but it means
   the yearly rebuild has never run as written either.
2. The web has no UI for `regional_max`. The country page currently says
   "regional variation in advisories ships with the next pipeline cut"
   (`web/src/app/[country]/[slug]/[month]/page.tsx:388`); the data to replace
   that sentence now exists in `advisories.json`.
3. The hover card and climate panel show climate but never the advisory
   level, even when Safety is the painted mode
   (`map-hover-card.tsx` explicitly skips it). Small WS-2-shaped follow-up.
4. Advisory mapping-table coverage is the ceiling on how much of the world
   Safety mode can colour. Widening `sources/advisories/mappings/*.json` is
   mechanical and independent of everything above.

## WS-4 deploy attempt, 2026-08-06

Ran on v2 (`51.15.37.62`) up to the point of rebuilding tiles, then stopped.
**No tiles were rebuilt and the CDN was not purged** — `free.pmtiles` and
`premium.pmtiles` are untouched, and nothing user-visible changed.

### What the first real scrape found

Five of six sources answered (uk_fcdo 83, canada 60, australia 198,
germany 200, netherlands 224). Consolidation produced **227 country levels** —
mapping-table coverage is far better than `mappings/README.md` suggests, well
past the ≥100 the tile smoke test requires. The join itself behaved exactly as
designed.

The levels it produced cannot ship:

| source | n | level distribution |
|---|---|---|
| australia | 179 | 1:64 2:75 3:14 4:26 |
| us_state | 64 | 1:19 2:28 3:6 4:11 |
| canada | 56 | 1:14 2:26 3:3 4:13 |
| uk_fcdo | 63 | 1:57 3:1 4:5 |
| **netherlands** | 224 | 1:78 2:60 3:25 **4:61** |
| **germany** | 200 | 1:155 **2:0** 3:27 4:18 |

62 countries came out at "Do Not Travel" — a quarter of the world — and for
**36 of them the Netherlands is the only source saying 4**: Japan, South
Korea, India, Thailand, Morocco, Turkey, UAE, Israel, Peru, Georgia, Mexico,
Colombia, Egypt. Every other government rates those 1–2. `netherlands.py`
takes the first colour word following the first "kleurcode" in the API's
`introduction` blob, which for many countries is not the country-wide code.
`germany.py` is separately suspect: 200 records, not one level 2, and
summaries that are bare page titles.

### Why this stopped the deploy rather than being a caveat

`max` consensus is the right rule and the web legend advertises it — but it
means one broken scraper poisons the whole map, and the failure is
*confidently wrong* rather than blank. Painting Japan and Thailand dark red
"Do Not Travel" is a false claim about real places and materially worse than
the grey the mode shows today. Nothing about the tile join needs to change to
fix it; the scrapers do.

### State left on the box

- Code pulled (`bc43fae`), inert. There is **no root crontab installed** on
  v2, so `weekly-advisories.sh` is not scheduled and nothing ships this on its
  own. The `Caddyfile`'s uncommitted production edits survived the pull and
  were backed up to `/root/Caddyfile.backup-*` first.
- Fresh raw dumps for the five working sources are kept — re-testing a scraper
  fix needs no re-scrape.
- `safety_index.json` is renamed to `safety_index.json.quarantined-2026-08-06`
  so that the *next* tile build — WS-1's outstanding production rebuild, most
  likely — cannot silently bake these levels in. `load_safety_index()` now
  returns `None` there and `build geojson` logs its "Safety will paint grey"
  warning. Re-running `wtg process advisories` regenerates it.

### Two blockers found that are not WS-4's

1. **`travel.state.gov` 403s from the v2 IP** (Cloudflare). The US State
   scraper cannot run from that box at all. `process advisories` fell back to
   the April dump still on disk, which is the designed behaviour but means US
   data goes stale silently. Worth surfacing as a warning when a source's
   newest dump is older than some threshold. Not something to work around by
   disguising the client.
2. **The geoBoundaries ADM2 sources are gone from the box** (`raw/geoboundaries/adm2/`
   is empty), while `admin2_premium.geojson` (3.8 GB, Aug 4) and the old
   percentiles remain. A both-tier `rebuild-tiles.sh` would therefore rebuild
   premium's admin-2 layer from an empty frame and ship a premium archive with
   no districts. This is WS-1 step 3's outstanding item and it now actively
   booby-traps the rebuild script — **do not run `rebuild-tiles.sh` without
   `TIERS=free` until the ADM2 download is re-run.**

## Part 4 — What was *not* verified in this audit

- Live production behaviour (audit used the repo-local PMTiles and code; the
  deployed tiles may lag even these).
- Whether the v2 server's `data/` caches hold admin-2 aggregates (RC-2's
  trigger); WS-1 step 3 must check on the box.
- Trips/account/agency wiring beyond "uses mock session data" (RC-6 covers the
  session default; deep audit of those flows deferred to Phase 6 work).
