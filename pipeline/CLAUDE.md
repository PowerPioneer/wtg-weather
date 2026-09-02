# Pipeline — `wtg_pipeline`

Python 3.12 package. Installed in editable mode with `uv`. CLI entrypoint is
`wtg` via `typer`.

## Setup

```bash
cd pipeline
uv sync
uv run wtg --help
```

## Key commands

- `wtg download era5 --years 2016-2025` — fetch monthly means from CDS
- `wtg download advisories --source all` — scrape all five governments
- `wtg download boundaries` — geoBoundaries admin-2 + Natural Earth
- `wtg process aggregate` — polygon aggregation
- `wtg process percentiles` — 10/50/90 across 10-year window
- `wtg process advisories` — consolidate the scrapes into `data/final/advisories.json`
  (full detail, for the API) + `data/intermediate/advisories/safety_index.json`
  (levels only, the input to `build geojson`)
- `wtg build geojson` — produce `data/final/*.geojson`
- `wtg build pmtiles --tier free` — produce `tiles/free.pmtiles`
- `wtg build pmtiles --tier premium` — produce `tiles/premium.pmtiles`
- `wtg publish api-data` — write `data/final/api/` (one JSON payload per
  country + `index.json`), the bundle the API serves to the SSR pages
- `wtg pipeline full` — end-to-end

## Rules

- All sources in `src/wtg_pipeline/sources/`. One file per source. Each file
  exports a `fetch()` function that returns raw bytes or a local path.
- Natural Earth scales are NOT interchangeable. Country comes from **1:50m**;
  admin-1 MUST come from **1:10m**. At 1:50m Natural Earth only subdivides a
  handful of large countries (9 in practice), which leaves most of the world
  with no admin-1 polygon — countries vanish in the mid-zoom band and the
  suppressed-country mosaic renders as a hole.
- Admin-1 polygon identity is `adm1_code`, never `iso_3166_2`: the latter is
  not unique in the 10m layer. `iso_3166_2` is the `MAINLAND_WHITELIST` key
  only. Country identity is `ADM0_A3`, because a few polygons have no ISO-2.
- `MAINLAND_WHITELIST` is generated, not hand-edited — its codes are tied to
  the Natural Earth admin-1 vintage. Regenerate with
  `python scripts/generate_mainland_whitelist.py` and review the diff.
- The web's country registry (`web/src/lib/countries.generated.ts`) is
  generated from the **same admin-0 layer the tiles are built from**, with the
  same `-99` blanking, by `python scripts/generate_country_registry.py`. It is
  what turns a feature's `iso_a2` into a name and a URL, so it must not drift
  from the boundary vintage: regenerate it whenever the admin-0 source changes
  and review the diff. Never hand-edit the generated file.
- The slug rule that script uses lives in `processing/country_registry.py` and
  is shared with `wtg publish api-data`, which names its per-country files with
  it. They must not diverge: the web generates its static route tree from the
  published index, so a slug the two disagreed about is a page the API cannot
  answer for.
- `wtg publish api-data` emits **free-tier variables only**. Country pages are
  statically generated, so one HTML document serves every visitor — a premium
  series in the payload is a premium series in public view-source. Same tier
  boundary the tiles draw, same reason. `test_publish_api_data.py` pins it.
- The ten `SUPPRESSED_COUNTRIES` have no country-level percentile row (
  `apply_country_rules` drops them, because a single national colour for Russia
  or Argentina is a claim the data does not support). `publish api-data` builds
  their payload from the mean of their admin-1 rows and marks it
  `climateBasis: "admin1-mean"` — the map suppresses them, the page does not.
- `ne_110m_populated_places` is downloaded for one reason: it is the only
  Natural Earth layer carrying a capital city and its IANA timezone, both of
  which the country page prints. Nothing in the tiles reads it, and a country
  it cannot resolve simply omits those two rows.
- Advisories: each government scraper inherits from `advisories/base.py`
  and returns the normalised schema: `{country_iso2, region_code|null,
  level: 1-4, summary, source_url, fetched_at}`.
- The advisory level reaches the map as a **month-less `safety` feature
  property** baked into both tiers by `build_geojson`, never as a runtime
  fetch — `web/CLAUDE.md` forbids the browser fetching anything that lives in
  the tiles. Consensus across governments is `max` ("Highest of 5 sources" on
  the web legend); a country no government lists carries no property at all,
  which the web paints grey.
- A `region_code` of `regional-L<n>` is the scrapers' sentinel for "somewhere
  in this country is level n, we can't say where". It must never raise the
  country level or reach the tiles — it names no polygon. It survives in
  `advisories.json` as `regional_max`. Only a real ISO-3166-2 code whose
  prefix matches the country paints a subdivision.
- `wtg process advisories` leaves an output file untouched when its content
  is unchanged, and `advisories.json`'s `generated_at` is derived from the
  data rather than the clock. `weekly-advisories.sh` depends on this: it
  hashes the safety index to decide whether to rebuild tiles and purge the
  CDN, so a reworded advisory must not change those bytes.
- Each government's entry in `advisories.json` carries **two** dates and they
  are not interchangeable. `last_changed` is when that government moved, and
  survives a rescrape that finds the same text. `checked` is when we last read
  it, and moves on every successful scrape — so the detail file is *expected*
  to differ week to week, while the safety index stays byte-stable. The web's
  stale-badge rule reads `checked`; reading `last_changed` would paint every
  country with a stable advisory as stale.
- `wtg process advisories` warns (`ADVISORY_STALE`, log + stdout) when a
  source's newest dump is older than `WTG_ADVISORY_STALE_DAYS` (default 21).
  That is the absolute check; `stale_sources` is the relative one, and only
  the absolute one fires when nothing has scraped at all. Not fatal — an old
  snapshot beats no advisories. See `infra/CLAUDE.md` § "US advisory scrape".
- Aggregation uses `exactextract` or `rasterstats` — NEVER write a manual
  point-in-polygon loop; it will be too slow.
- The polygon/raster overlap is computed **once** per `(level, grid)` and
  cached by `processing/coverage.py`, because it depends only on the polygon
  set and the raster grid — neither of which moves during a run. Each timestep
  is then two `np.bincount` calls. Aggregation used to run a full exactextract
  pass per timestep, which is 328× slower per raster and makes daily
  statistics (25,550 rasters instead of 1,080) a multi-week job.
  `CoverageMatrix.means` **must** keep reproducing exactextract's `mean`,
  which ignores masked cells and renormalises the weights over the survivors:
  ERA5 is NaN over ocean, so a plain weighted sum poisons a polygon to NaN and
  a zero-filled one drags every coastal polygon toward zero — plausible-looking
  and wrong. `test_coverage.py` pins it against `exact_extract` itself, and
  `test_aggregate_equivalence.py` pins the whole path against the per-timestep
  algorithm it replaced. Neither is optional.
- The coverage cache does **not** need `--force` to stay honest: its key hashes
  the polygon identities *and* their geometries alongside the grid coordinates,
  so a boundary-vintage change simply misses the cache. Every raster reduced
  against it must first go through `coverage.normalise_raster`, which is what
  puts ERA5's 0..360 longitude on the layout the weights were built for.
- Tippecanoe flags for PMTiles:
  - free: `-Z0 -z5 --no-tiny-polygon-reduction --maximum-tile-bytes=2000000
    --coalesce-smallest-as-needed`
  - premium: the same plus `-z9` and `--drop-densest-as-needed`
- `--no-tiny-polygon-reduction` and the raised byte ceiling are NOT tuning
  knobs. At tippecanoe's 500KB default the 4,596-polygon 1:10m admin-1 layer
  lost most of its features in the mid-zoom band (20% surviving at z3, 42% at
  z4, 61% at z5), and each lost polygon is a hole on the map because the
  country layer stops at zoom 3.5.
- Levels carry a per-feature `tippecanoe.minzoom` matching the web's layer
  `minzoom` (admin-1 → 3, admin-2 → **7**), because `-Z` is global and tiling a
  level below the zoom it renders at just crowds out the levels that do.
  **Exception:** suppressed countries' admin-1 features stay unhinted — the
  web paints them as a mosaic *below* zoom 3, so hinting them would empty it.
- admin-2's hint is 7 rather than 6 because a z6 tile cannot carry the level
  whole. Measured on the 2026-08-30 build: tile 6/32/21 shipped 92 of the 189
  Dutch municipalities intersecting it and left **32.8%** of the country with
  no admin-2 polygon. Tippecanoe logged nothing — it names only the four tiles
  it thinned explicitly, and that was not one of them. MapLibre serves map zoom
  6.0–6.99 from z6 tiles, and `ZOOM_ADMIN1_MAX` was 6.5, so the 6.5–7.0 band
  had admin-2 as its only fill and a third of the Netherlands rendered as bare
  background. Both constants moved to 7.0 together; they are one decision.
- Verify it after a rebuild rather than trusting it — the failure is silent:
  `uv run python scripts/audit_tile_coverage.py --iso NLD --level admin2`
  decodes the built tiles and prints the fraction of source area no feature
  covers, per zoom. A few points that do **not** move with zoom are the two
  boundary datasets disagreeing about water; loss that appears at one zoom and
  is gone at the next is this bug.
- All intermediate files are cached. Re-running a step with the same inputs
  should be a no-op unless `--force` is passed.
- Long-running steps must log progress every 30 seconds minimum.

## Testing

- Unit tests use sample fixtures in `tests/fixtures/` (a 10°×10° ERA5 slice,
  5 countries' geoBoundaries, 3 advisory snapshots).
- Never hit the CDS API in tests. Mock `cdsapi.Client`.
- Never hit government websites in tests. Use recorded HTML fixtures.
