"""Weekly alert runner — invoked by host cron via `infra/scripts/weekly-alerts.sh`.

Runs **inside the api container**, because it needs Postgres and Postgres is on
the internal-only Docker network `infra/CLAUDE.md` forbids exposing to the host.
That is the opposite of the pipeline's weekly jobs, which run `uv` on the host
because they touch files there. The script uses `docker compose run --rm api`
rather than `exec` for the reason `infra/CLAUDE.md` gives for migrations: `exec`
needs the serving container to already be up, and a job that skips a week
because a deploy was in progress is a job that misses a transition.

    docker compose run --rm api python -m wtg_api.jobs.alerts_weekly

Exits 0 on success even if individual sends failed — those are counted in the
JSON report on stdout and retried next week (see `run_weekly`). Exits non-zero
on anything fatal, so cron's log pipeline surfaces it: a missing country bundle
is the loud one, because scoring every alert against nothing would otherwise be
indistinguishable from a quiet week.

`--dry-run` scores everything and reports, sending nothing. Useful to see what
a run *would* do against production data without mailing anybody.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from wtg_api.db import get_sessionmaker
from wtg_api.services.alert_scoring import BundleMatchScorer
from wtg_api.services.alerts import run_weekly
from wtg_api.services.email import EmailMessage, build_provider
from wtg_api.services.email import redact_email

log = logging.getLogger("wtg_api.jobs.alerts_weekly")


class DryRunEmail:
    """Counts what would have gone out. Logs the recipient redacted."""

    def __init__(self) -> None:
        self.count = 0

    async def send(self, message: EmailMessage) -> None:
        self.count += 1
        log.info(
            "alerts.dry_run would_send to=%s subject=%s",
            redact_email(message.to),
            message.subject,
        )


async def _main(dry_run: bool) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    sessionmaker = get_sessionmaker()
    email_provider = DryRunEmail() if dry_run else build_provider()
    # Not the stub: a run that cannot reach the published bundle should fail
    # loudly (`CountryDataUnavailable` propagates out of here), not report a
    # clean week for every alert.
    scorer = BundleMatchScorer()

    async with sessionmaker() as session:
        report = await run_weekly(session, email_provider, scorer, persist=not dry_run)

    payload = report.as_dict()
    payload["dry_run"] = dry_run
    print(json.dumps(payload, default=str))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="score and report, but send nothing",
    )
    args = parser.parse_args(argv)
    return asyncio.run(_main(args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
