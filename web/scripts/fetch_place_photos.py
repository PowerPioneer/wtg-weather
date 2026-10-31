"""Download and size the country hero photos listed in `src/lib/place-photos.json`.

usage (from the repo root):

    uv run --no-project --with pillow python web/scripts/fetch_place_photos.py [--force]

Each entry names a Wikimedia Commons file and its 1600px thumbnail. This
fetches the thumbnail, fits it inside 1440×1080 at JPEG quality 82 (enough for the hero at 2× and a phone at 3×) and writes a progressive JPEG
to `public/places/<iso2>.jpg`, which `next/image` then serves as AVIF/WebP at
the sizes the hero asks for. Files already on disk are left alone unless
`--force` is passed, so re-running after adding one country fetches one photo.

The photos are committed (see `place-photos.json`'s README note in
`src/lib/place-photos.ts`): the metadata and the bytes travel together, and a
deploy needs no extra step.

Wikimedia asks every client to send a descriptive User-Agent with a way to
reach its operator; this one names the site. Nothing here disguises the client.
"""

from __future__ import annotations

import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

WEB = Path(__file__).resolve().parents[1]
MANIFEST = WEB / "src" / "lib" / "place-photos.json"
OUT = WEB / "public" / "places"
USER_AGENT = "WTGWeatherPhotoFetch/1.0 (https://wheretogoforgreatweather.com)"
MAX_SIZE = (1440, 1080)
QUALITY = 82


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception:  # noqa: BLE001 - retried, then re-raised
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def main(force: bool) -> int:
    photos = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    failed: list[str] = []
    for iso2, photo in sorted(photos.items()):
        target = OUT / f"{iso2.lower()}.jpg"
        if target.exists() and not force:
            continue
        try:
            image = Image.open(io.BytesIO(fetch(photo["thumbUrl"]))).convert("RGB")
            image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
            image.save(target, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            print(f"{iso2}: {image.width}x{image.height} {target.stat().st_size // 1024} KB")
        except Exception as exc:  # noqa: BLE001 - report every failure, not just the first
            failed.append(f"{iso2}: {exc}")
        time.sleep(0.3)  # be gentle with upload.wikimedia.org

    stale = sorted(p.name for p in OUT.glob("*.jpg") if p.stem.upper() not in photos)
    for line in failed:
        print(f"FAILED {line}", file=sys.stderr)
    if stale:
        print(f"no manifest entry for: {', '.join(stale)}", file=sys.stderr)
    return 1 if failed or stale else 0


if __name__ == "__main__":
    sys.exit(main(force="--force" in sys.argv[1:]))
