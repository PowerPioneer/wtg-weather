"""`/v1/countries` — the SSR pages' data path.

The bundle these read is written on the build box by `wtg publish api-data`,
so the fixtures here are hand-built rather than generated: what is under test
is the *reading* half — the 404s, the path handling, and the cache
invalidation that lets a rebuild reach a running container.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient

from wtg_api.config import get_settings
from wtg_api.services import country_data

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _series(value: float) -> list[float]:
    return [value] * 12


def _country_payload(slug: str, name: str, iso2: str) -> dict:
    return {
        "slug": slug,
        "name": name,
        "iso2": iso2,
        "region": "South America",
        "summary": f"{name} is warm.",
        "climate": {
            "months": MONTHS,
            "t": _series(22.0),
            "tMin": _series(18.0),
            "tMax": _series(26.0),
            "r": _series(31.0),
            "rDay": _series(1.0),
            "s": _series(7.0),
            "w": _series(11.0),
        },
        "bestMonths": [{"month": "June", "score": 90, "note": "22 °C · 31 mm · 7.0 h sun"}],
        "regions": [
            {
                "name": "Cusco",
                "slug": "cusco",
                "score": 90,
                "tl": _series(13.0),
                "rl": _series(1.5),
                "sl": _series(7.2),
                "advisory": {"level": 4, "label": "Do not travel", "code": "PE-CUS"},
            },
            {
                "name": "Lima",
                "slug": "lima",
                "score": 80,
                "tl": _series(19.0),
                "rl": _series(0.1),
                "sl": _series(6.0),
            },
        ],
        "related": [],
        "monthNotes": {m: f"Around 22 °C in {m}." for m in MONTHS},
        "capital": "Lima",
        "tz": "America/Lima",
        "area": "1,285,216 km²",
        "advisories": {
            "combined": {"level": 2, "label": "Exercise increased caution"},
            "lastUpdated": "2026-04-18",
            "sources": [
                {
                    "gov": "United States",
                    "level": 2,
                    "label": "Exercise increased caution",
                    "date": "2026-04-12",
                    "url": "https://example.gov/peru",
                    "checked": "2026-08-14",
                }
            ],
            "regionalMax": 4,
            "regionalMaxLabel": "Do not travel",
        },
    }


@pytest.fixture
def bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    settings = get_settings()
    monkeypatch.setattr(settings, "country_data_dir", str(tmp_path), raising=False)
    country_data.reset_cache()

    countries = tmp_path / "countries"
    countries.mkdir(parents=True)
    (countries / "peru.json").write_text(
        json.dumps(_country_payload("peru", "Peru", "PE")), encoding="utf-8"
    )
    (tmp_path / "index.json").write_text(
        json.dumps(
            {
                "countries": [
                    {"slug": "peru", "name": "Peru", "iso2": "PE", "region": "South America"}
                ]
            }
        ),
        encoding="utf-8",
    )
    yield tmp_path
    country_data.reset_cache()


@pytest_asyncio.fixture
async def api(client: AsyncClient, bundle: Path) -> AsyncClient:
    return client


@pytest.mark.asyncio
async def test_index_lists_published_countries(api: AsyncClient) -> None:
    res = await api.get("/v1/countries")
    assert res.status_code == 200
    assert res.json() == [
        {"slug": "peru", "name": "Peru", "iso2": "PE", "region": "South America"}
    ]


@pytest.mark.asyncio
async def test_country_returns_the_web_shape(api: AsyncClient) -> None:
    res = await api.get("/v1/countries/peru")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Peru"
    assert body["climate"]["months"][0] == "Jan"
    # mm/day is what the scoring rule consumes; mm/month is what the page prints.
    assert body["climate"]["rDay"][0] == 1.0
    assert body["climate"]["r"][0] == 31.0
    assert body["regions"][0]["slug"] == "cusco"
    assert body["advisories"]["regionalMax"] == 4
    # No country row was marked as derived, so the default holds.
    assert body["climateBasis"] == "country"


@pytest.mark.asyncio
async def test_advisory_checked_date_reaches_the_client(api: AsyncClient) -> None:
    """The two-repo round trip for the field the stale badge reads.

    `wtg publish api-data` emitting `checked` proves nothing on its own: the
    response model filters the payload, so a field `AdvisorySource` does not
    declare is dropped between the bundle on disk and the JSON the country
    page renders. This is the assertion that the pipeline change actually
    arrives — the same lesson `RegionRow.code` and `advisory` were learned on.
    """
    res = await api.get("/v1/countries/peru")
    source = res.json()["advisories"]["sources"][0]

    assert source["checked"] == "2026-08-14"
    # And the field it must not be confused with is still its own thing.
    assert source["date"] == "2026-04-12"


@pytest.mark.asyncio
async def test_a_bundle_without_checked_still_serves(
    client: AsyncClient, bundle: Path
) -> None:
    """An older `advisories.json` predates the field and must not 500.

    The web reads a missing `checked` as "cannot judge freshness" and leaves
    the badge alone, which is the honest answer for a bundle that never
    recorded when it was scraped.
    """
    payload = json.loads(
        (bundle / "countries" / "peru.json").read_text(encoding="utf-8")
    )
    for source in payload["advisories"]["sources"]:
        source.pop("checked")
    (bundle / "countries" / "peru.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )
    country_data.reset_cache()

    res = await client.get("/v1/countries/peru")

    assert res.status_code == 200
    assert res.json()["advisories"]["sources"][0]["checked"] is None


@pytest.mark.asyncio
async def test_premium_variables_are_not_in_the_response(api: AsyncClient) -> None:
    """The payload is the public HTML of a statically generated page.

    Snow, SST, heat index and humidity are the four the premium tier sells.
    The response model has no fields for them, so even a bundle that somehow
    carried them could not leak them through this route.
    """
    res = await api.get("/v1/countries/peru")
    body = res.json()
    assert set(body["climate"]) == {"months", "t", "tMin", "tMax", "r", "rDay", "s", "w"}


@pytest.mark.asyncio
async def test_unknown_country_is_404(api: AsyncClient) -> None:
    res = await api.get("/v1/countries/atlantis")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_region_returns_country_and_region(api: AsyncClient) -> None:
    res = await api.get("/v1/countries/peru/regions/cusco")
    assert res.status_code == 200
    body = res.json()
    assert body["country"]["slug"] == "peru"
    assert body["region"]["name"] == "Cusco"


@pytest.mark.asyncio
async def test_unknown_region_is_404(api: AsyncClient) -> None:
    res = await api.get("/v1/countries/peru/regions/narnia")
    assert res.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "slug",
    [
        "../index",
        "..%2findex",
        "peru/../../etc/passwd",
        "peru.json",
        "peru_",
        "-peru",
        "",
    ],
)
async def test_slug_traversal_and_shape_abuse_is_refused(
    api: AsyncClient, slug: str
) -> None:
    """The slug is interpolated into a filesystem path.

    Every one of these is either a 404 or a route that does not exist; none
    may return a file.
    """
    res = await api.get(f"/v1/countries/{slug}")
    assert res.status_code in (404, 307, 405), res.status_code


@pytest.mark.asyncio
async def test_case_is_tolerated_and_the_payload_names_the_canonical_slug(
    api: AsyncClient,
) -> None:
    """Forgiving on input, canonical on output.

    The only caller generates slugs from the index, so case never varies in
    practice; when it does, resolving it beats a 404. The canonical URL is
    the `slug` in the payload, which is what the page's canonical tag uses.
    """
    res = await api.get("/v1/countries/PERU")
    assert res.status_code == 200
    assert res.json()["slug"] == "peru"


@pytest.mark.asyncio
async def test_missing_bundle_is_503_not_an_empty_site(
    client: AsyncClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A deploy that forgot the mount must not look like "no countries exist".

    The web builds its entire static route tree from this index. Answering
    `[]` would produce a site with no country pages and no error anywhere.
    """
    monkeypatch.setattr(
        get_settings(), "country_data_dir", str(tmp_path / "absent"), raising=False
    )
    country_data.reset_cache()
    res = await client.get("/v1/countries")
    assert res.status_code == 503
    assert "publish api-data" in res.json()["detail"]
    country_data.reset_cache()


@pytest.mark.asyncio
async def test_a_republished_payload_is_picked_up_without_a_restart(
    api: AsyncClient, bundle: Path
) -> None:
    """`rebuild-tiles.sh` and the weekly advisory cron do not restart the API.

    They rewrite the bundle underneath a running container, so a cache keyed
    on anything but the file's mtime would serve last year's climate until
    somebody noticed.
    """
    first = await api.get("/v1/countries/peru")
    assert first.json()["summary"] == "Peru is warm."

    payload = _country_payload("peru", "Peru", "PE")
    payload["summary"] = "Peru is, on reflection, temperate."
    path = bundle / "countries" / "peru.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    # Bind mounts preserve mtime at second granularity on some filesystems;
    # nudge it so the test does not depend on how fast it ran.
    import os

    stat = path.stat()
    os.utime(path, (stat.st_atime + 2, stat.st_mtime + 2))

    second = await api.get("/v1/countries/peru")
    assert second.json()["summary"] == "Peru is, on reflection, temperate."


@pytest.mark.asyncio
async def test_a_corrupt_payload_is_404_not_500(
    api: AsyncClient, bundle: Path
) -> None:
    """A publish caught mid-write should cost one page, not the route."""
    (bundle / "countries" / "peru.json").write_text("{ not json", encoding="utf-8")
    country_data.reset_cache()
    res = await api.get("/v1/countries/peru")
    assert res.status_code == 404


@pytest.mark.anyio
async def test_a_region_carve_out_survives_the_response_model(api: AsyncClient) -> None:
    """The response model filters the payload, so a new field must be declared.

    The pipeline resolved "do not travel to Ayacucho" to an ISO-3166-2 code
    and put it on the region row; without `advisory` on the schema it was
    silently dropped between the bundle and the page, and the region page
    rendered as though no carve-out existed.
    """
    res = await api.get("/v1/countries/peru")
    assert res.status_code == 200
    regions = {r["slug"]: r for r in res.json()["regions"]}

    assert regions["cusco"]["advisory"] == {
        "level": 4,
        "label": "Do not travel",
        "code": "PE-CUS",
    }
    # A region with no carve-out carries the field as null, not as a level.
    assert regions["lima"]["advisory"] is None


@pytest.mark.anyio
async def test_region_endpoint_carries_the_carve_out_too(api: AsyncClient) -> None:
    res = await api.get("/v1/countries/peru/regions/cusco")
    assert res.status_code == 200
    assert res.json()["region"]["advisory"]["code"] == "PE-CUS"


# --- curated activities ---
#
# These exist because the failure mode is *silent*. `CountryData` filters the
# payload, so an activities block the pipeline writes correctly is dropped
# without an error anywhere if the response model does not name it: pipeline
# tests green, bundle right on disk, live page rendering nothing. That has cost
# a full deploy cycle before, on the region-advisory field.


ACTIVITY_BLOCK = {
    "reviewed": "2026-08-28",
    "lede": "February is the only month Peru closes anything; one of the 6 below runs all year.",
    "items": [
        {
            "id": "inca-trail",
            "name": "Classic Inca Trail",
            "kind": "trek",
            "regions": ["PE-CUS"],
            "yearRound": False,
            "datedEvent": False,
            "onMonths": list(range(1, 13)),
            "sources": [{"url": "https://example.test/inca", "checked": "2026-08-28"}],
        }
    ],
    "months": {
        m: {
            "lede": "February is the only month Peru closes anything — 1 thing below.",
            "rows": [{"id": "inca-trail", "status": "closed", "reason": "annual maintenance"}],
        }
        for m in MONTHS
    },
}


@pytest.fixture
def curated_bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """The same bundle as `bundle`, with an activities block attached."""
    settings = get_settings()
    monkeypatch.setattr(settings, "country_data_dir", str(tmp_path), raising=False)
    country_data.reset_cache()

    payload = _country_payload("peru", "Peru", "PE")
    payload["activities"] = ACTIVITY_BLOCK
    payload["regions"][0]["activities"] = ["inca-trail"]

    countries = tmp_path / "countries"
    countries.mkdir(parents=True)
    (countries / "peru.json").write_text(json.dumps(payload), encoding="utf-8")
    (tmp_path / "index.json").write_text(
        json.dumps(
            {"countries": [{"slug": "peru", "name": "Peru", "iso2": "PE", "region": "South America"}]}
        ),
        encoding="utf-8",
    )
    yield tmp_path
    country_data.reset_cache()


@pytest_asyncio.fixture
async def curated_api(client: AsyncClient, curated_bundle: Path) -> AsyncClient:
    return client


@pytest.mark.asyncio
async def test_activities_block_survives_the_response_model(curated_api: AsyncClient) -> None:
    body = (await curated_api.get("/v1/countries/peru")).json()

    activities = body.get("activities")
    assert activities is not None, "activities dropped by the response model"
    assert activities["reviewed"] == "2026-08-28"
    assert activities["items"][0]["id"] == "inca-trail"
    # The citation is the anti-hallucination mechanism; it has to reach the page.
    assert activities["items"][0]["sources"][0]["url"] == "https://example.test/inca"
    assert activities["months"]["Feb"]["rows"][0]["status"] == "closed"
    assert "closes anything" in activities["months"]["Feb"]["lede"]


@pytest.mark.asyncio
async def test_region_activity_ids_survive_the_response_model(curated_api: AsyncClient) -> None:
    body = (await curated_api.get("/v1/countries/peru")).json()
    cusco = next(r for r in body["regions"] if r["slug"] == "cusco")
    assert cusco["activities"] == ["inca-trail"]


@pytest.mark.asyncio
async def test_an_uncurated_country_serves_without_activities(api: AsyncClient) -> None:
    """Most of the world has no curated file; that must not be an error."""
    body = (await api.get("/v1/countries/peru")).json()
    assert body["activities"] is None
    assert body["regions"][0].get("activities") is None
