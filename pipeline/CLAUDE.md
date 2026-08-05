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
- `wtg build geojson` — produce `data/final/*.geojson`
- `wtg build pmtiles --tier free` — produce `tiles/free.pmtiles`
- `wtg build pmtiles --tier premium` — produce `tiles/premium.pmtiles`
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
- Advisories: each government scraper inherits from `advisories/base.py`
  and returns the normalised schema: `{country_iso2, region_code|null,
  level: 1-4, summary, source_url, fetched_at}`.
- Aggregation uses `exactextract` or `rasterstats` — NEVER write a manual
  point-in-polygon loop; it will be too slow.
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
  `minzoom` (admin-1 → 3, admin-2 → 6), because `-Z` is global and tiling a
  level below the zoom it renders at just crowds out the levels that do.
  **Exception:** suppressed countries' admin-1 features stay unhinted — the
  web paints them as a mosaic *below* zoom 3, so hinting them would empty it.
- All intermediate files are cached. Re-running a step with the same inputs
  should be a no-op unless `--force` is passed.
- Long-running steps must log progress every 30 seconds minimum.

## Testing

- Unit tests use sample fixtures in `tests/fixtures/` (a 10°×10° ERA5 slice,
  5 countries' geoBoundaries, 3 advisory snapshots).
- Never hit the CDS API in tests. Mock `cdsapi.Client`.
- Never hit government websites in tests. Use recorded HTML fixtures.
