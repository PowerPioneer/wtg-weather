"""Publish steps: turn processed pipeline outputs into what a service reads.

Everything under ``processing/`` and ``tiles/`` produces artifacts for the map.
This package produces artifacts for the **API** — the SSR country and region
pages, which need names, prose and per-month numbers rather than polygons.
"""

from __future__ import annotations
