from __future__ import annotations

from pathlib import Path

import pytest


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES


@pytest.fixture
def advisory_fixture(fixtures_dir: Path):
    def _read(name: str) -> str:
        return (fixtures_dir / "advisories" / name).read_text(encoding="utf-8")

    return _read


@pytest.fixture(autouse=True)
def _no_real_backoff(monkeypatch):
    """No test may actually sleep on a retry back-off.

    The daily downloader retries a failed CDS job with a 60s/300s/900s
    back-off. That is right in production and intolerable in a test suite:
    adding it silently turned `test_partial_file_is_not_mistaken_for_a_
    finished_chunk` — which simulates a failure on purpose — into a
    twenty-minute hang. Autouse, so a future test that triggers a retry
    cannot reintroduce it.
    """
    from wtg_pipeline.sources import era5_daily

    monkeypatch.setattr(era5_daily, "RETRY_BACKOFF_SECONDS", (0,))
