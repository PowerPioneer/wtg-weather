"""Alert matching + the weekly runner.

A user's alert is a `(country, region, month, preferences)` tuple with an
`active` flag. Each scheduled run recomputes match status against the published
country bundle, and when that status *transitions* — newly matches, or stopped
matching — it emails once. Nothing about today's weather: the numbers are the
ten-year ERA5 climatology, so a transition means the published data changed
(a yearly rebuild) or the user changed the alert.

Four things keep it from becoming a nuisance, in the order they apply:

1. **Baseline.** The first observation after creation records the result and
   sends nothing. Otherwise a newly-created alert on a country that already
   matches would fire an immediate "now matches", which is noise about a fact
   the user was looking at when they created it.
2. **Transition only.** A run where the answer is the same as last week is
   silent. This is what makes a double-run idempotent: the second run sees its
   own writes and finds nothing changed.
3. **Delta guard.** A transition is only mailed when the score has moved at
   least `alert_score_delta_points` from the score at the *last email* — not
   from last week, so a slow drift still accumulates past the threshold. See
   the setting's comment: it is the unconfirmed HANDOFF decision, and it does
   not bind while scores are quantised.
4. **Opt-out.** A user who pressed unsubscribe is skipped, but their alerts
   keep being evaluated and their state keeps being written, so turning email
   back on does not release a backlog of stale transitions.

The scorer is injected. In production it is
:class:`~wtg_api.services.alert_scoring.BundleMatchScorer`; tests substitute a
deterministic one. A scorer returning ``None`` means "the bundle cannot answer
for this alert" — a country with no complete series, a region that went with a
boundary vintage — and that leaves the alert untouched rather than flipping it
to "no longer matches" on the strength of missing data.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from wtg_api.config import get_settings
from wtg_api.models import Alert, User
from wtg_api.services.alert_email import build_message
from wtg_api.services.alert_scoring import AlertOutcome
from wtg_api.services.alert_unsubscribe import issue_unsubscribe_token, unsubscribe_url
from wtg_api.services.country_data import CountryDataUnavailable
from wtg_api.services.email import EmailProvider, redact_email

logger = logging.getLogger(__name__)


class MatchScorer(Protocol):
    """Decides what an alert's polygon × month scores, and whether that matches."""

    def score(self, alert: Alert) -> AlertOutcome | None: ...


class StubMatchScorer:
    """A scorer that knows nothing, for a run that must not send anything.

    Returns ``None`` for every alert, which the runner reads as "no data" — so
    state is left alone and no mail goes out. Useful for exercising the job's
    plumbing against a database without a published bundle behind it.
    """

    def score(self, alert: Alert) -> AlertOutcome | None:  # noqa: ARG002
        return None


@dataclass
class WeeklyReport:
    checked: int = 0
    newly_matched: int = 0
    no_longer_matched: int = 0
    unchanged: int = 0
    emails_sent: int = 0
    baselines_recorded: int = 0
    #: Alerts the bundle could not answer for. Not an error — see the module
    #: docstring — but a number worth watching: a sudden jump means a publish
    #: dropped countries.
    no_data: int = 0
    #: Transitions that did not mail because the user unsubscribed.
    suppressed_unsubscribed: int = 0
    #: Transitions that did not mail because the score barely moved.
    suppressed_below_threshold: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, int | list[str]]:
        return {
            "checked": self.checked,
            "newly_matched": self.newly_matched,
            "no_longer_matched": self.no_longer_matched,
            "unchanged": self.unchanged,
            "emails_sent": self.emails_sent,
            "baselines_recorded": self.baselines_recorded,
            "no_data": self.no_data,
            "suppressed_unsubscribed": self.suppressed_unsubscribed,
            "suppressed_below_threshold": self.suppressed_below_threshold,
            "errors": self.errors,
        }


def _below_threshold(score: int, baseline: int | None) -> bool:
    """Whether this move is too small to mail about.

    ``baseline is None`` never suppresses. That is the state of every alert
    that existed before migration 0008 — already baselined, no score on record
    — and reading "unknown" as "no movement" would silence the first real
    transition for every one of them.
    """
    if baseline is None:
        return False
    return abs(score - baseline) < get_settings().alert_score_delta_points


def _build_email(user: User, alert: Alert, outcome: AlertOutcome):
    return build_message(
        to=user.email,
        now_matches=outcome.matches,
        place=outcome.place,
        month=outcome.month_label,
        score=outcome.score,
        previous_score=alert.last_score,
        place_path=outcome.path,
        unsubscribe_url=unsubscribe_url(issue_unsubscribe_token(user.id, alert.id)),
    )


async def run_weekly(
    session: AsyncSession,
    email_provider: EmailProvider,
    scorer: MatchScorer,
    *,
    now: datetime | None = None,
    persist: bool = True,
) -> WeeklyReport:
    """Recompute all active alerts; email on transitions only.

    Idempotent across runs, not merely within one: every branch writes
    `last_matched` before returning, so a second run over unchanged data takes
    the `unchanged` path and sends nothing. `weekly-alerts.sh` relies on that —
    a cron misfire or a manual retry must not double-mail.

    ``persist=False`` rolls the whole run back. That is what makes `--dry-run`
    honest: a dry run that advanced baselines would suppress the real email the
    following week, which is a worse outcome than not having a dry run.
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
            outcome = scorer.score(alert)
        except CountryDataUnavailable:
            # Not a per-alert failure. The mount is gone, which means *every*
            # alert is about to be un-scorable — logging 400 identical errors
            # and exiting 0 would look like a quiet week. Let it out; the job
            # exits non-zero and cron's log pipeline surfaces it.
            raise
        except Exception as exc:  # keep other alerts running
            # `alert_id` only. The alert names a user, and a user names a
            # mailbox; nothing about the recipient belongs on this line.
            logger.exception("alerts.score_failed alert_id=%s", alert.id)
            report.errors.append(f"{alert.id}: {exc}")
            alert.last_checked_at = current_time
            continue

        if outcome is None:
            report.no_data += 1
            alert.last_checked_at = current_time
            continue

        prior = alert.last_matched
        # A send that raised leaves the observation unrecorded, so next week
        # sees the same transition and tries again. Advancing `last_matched`
        # past a failed send would turn a transient SendGrid 503 into an email
        # the user never gets and the system believes it sent — "exactly once"
        # has to mean at least once first.
        defer = False

        if prior is None:
            report.baselines_recorded += 1
            alert.baseline_score = outcome.score
        elif prior != outcome.matches:
            if outcome.matches:
                report.newly_matched += 1
            else:
                report.no_longer_matched += 1

            if _below_threshold(outcome.score, alert.baseline_score):
                report.suppressed_below_threshold += 1
            elif alert.user.alerts_email_opted_out_at is not None:
                # State still advances; the baseline does not, because a
                # baseline is "the score we last told them about".
                report.suppressed_unsubscribed += 1
            else:
                try:
                    await email_provider.send(_build_email(alert.user, alert, outcome))
                    report.emails_sent += 1
                    alert.baseline_score = outcome.score
                    logger.info(
                        "alerts.emailed alert_id=%s to=%s matches=%s score=%s",
                        alert.id,
                        # Redacted at construction, per the root CLAUDE.md rule
                        # — not handed to a formatter to deal with downstream.
                        redact_email(alert.user.email),
                        outcome.matches,
                        outcome.score,
                    )
                except Exception as exc:  # don't let one bad send abort the batch
                    logger.exception("alerts.email_failed alert_id=%s", alert.id)
                    report.errors.append(f"{alert.id} email: {exc}")
                    defer = True
        else:
            report.unchanged += 1

        if not defer:
            alert.last_matched = outcome.matches
            alert.last_score = outcome.score
        alert.last_checked_at = current_time

    if persist:
        await session.commit()
    else:
        await session.rollback()
    logger.info("alerts.run_weekly persisted=%s %s", persist, report.as_dict())
    return report
