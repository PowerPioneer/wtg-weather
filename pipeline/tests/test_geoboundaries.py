from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from wtg_pipeline.sources import geoboundaries


class _StubClient:
    def __init__(self, responses: dict[str, httpx.Response]) -> None:
        self.responses = responses
        self.calls: list[str] = []

    def get(self, url: str, **_: object) -> httpx.Response:
        self.calls.append(url)
        if url not in self.responses:
            raise AssertionError(f"unexpected GET {url}")
        return self.responses[url]

    def close(self) -> None:  # satisfy the close() contract
        pass


def _resp(body: bytes | str, *, status: int = 200, content_type: str = "application/octet-stream") -> httpx.Response:
    if isinstance(body, str):
        body = body.encode("utf-8")
    return httpx.Response(
        status_code=status,
        content=body,
        headers={"content-type": content_type},
        request=httpx.Request("GET", "http://stub.local/"),
    )


def test_download_natural_earth_writes_two_zips(tmp_path: Path) -> None:
    stub = _StubClient(
        {
            geoboundaries.NATURAL_EARTH_COUNTRY_URL: _resp(b"PK\x03\x04country-zip"),
            geoboundaries.NATURAL_EARTH_ADMIN1_URL: _resp(b"PK\x03\x04admin1-zip"),
        }
    )
    paths = geoboundaries.download_natural_earth(client=stub, base_dir=tmp_path)
    assert len(paths) == 2
    for p in paths:
        assert p.exists()
        assert p.stat().st_size > 0
    assert len(stub.calls) == 2


def test_download_natural_earth_idempotent(tmp_path: Path) -> None:
    stub = _StubClient(
        {
            geoboundaries.NATURAL_EARTH_COUNTRY_URL: _resp(b"PK\x03\x04country-zip"),
            geoboundaries.NATURAL_EARTH_ADMIN1_URL: _resp(b"PK\x03\x04admin1-zip"),
        }
    )
    geoboundaries.download_natural_earth(client=stub, base_dir=tmp_path)
    # Second pass: no calls expected.
    stub2 = _StubClient({})
    paths = geoboundaries.download_natural_earth(client=stub2, base_dir=tmp_path)
    assert len(paths) == 2
    assert stub2.calls == []


def test_download_geoboundaries_admin2(tmp_path: Path) -> None:
    meta_url = f"{geoboundaries.GEOBOUNDARIES_API}/PER/ADM2/"
    geojson_url = "https://example.org/per-adm2.geojson"
    geojson_body = json.dumps({"type": "FeatureCollection", "features": []})
    stub = _StubClient(
        {
            meta_url: _resp(
                json.dumps({"gjDownloadURL": geojson_url}), content_type="application/json"
            ),
            geojson_url: _resp(geojson_body, content_type="application/json"),
        }
    )
    paths = geoboundaries.download_geoboundaries_admin2(
        ["PER"], client=stub, base_dir=tmp_path
    )
    assert len(paths) == 1
    assert paths[0].read_text(encoding="utf-8") == geojson_body


def test_download_geoboundaries_list_response(tmp_path: Path) -> None:
    meta_url = f"{geoboundaries.GEOBOUNDARIES_API}/BEL/ADM2/"
    geojson_url = "https://example.org/bel-adm2.geojson"
    stub = _StubClient(
        {
            meta_url: _resp(
                json.dumps([{"gjDownloadURL": geojson_url}]), content_type="application/json"
            ),
            geojson_url: _resp('{"type":"FeatureCollection","features":[]}', content_type="application/json"),
        }
    )
    paths = geoboundaries.download_geoboundaries_admin2(
        ["bel"], client=stub, base_dir=tmp_path
    )
    assert len(paths) == 1
    assert paths[0].name == "BEL_ADM2.geojson"


def test_download_geoboundaries_rejects_non_json(tmp_path: Path) -> None:
    meta_url = f"{geoboundaries.GEOBOUNDARIES_API}/ZZZ/ADM2/"
    geojson_url = "https://example.org/zzz.geojson"
    stub = _StubClient(
        {
            meta_url: _resp(
                json.dumps({"gjDownloadURL": geojson_url}), content_type="application/json"
            ),
            geojson_url: _resp("<html>not json</html>"),
        }
    )
    with pytest.raises(ValueError, match="non-JSON"):
        geoboundaries.download_geoboundaries_admin2(
            ["ZZZ"], client=stub, base_dir=tmp_path
        )


def test_default_iso3_roster_contains_sovereign_states() -> None:
    roster = geoboundaries.default_iso3_roster()
    assert len(roster) >= 190
    for code in ("USA", "PER", "JPN", "DEU", "AUS"):
        assert code in roster
    # Codes are normalised to upper-case.
    assert all(c == c.upper() and len(c) == 3 for c in roster)


def test_fetch_rejects_unknown_source(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unknown boundaries source"):
        geoboundaries.fetch("mars", base_dir=tmp_path)
