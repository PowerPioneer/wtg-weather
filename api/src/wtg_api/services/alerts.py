"""Alert matching + weekly runner.

A user's alert is a `(country, region, month, preferences)` tuple with an
`active` flag. Each scheduled run recomputes match status, and when that
status transitions (newly matches, or stopped matching), we queue a
notification email. The first observation after creation is treated as the
baseline: we record the result but do not email — otherwise a newly-created
alert would fire an immediate "now matches" for any country that already
does, which is noise.

The climate scorer is injected: in production it calls into the pipeline's
aggregated dataset; in tests (and until that dataset lands) a deterministic
stub keeps everything reproducible. See `MatchScorer`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from wtg_api.models import Alert, User
from wtg_api.services.email import EmailMessage, EmailProvider

logger = logging.getLogger(__name__)


class MatchScorer(Protocol):
    """Decides whether an alert's polygon × month currently matches."""

    def score(self, alert: Alert) -> bool: ...


class StubMatchScorer:
    """Placeholder scorer used until the pipeline's climate dataset is wired in.

    Returns False for every alert, which means runs are safely no-ops rather
    than firing emails against un-populated data.
    """

    def score(self, alert: Alert) -> bool:  # noqa: ARG002
        return False


@dataclass
class WeeklyReport:
    checked: int = 0
    newly_matched: int = 0
    no_longer_matched: int = 0
    unchanged: int = 0
    emails_sent: int = 0
    baselines_recorded: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, int | list[str]]:
        return {
            "checked": self.checked,
            "newly_matched": self.newly_matched,
            "no_longer_matched": self.no_longer_matched,
            "unchanged": self.unchanged,
            "emails_sent": self.emails_sent,
            "baselines_recorded": self.baselines_recorded,
            "errors": self.errors,
        }


def _describe(alert: Alert) -> str:
    parts: list[str] = []
    if alert.country_iso2:
        parts.append(alert.country_iso2)
    if alert.region_code:
        parts.append(alert.region_code)
    if alert.month is not None:
        parts.append(f"month {alert.month:02d}")
    return " · ".join(parts) if parts else "your saved criteria"


def _build_email(user: User, alert: Alert, *, now_matches: bool) -> EmailMessage:
    subject = (
        "Your weather alert now matches" if now_matches else "Your weather alert stopped matching"
    )
    label = _describe(alert)
    if now_matches:
        text = (
            f"Good news — {label} now matches your saved preferences.\n\n"
            "Open the map to see the updated scores:\n"
            "https://wheretogoforgreatweather.com/account\n\n"
            "— Where to Go for Great Weather"
        )
    else:
        text = (
            f"Heads up — {label} no longer matches your saved preferences.\n\n"
            "You can tweak the alert in your account:\n"
            "https://wheretogoforgreatweather.com/account\n\n"
            "— Where to Go for Great Weather"
        )
    return EmailMessage(to=user.email, subject=subject, text=text)


async def run_weekly(
    session: AsyncSession,
    email_provider: EmailProvider,
    scorer: MatchScorer,
    *,
    now: datetime | None = None,
) -> WeeklyReport:
    """Recompute all active alerts; email on transitions only.

    Idempotent within a single invocation: the scorer is pure and
    `last_matched` is written exactly once per alert per run.
    """
    current_time = now or datetime.now(UTC)
    report = WeeklyReport()

    result = await session.execute(
        select(Alert).where(Alert.active.is_(True)).options(selectinload(Alert.user))
    )
    alerts = list(result.scalars().all())

    for alert in alerts:
        report.checked += 1
        try:
            matches = scorer.score(alert)
        except Exception as exc:  # keep other alerts running
            logger.exception("alerts.score_failed alert_id=%s", alert.id)
            report.errors.append(f"{alert.id}: {exc}")
            alert.last_checked_at = current_time
            continue

        prior = alert.last_matched

        if prior is None:
            report.baselines_recorded += 1
        elif prior != matches:
            if matches:
                report.newly_matched += 1
            else:
                report.no_longer_matched += 1
            try:
                await email_provider.send(_build_email(alert.user, alert, now_matches=matches))
                report.emails_sent += 1
            except Exception as exc:  # don't let one bad send abort the batch
                logger.exception("alerts.email_failed alert_id=%s", alert.id)
                report.errors.append(f"{alert.id} email: {exc}")
        else:
            report.unchanged += 1

        alert.last_matched = matches
        alert.last_checked_at = current_time

    await session.commit()
    logger.info("alerts.run_weekly %s", report.as_dict())
    return report
