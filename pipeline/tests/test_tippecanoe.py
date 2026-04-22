from __future__ import annotations

from pathlib import Path

import pytest

from wtg_pipeline.tiles.tippecanoe import (
    FREE_FLAGS,
    PREMIUM_FLAGS,
    TippecanoeJob,
    build_command,
    tier_flags,
)


def test_tier_flags_match_claudemd() -> None:
    # These MUST match pipeline/CLAUDE.md verbatim — downstream caching
    # assumptions depend on the tippecanoe invocation staying stable.
    assert FREE_FLAGS == ("-Z0", "-z5", "--coalesce-smallest-as-needed")
    assert PREMIUM_FLAGS == (
        "-Z0",
        "-z9",
        "--coalesce-smallest-as-needed",
        "--drop-densest-as-needed",
    )
    assert tier_flags("free") == FREE_FLAGS
    assert tier_flags("premium") == PREMIUM_FLAGS


def test_tier_flags_rejects_unknown() -> None:
    with pytest.raises(ValueError):
        tier_flags("gold")  # type: ignore[arg-type]


def test_build_command_assembles_layers(tmp_path: Path) -> None:
    a = tmp_path / "a.geojson"
    b = tmp_path / "b.geojson"
    a.write_text("{}")
    b.write_text("{}")
    out = tmp_path / "out.mbtiles"
    job = TippecanoeJob(
        tier="free",
        inputs=(a, b),
        output=out,
        layer_names=("country", "admin1"),
    )
    cmd = build_command(job, tippecanoe_bin="tippecanoe")
    assert cmd[0] == "tippecanoe"
    for f in FREE_FLAGS:
        assert f in cmd
    assert "-o" in cmd and str(out) in cmd
    assert f"country:{a}" in cmd
    assert f"admin1:{b}" in cmd


def test_mismatched_layers_raises(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        TippecanoeJob(
            tier="free",
            inputs=(tmp_path / "a.geojson",),
            output=tmp_path / "out.mbtiles",
            layer_names=("country", "admin1"),
        )
