from __future__ import annotations

from datetime import datetime, timezone

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


def test_one_failing_source_does_not_cost_us_the_others(tmp_path, monkeypatch) -> None:
    """A single 403 used to mean a `--source all` run scraped nothing.

    The loop aborted on the first exception, so the US State scraper being
    Cloudflare-blocked took the other five governments down with it and
    consolidation carried on with whatever was last on disk.
    """
    from typer.testing import CliRunner

    from wtg_pipeline.cli import app
    from wtg_pipeline.sources.advisories.base import Advisory

    monkeypatch.setenv("WTG_PIPELINE_DATA_DIR", str(tmp_path))

    class _Broken:
        source_id = "broken"

        def __enter__(self): return self
        def __exit__(self, *exc): return None
        def run(self): raise RuntimeError("403 Forbidden")

    class _Empty(_Broken):
        source_id = "empty"

        def run(self): return []

    class _Working(_Broken):
        source_id = "working"

        def run(self):
            return [
                Advisory(
                    country_iso2="JP", region_code=None, level=1, summary="Normal",
                    source_url="https://example.gov/jp",
                    fetched_at=datetime(2026, 8, 14, tzinfo=timezone.utc),
                )
            ]

    monkeypatch.setattr(
        "wtg_pipeline.sources.advisories.SCRAPERS",
        {"broken": _Broken, "empty": _Empty, "working": _Working},
    )

    result = CliRunner().invoke(app, ["download", "advisories", "--source", "all"])

    # Non-zero so cron notices — but only after the working source wrote.
    assert result.exit_code == 1
    assert "working: 1 record(s)" in result.stdout
    assert "broken: FAILED" in result.stdout
    # An empty result must not land as a dump that shadows the last good one.
    assert "empty: FAILED" in result.stdout
    assert not (tmp_path / "raw" / "advisories" / "empty").exists()
    assert (tmp_path / "raw" / "advisories" / "working").exists()
