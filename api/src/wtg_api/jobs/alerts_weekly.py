"""Weekly alert runner — invoked by host cron.

Usage (inside the `api` container):

    python -m wtg_api.jobs.alerts_weekly

Exits with status 0 on success (even if some individual alert sends failed;
those are recorded in the JSON report written to stdout). Exits non-zero on
fatal errors (db connection, etc.) so cron's log pipeline surfaces them.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

from wtg_api.db import get_sessionmaker
from wtg_api.services.alerts import StubMatchScorer, run_weekly
from wtg_api.services.email import build_provider


async def _main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    sessionmaker = get_sessionmaker()
    email_provider = build_provider()
    scorer = StubMatchScorer()

    async with sessionmaker() as session:
        report = await run_weekly(session, email_provider, scorer)

    print(json.dumps(report.as_dict(), default=str))
    return 0


def main() -> int:
    return asyncio.run(_main())


if __name__ == "__main__":
    sys.exit(main())
