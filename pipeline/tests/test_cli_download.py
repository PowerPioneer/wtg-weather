from __future__ import annotations

from typer.testing import CliRunner

from wtg_pipeline.cli import app


def test_download_help_lists_all_sources() -> None:
    runner = CliRunner()
    result = runner.invoke(app, ["download", "--help"])
    assert result.exit_code == 0
    for sub in ("era5", "boundaries", "advisories"):
        assert sub in result.stdout


def test_download_advisories_rejects_unknown_source() -> None:
    runner = CliRunner()
    result = runner.invoke(app, ["download", "advisories", "--source", "mars"])
    assert result.exit_code != 0
