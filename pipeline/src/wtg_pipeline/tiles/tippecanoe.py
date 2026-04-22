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

FREE_FLAGS: tuple[str, ...] = ("-Z0", "-z5", "--coalesce-smallest-as-needed")
PREMIUM_FLAGS: tuple[str, ...] = (
    "-Z0",
    "-z9",
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
