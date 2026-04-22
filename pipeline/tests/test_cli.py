from __future__ import annotations

from typer.testing import CliRunner

from wtg_pipeline import __version__
from wtg_pipeline.cli import app


def test_version() -> None:
    runner = CliRunner()
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.stdout
