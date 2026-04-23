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


def test_build_geojson_help() -> None:
    result = runner.invoke(app, ["build", "geojson", "--help"])
    assert result.exit_code == 0
    assert "--tier" in _plain(result.stdout)


def test_build_pmtiles_help() -> None:
    result = runner.invoke(app, ["build", "pmtiles", "--help"])
    assert result.exit_code == 0


def test_pipeline_full_help() -> None:
    result = runner.invoke(app, ["pipeline", "full", "--help"])
    assert result.exit_code == 0
