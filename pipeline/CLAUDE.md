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
- Advisories: each government scraper inherits from `advisories/base.py`
  and returns the normalised schema: `{country_iso2, region_code|null,
  level: 1-4, summary, source_url, fetched_at}`.
- Aggregation uses `exactextract` or `rasterstats` — NEVER write a manual
  point-in-polygon loop; it will be too slow.
- Tippecanoe flags for PMTiles:
  - free: `-Z0 -z5 --coalesce-smallest-as-needed`
  - premium: `-Z0 -z9 --coalesce-smallest-as-needed --drop-densest-as-needed`
- All intermediate files are cached. Re-running a step with the same inputs
  should be a no-op unless `--force` is passed.
- Long-running steps must log progress every 30 seconds minimum.

## Testing

- Unit tests use sample fixtures in `tests/fixtures/` (a 10°×10° ERA5 slice,
  5 countries' geoBoundaries, 3 advisory snapshots).
- Never hit the CDS API in tests. Mock `cdsapi.Client`.
- Never hit government websites in tests. Use recorded HTML fixtures.
