"""Wrapper around the ``tippecanoe`` CLI.

Tippecanoe converts GeoJSON → MBTiles. Per ``pipeline/CLAUDE.md`` the
tier-specific flag sets are::

    free:    -Z0 -z5 --coalesce-smallest-as-needed
    premium: -Z0 -z9 --coalesce-smallest-as-needed --drop-densest-as-needed

The binary is expected on ``PATH``. On the dev box and in CI it is
installed via Homebrew / apt (``tippecanoe``). Inside Docker the pipeline
image installs it at build time.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

log = logging.getLogger(__name__)

Tier = Literal["free", "premium"]

# `--no-tiny-polygon-reduction` and the raised byte ceiling are load-bearing,
# not tuning. The original flags were chosen when admin-1 held 294 coarse 1:50m
# polygons; it now holds 4,596 detailed 1:10m ones. At the 500KB default,
# tippecanoe's tiny-polygon reduction was discarding most of them in the
# mid-zoom band — measured at 20% of source surviving at z3, 42% at z4 and 61%
# at z5. Every discarded polygon is a hole on the map, because the country
# layer stops at zoom 3.5 and nothing paints underneath admin-1 above it.
#
# `--coalesce-smallest-as-needed` stays as the last-resort valve so a tile can
# never grow without bound; it merges rather than drops.
#
# Raised 2MB → 6MB on 2026-09-23, because the daily rebuild made every feature
# fatter and 2MB stopped being enough. The statistics per feature went from a
# p10/p50/p90 triplet to mean/p5/p50/p95 across more variables — admin-1's
# GeoJSON grew 85MB → 115MB for the same 4,596 polygons — and tippecanoe went
# back to coalescing in exactly the band this ceiling exists to protect.
# Measured on the first daily build: admin-1 coverage fell to 53% at z3 and
# 80% at z4, against the 98% the tests require above the country handover.
# Tippecanoe named the tiles it could not fit:
#
#     free     3/4/3 2.66MB   3/4/2 3.92MB   4/8/5 2.54MB
#     premium  3/4/2 4.72MB   3/4/3 3.14MB   4/8/5 3.04MB   0/0/0 2.13MB
#
# 6MB clears the largest of those with headroom. It is a ceiling, not a target:
# only a handful of low-zoom tiles come anywhere near it.
#
# The better fix is to stop shipping properties nothing reads — roughly 264 of
# the 438 per feature are stat-suffixed keys (`t2m_max_p95_07` and friends) that
# no paint expression or panel looks up, because the map reads the short
# `t_/r_/s_` aliases and `readMonthlyBands` asks for a `_p10/_p50/_p90` triplet
# under names the daily rebuild renamed. Slimming those would put tiles *below*
# their pre-rebuild size and let this ceiling come back down. Deliberately not
# done here: it changes what the map panel can chart, which is its own decision.
_MAX_TILE_BYTES = "6000000"

FREE_FLAGS: tuple[str, ...] = (
    "-Z0",
    "-z5",
    "--no-tiny-polygon-reduction",
    f"--maximum-tile-bytes={_MAX_TILE_BYTES}",
    "--coalesce-smallest-as-needed",
)
PREMIUM_FLAGS: tuple[str, ...] = (
    "-Z0",
    "-z9",
    "--no-tiny-polygon-reduction",
    f"--maximum-tile-bytes={_MAX_TILE_BYTES}",
    "--coalesce-smallest-as-needed",
    "--drop-densest-as-needed",
)


@dataclass(frozen=True)
class TippecanoeJob:
    tier: Tier
    inputs: tuple[Path, ...]
    output: Path
    layer_names: tuple[str, ...]  # one per input

    def __post_init__(self) -> None:
        if len(self.inputs) != len(self.layer_names):
            raise ValueError("inputs and layer_names must be the same length")


def tier_flags(tier: Tier) -> tuple[str, ...]:
    if tier == "free":
        return FREE_FLAGS
    if tier == "premium":
        return PREMIUM_FLAGS
    raise ValueError(f"unknown tier: {tier!r}")


def build_command(job: TippecanoeJob, *, tippecanoe_bin: str = "tippecanoe") -> list[str]:
    """Build the tippecanoe argv for a job.

    Exposed for testing — constructs the command deterministically so unit
    tests can assert flags/layers without actually shelling out.
    """
    cmd: list[str] = [tippecanoe_bin, *tier_flags(job.tier), "-o", str(job.output), "--force"]
    for layer_name, input_path in zip(job.layer_names, job.inputs, strict=True):
        cmd.extend(["-L", f"{layer_name}:{input_path}"])
    return cmd


def run(job: TippecanoeJob, *, tippecanoe_bin: str = "tippecanoe") -> Path:
    """Shell out to tippecanoe. Returns the output mbtiles path."""
    resolved = shutil.which(tippecanoe_bin)
    if resolved is None:
        raise RuntimeError(
            f"{tippecanoe_bin} not found on PATH. Install via `brew install tippecanoe` "
            "or `apt install tippecanoe`."
        )
    for inp in job.inputs:
        if not inp.exists():
            raise FileNotFoundError(inp)
    job.output.parent.mkdir(parents=True, exist_ok=True)
    cmd = build_command(job, tippecanoe_bin=resolved)
    log.info("running: %s", " ".join(cmd))
    subprocess.run(cmd, check=True)
    if not job.output.exists():
        raise RuntimeError(f"tippecanoe produced no output at {job.output}")
    return job.output
