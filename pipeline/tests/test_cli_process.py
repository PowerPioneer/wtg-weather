from __future__ import annotations

import re

from typer.testing import CliRunner

from wtg_pipeline.cli import app

runner = CliRunner()

_ANSI = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")


def _plain(output: str) -> str:
    """Strip ANSI escapes + collapse whitespace so Rich-styled Typer help
    can be asserted against with plain substrings. Rich wraps flags inside
    a bordered box and in CI may colourise them, so `"--flag" in stdout`
    fails even when the flag is rendered."""
    return re.sub(r"\s+", " ", _ANSI.sub("", output))


def test_process_aggregate_help() -> None:
    result = runner.invoke(app, ["process", "aggregate", "--help"])
    assert result.exit_code == 0
    out = _plain(result.stdout)
    assert "--level" in out
    assert "--years" in out


def test_process_percentiles_help() -> None:
    result = runner.invoke(app, ["process", "percentiles", "--help"])
    assert result.exit_code == 0


def test_process_sunshine_runs() -> None:
    # Sunshine validation uses a synthetic SSRD — no network, no heavy deps.
    result = runner.invoke(app, ["process", "sunshine"])
    assert result.exit_code == 0


def test_process_advisories_help() -> None:
    result = runner.invoke(app, ["process", "advisories", "--help"])
    assert result.exit_code == 0


def test_process_advisories_reports_what_changed(tmp_path, monkeypatch) -> None:
    """The weekly cron branches on this output; keep it machine-readable.

    `levels=unchanged` is what lets the cron skip a tile rebuild and a full
    bunny.net purge on a week when no government moved.
    """
    from datetime import datetime, timezone

    from wtg_pipeline.sources.advisories.base import Advisory, write_advisories

    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))
    write_advisories(
        [
            Advisory(
                country_iso2="JP",
                region_code=None,
                level=1,
                summary="Normal precautions",
                source_url="https://example.gov/jp",
                fetched_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
            )
        ],
        source_id="us_state",
        base_dir=tmp_path / "raw" / "advisories",
    )

    first = runner.invoke(app, ["process", "advisories"])
    assert first.exit_code == 0, first.output
    assert "countries=1" in first.stdout
    assert "levels=changed" in first.stdout

    second = runner.invoke(app, ["process", "advisories"])
    assert second.exit_code == 0
    assert "levels=unchanged" in second.stdout


def test_process_advisories_fails_without_a_scrape(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))
    result = runner.invoke(app, ["process", "advisories"])
    assert result.exit_code != 0
    assert isinstance(result.exception, FileNotFoundError)


def test_build_geojson_help() -> None:
    result = runner.invoke(app, ["build", "geojson", "--help"])
    assert result.exit_code == 0
    assert "--tier" in _plain(result.stdout)


def test_build_pmtiles_help() -> None:
    result = runner.invoke(app, ["build", "pmtiles", "--help"])
    assert result.exit_code == 0


def test_publish_api_data_help() -> None:
    result = runner.invoke(app, ["publish", "api-data", "--help"])
    assert result.exit_code == 0


def test_publish_api_data_says_which_step_is_missing(tmp_path, monkeypatch) -> None:
    """The failure has to name the step, not just the absent file.

    This runs on the build box after a fresh checkout more often than not, and
    "percentiles/country.parquet is missing" is only actionable if it also says
    which command produces it.
    """
    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))
    result = runner.invoke(app, ["publish", "api-data"])
    assert result.exit_code != 0
    assert isinstance(result.exception, FileNotFoundError)
    assert "wtg process percentiles" in str(result.exception)


def test_pipeline_full_help() -> None:
    result = runner.invoke(app, ["pipeline", "full", "--help"])
    assert result.exit_code == 0
