from __future__ import annotations

from typer.testing import CliRunner

from wtg_pipeline.cli import app

runner = CliRunner()


def test_process_aggregate_help() -> None:
    result = runner.invoke(app, ["process", "aggregate", "--help"])
    assert result.exit_code == 0
    assert "--level" in result.stdout
    assert "--years" in result.stdout


def test_process_percentiles_help() -> None:
    result = runner.invoke(app, ["process", "percentiles", "--help"])
    assert result.exit_code == 0


def test_process_sunshine_runs() -> None:
    # Sunshine validation uses a synthetic SSRD — no network, no heavy deps.
    result = runner.invoke(app, ["process", "sunshine"])
    assert result.exit_code == 0


def test_build_geojson_help() -> None:
    result = runner.invoke(app, ["build", "geojson", "--help"])
    assert result.exit_code == 0
    assert "--tier" in result.stdout


def test_build_pmtiles_help() -> None:
    result = runner.invoke(app, ["build", "pmtiles", "--help"])
    assert result.exit_code == 0


def test_pipeline_full_help() -> None:
    result = runner.invoke(app, ["pipeline", "full", "--help"])
    assert result.exit_code == 0
