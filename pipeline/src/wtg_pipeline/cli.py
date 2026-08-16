from __future__ import annotations

import logging
from typing import Annotated

import typer

app = typer.Typer(help="Where to Go for Great Weather — data pipeline CLI.")

download = typer.Typer(help="Download raw data from external sources.")
process = typer.Typer(help="Process raw data into intermediate artifacts.")
build = typer.Typer(help="Build final outputs (GeoJSON, PMTiles).")
publish = typer.Typer(help="Publish processed outputs for the services that read them.")
pipeline_app = typer.Typer(help="Run end-to-end pipeline stages.")

app.add_typer(download, name="download")
app.add_typer(process, name="process")
app.add_typer(build, name="build")
app.add_typer(publish, name="publish")
app.add_typer(pipeline_app, name="pipeline")


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


@app.command()
def version() -> None:
    """Print the pipeline version."""
    from wtg_pipeline import __version__

    typer.echo(__version__)


@download.command("era5")
def download_era5(
    years: Annotated[
        str, typer.Option("--years", help='Year range, e.g. "2016-2025" or "2020".')
    ] = "2016-2025",
    variables: Annotated[
        list[str] | None,
        typer.Option(
            "--variable",
            help="CDS variable name; may be passed multiple times. Defaults to all 9.",
        ),
    ] = None,
    force: Annotated[bool, typer.Option("--force", help="Re-download cache hits.")] = False,
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Download ERA5 monthly means from the Copernicus CDS."""
    _setup_logging(verbose)
    from wtg_pipeline.sources import era5

    paths = era5.fetch(years, variables=variables, force=force)
    typer.echo(f"wrote {len(paths)} file(s)")


@download.command("boundaries")
def download_boundaries(
    source: Annotated[
        str,
        typer.Option("--source", help="One of: all, naturalearth, geoboundaries."),
    ] = "all",
    iso3: Annotated[
        list[str] | None,
        typer.Option(
            "--iso3",
            help="ISO-3 country code; repeat for each country (geoBoundaries only).",
        ),
    ] = None,
    force: Annotated[bool, typer.Option("--force", help="Re-download cache hits.")] = False,
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Download boundary layers (Natural Earth + geoBoundaries ADM2)."""
    _setup_logging(verbose)
    from wtg_pipeline.sources import geoboundaries

    paths = geoboundaries.fetch(source, iso3_codes=iso3, force=force)
    typer.echo(f"wrote {len(paths)} file(s)")


@download.command("advisories")
def download_advisories(
    source: Annotated[
        str,
        typer.Option("--source", help="One of: us, uk, ca, au, de, nl, all."),
    ] = "all",
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Scrape government travel advisories and write normalised JSON."""
    _setup_logging(verbose)
    from wtg_pipeline.sources.advisories import SCRAPERS, write_advisories

    source = source.lower()
    targets = list(SCRAPERS.keys()) if source == "all" else [source]
    unknown = [s for s in targets if s not in SCRAPERS]
    if unknown:
        raise typer.BadParameter(f"unknown advisory source(s): {', '.join(unknown)}")

    failed: list[str] = []
    for key in targets:
        cls = SCRAPERS[key]
        # One government being down must not cost us the other five. This
        # loop used to abort on the first exception, so a single 403 meant a
        # `--source all` run scraped *nothing* and consolidation quietly
        # carried on with whatever was last on disk.
        try:
            with cls() as scraper:
                advisories = scraper.run()
        except Exception as exc:  # noqa: BLE001 — one source, not the run
            failed.append(key)
            typer.echo(f"{cls.source_id}: FAILED ({type(exc).__name__}: {exc})")
            continue

        if not advisories:
            # An empty result is not a country with no advisories, it is a
            # scrape that did not work — the CA API intermittently answers
            # 200 with `[]`. Writing it would make it the newest dump and
            # silently replace a good one.
            failed.append(key)
            typer.echo(
                f"{cls.source_id}: FAILED (returned no records; keeping the previous dump)"
            )
            continue

        path = write_advisories(advisories, source_id=cls.source_id)
        typer.echo(f"{cls.source_id}: {len(advisories)} record(s) -> {path}")

    if failed:
        # Non-zero so cron notices, but only after every other source has had
        # its turn and written its dump.
        typer.echo(f"{len(failed)} source(s) failed: {', '.join(sorted(failed))}")
        raise typer.Exit(code=1)


@process.command("aggregate")
def process_aggregate(
    level: Annotated[
        str, typer.Option("--level", help="One of: country, admin1, admin2, all.")
    ] = "all",
    years: Annotated[
        str, typer.Option("--years", help='Year range, e.g. "2016-2025".')
    ] = "2016-2025",
    force: Annotated[bool, typer.Option("--force", help="Ignore cached outputs.")] = False,
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Aggregate ERA5 rasters over boundary polygons (exactextract)."""
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import run_aggregate

    run_aggregate(level=level, years_spec=years, force=force)


@process.command("percentiles")
def process_percentiles(
    level: Annotated[
        str, typer.Option("--level", help="One of: country, admin1, admin2, all.")
    ] = "all",
    force: Annotated[bool, typer.Option("--force", help="Ignore cached outputs.")] = False,
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Compute p10/p50/p90 per (polygon, month, variable) over 10 years."""
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import run_percentiles

    run_percentiles(level=level, force=force)


@process.command("advisories")
def process_advisories(
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Consolidate the scraped advisories into the tile + API artifacts.

    Writes `data/final/advisories.json` (full detail per government) and
    `data/intermediate/advisories/safety_index.json` (levels only, the input
    to `wtg build geojson`). Both are left untouched when nothing changed, so
    hashing the index tells the weekly cron whether a tile rebuild is
    warranted.
    """
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import run_process_advisories

    result = run_process_advisories()
    typer.echo(
        f"countries={result.countries} regions={result.regions} "
        f"detail={'changed' if result.detail_changed else 'unchanged'} "
        f"levels={'changed' if result.levels_changed else 'unchanged'}"
    )
    for source_id, age in result.aged.items():
        # Same tag as the log line, so a run's stdout in the cron log greps
        # the same way its logger output does.
        typer.echo(
            f"WARNING: ADVISORY_STALE {source_id} was last scraped {age} days ago "
            f"(threshold {result.stale_after_days})"
        )
    for source_id, lag in result.stale.items():
        typer.echo(f"WARNING: {source_id} is {lag} days behind the freshest source")
    typer.echo(f"wrote {result.detail_path}")
    typer.echo(f"wrote {result.index_path}")


@process.command("sunshine")
def process_sunshine(
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Derive sunshine hours from SSRD and validate against reference cities."""
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import validate_sunshine

    ok = validate_sunshine()
    if not ok:
        raise typer.Exit(code=1)


@process.command("scoring")
def process_scoring(
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Precompute free-tier default match scores (sanity check only)."""
    _setup_logging(verbose)
    typer.echo("scoring defaults are applied inline during `wtg build geojson`.")


@build.command("geojson")
def build_geojson(
    tier: Annotated[str, typer.Option("--tier", help="free or premium.")] = "free",
    force: Annotated[bool, typer.Option("--force", help="Ignore cached outputs.")] = False,
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Produce the final GeoJSON per tier (country + admin1 [+ admin2])."""
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import run_build_geojson

    run_build_geojson(tier=tier, force=force)


@build.command("pmtiles")
def build_pmtiles(
    tier: Annotated[str, typer.Option("--tier", help="free or premium.")] = "free",
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Run tippecanoe + pmtiles convert to produce tiles/<tier>.pmtiles."""
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import run_build_pmtiles

    out = run_build_pmtiles(tier=tier)
    typer.echo(f"wrote {out}")


@publish.command("api-data")
def publish_api_data(
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """Write the per-country JSON bundle the API serves to the SSR pages.

    Reads the percentiles Parquet, the boundary layers and `advisories.json`,
    and writes `data/final/api/` — one payload per country plus an index. The
    API mounts that directory read-only; the web generates its static route
    tree from the index, so the pages that exist are exactly the countries
    this step could answer for.

    Unchanged payloads are left untouched, so re-running is a no-op.
    """
    _setup_logging(verbose)
    from wtg_pipeline.publish.api_data import run_publish_api_data

    result = run_publish_api_data()
    typer.echo(
        f"countries={result.published} changed={result.changed} "
        f"pruned={result.pruned} skipped={len(result.skipped)}"
    )
    typer.echo(f"wrote {result.index}")
    if result.skipped:
        typer.echo(f"no complete climate series for: {', '.join(result.skipped)}")


@pipeline_app.command("full")
def pipeline_full(
    years: Annotated[str, typer.Option("--years")] = "2016-2025",
    verbose: Annotated[bool, typer.Option("--verbose", "-v")] = False,
) -> None:
    """End-to-end: aggregate → percentiles → geojson → pmtiles for both tiers."""
    _setup_logging(verbose)
    from wtg_pipeline.pipeline_runner import run_full

    run_full(years_spec=years)


if __name__ == "__main__":
    app()
