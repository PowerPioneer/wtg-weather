#!/usr/bin/env python
"""Derive the map's colour-ramp stops from the distribution they colour.

`web/src/lib/display-modes.ts` splits each sequential and diverging ramp with
four `stops`. Those were chosen by eye against the 24-hour mean temperature.
The map now paints the **mean daily maximum**, which is warmer everywhere and
by a different amount in each climate — from about 6 °C of diurnal range in
the wet tropics to 20 °C in a desert — so no single offset fixes them and
guessing one would be inventing a number.

This reads the built percentiles and prints stops at even quantiles of the
actual distribution, so each colour carries roughly a fifth of the world's
land. Run it after aggregation, look at what it prints, and paste the values
into `display-modes.ts`.

    uv run python scripts/derive_ramp_stops.py --variable t2m_max
    uv run python scripts/derive_ramp_stops.py --variable t2m_max --level admin1

Quantiles rather than round numbers on purpose: a ramp whose bins are equally
*populated* uses all five colours everywhere, which is the whole job of a
choropleth. Round numbers look tidier in the source and leave two colours
unused on most of the map.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from wtg_pipeline.processing.percentiles import percentiles_path  # noqa: E402
from wtg_pipeline.processing.units import (  # noqa: E402
    kelvin_to_celsius,
    m_per_day_to_mm_per_day,
    m_s_to_km_h,
    m_to_cm,
)

#: Same SI → display conversions `build_geojson` applies. The stops are
#: compared against display-unit tile values, so they must be derived in
#: display units or they are off by a factor of 3.6 or an offset of 273.
CONVERSIONS = {
    "t2m_max": kelvin_to_celsius,
    "t2m_min": kelvin_to_celsius,
    "t2m_mean": kelvin_to_celsius,
    "sst": kelvin_to_celsius,
    "tp_sum": m_per_day_to_mm_per_day,
    "si10_mean": m_s_to_km_h,
    "sd": m_to_cm,
}

#: Which statistic the map actually paints, in the order build_geojson resolves.
HEADLINE_STATS = ("mean", "p50")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variable", required=True, help="e.g. t2m_max, si10_mean")
    parser.add_argument("--level", default="admin1", help="country | admin1 | admin2")
    parser.add_argument(
        "--bins", type=int, default=5, help="Colours in the ramp (stops = bins - 1)."
    )
    args = parser.parse_args(argv)

    try:
        import numpy as np
        import pandas as pd
    except ImportError:
        print("numpy and pandas required; run `uv sync`.", file=sys.stderr)
        return 1

    path = percentiles_path(args.level)
    if not path.exists():
        print(f"no percentiles at {path}; run `wtg process percentiles` first",
              file=sys.stderr)
        return 1

    frame = pd.read_parquet(path, filters=[("variable", "==", args.variable)])
    if frame.empty:
        print(f"no rows for variable {args.variable!r} in {path.name}", file=sys.stderr)
        return 1

    stat = next((s for s in HEADLINE_STATS if s in frame.columns), None)
    if stat is None:
        print(f"{path.name} carries none of {HEADLINE_STATS}", file=sys.stderr)
        return 1

    convert = CONVERSIONS.get(args.variable, lambda v: v)
    values = np.asarray(frame[stat].dropna(), dtype=float)
    if values.size == 0:
        print(f"every {stat} for {args.variable} is null", file=sys.stderr)
        return 1
    values = np.array([convert(v) for v in values])

    # stops = bins - 1 interior boundaries at even quantiles.
    quantiles = np.linspace(0, 100, args.bins + 1)[1:-1]
    stops = [round(float(v), 1) for v in np.percentile(values, quantiles)]

    print(f"variable   {args.variable}  ({stat}, {args.level}, n={values.size:,})")
    print(f"range      {values.min():.1f} … {values.max():.1f}")
    print(f"quantiles  {', '.join(f'{q:.0f}%' for q in quantiles)}")
    print()
    print(f"      stops: [{', '.join(str(s) for s in stops)}],")
    print()
    print("Suggested tick labels (low / middle / high):")
    low, mid, high = np.percentile(values, [2, 50, 98])
    print(f'      ticks: ["< {low:.0f}", "{mid:.0f}", "> {high:.0f}"],')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
