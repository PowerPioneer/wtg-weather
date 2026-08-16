"""The weekly runner: the transition matrix, and everything that keeps it quiet.

The matrix `DEVELOPMENT_PLAN.md` asks for is four rows — match→match silent,
no-match→match mails, match→no-match mails, and a brand-new alert baselines
without mailing — plus the property that matters more than any of them: running
the job twice produces one email, not two.

`test_alerts_job.py` runs the same thing end to end against a published bundle.
Here the scorer is a stub so each row can be stated in one line.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timezone

import pytest

from wtg_api.config import get_settings
from wtg_api.models import Alert, User
from wtg_api.services.alert_scoring import AlertOutcome
from wtg_api.services.alert_unsubscribe import read_unsubscribe_token
from wtg_api.services.alerts import (
    MatchScorer,
    StubMatchScorer,
    WeeklyReport,
    run_weekly,
)
from wtg_api.services.email import EmailMessage


class RecordingEmail:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.sent.append(message)


class FailingEmail:
    async def send(self, message: EmailMessage) -> None:  # noqa: ARG002
        raise RuntimeError("boom")


def outcome(score: int, *, matches: bool | None = None) -> AlertOutcome:
    """An `AlertOutcome` at `score`. `matches` defaults to the real threshold."""
    return AlertOutcome(
        score=score,
        matches=(score >= get_settings().alert_match_score) if matches is None else matches,
        month=4,
        month_label="April",
        place="Peru",
        path="/peru/april",
    )


class FixedScorer:
    """Same answer for every alert."""

    def __init__(self, score: int | None, *, matches: bool | None = None) -> None:
        self._outcome = None if score is None else outcome(score, matches=matches)

    def score(self, alert: Alert) -> AlertOutcome | None:  # noqa: ARG002
        return self._outcome


MATCHING = 90
NOT_MATCHING = 25


async def _make_user_with_alert(sessionmaker, **alert_kwargs) -> tuple[User, Alert]:
    user_kwargs = {"alerts_email_opted_out_at": alert_kwargs.pop("opted_out_at", None)}
    async with sessionmaker() as session:
        user = User(email=f"alert-{uuid.uuid4().hex[:6]}@example.com", **user_kwargs)
        session.add(user)
        await session.flush()
        alert = Alert(
            user_id=user.id,
            country_iso2=alert_kwargs.pop("country_iso2", "PE"),
            region_code=alert_kwargs.pop("region_code", None),
            month=alert_kwargs.pop("month", 4),
            preferences=alert_kwargs.pop("preferences", {"tempMin": 15}),
            active=alert_kwargs.pop("active", True),
        )
        for k, v in alert_kwargs.items():
            setattr(alert, k, v)
        session.add(alert)
        await session.commit()
        await session.refresh(alert)
        await session.refresh(user)
        return user, alert


async def _reload(sessionmaker, alert_id: uuid.UUID) -> Alert:
    async with sessionmaker() as session:
        refreshed = await session.get(Alert, alert_id)
        assert refreshed is not None
        return refreshed


# ─── the transition matrix ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_new_alert_sets_a_baseline_without_emailing(sessionmaker) -> None:
    """Row 4. The user was looking at this score when they created the alert;
    mailing it straight back is noise."""
    _, alert = await _make_user_with_alert(sessionmaker)
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert (report.checked, report.baselines_recorded, report.emails_sent) == (1, 1, 0)
    assert inbox.sent == []

    refreshed = await _reload(sessionmaker, alert.id)
    assert refreshed.last_matched is True
    assert (refreshed.last_score, refreshed.baseline_score) == (MATCHING, MATCHING)
    assert refreshed.last_checked_at is not None


@pytest.mark.asyncio
async def test_match_to_match_does_not_email(sessionmaker) -> None:
    """Row 1."""
    _, _alert = await _make_user_with_alert(
        sessionmaker, last_matched=True, last_score=MATCHING, baseline_score=MATCHING
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert (report.unchanged, report.emails_sent) == (1, 0)
    assert inbox.sent == []


@pytest.mark.asyncio
async def test_no_match_to_match_emails(sessionmaker) -> None:
    """Row 2."""
    user, alert = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=NOT_MATCHING, baseline_score=NOT_MATCHING
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert (report.newly_matched, report.emails_sent) == (1, 1)
    message = inbox.sent[0]
    assert message.to == user.email
    assert "now matches" in message.subject.lower()
    assert "Peru" in message.subject and "April" in message.subject

    refreshed = await _reload(sessionmaker, alert.id)
    assert refreshed.last_matched is True
    assert refreshed.baseline_score == MATCHING  # the score we told them about


@pytest.mark.asyncio
async def test_match_to_no_match_emails(sessionmaker) -> None:
    """Row 3."""
    _, alert = await _make_user_with_alert(
        sessionmaker, last_matched=True, last_score=MATCHING, baseline_score=MATCHING
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(NOT_MATCHING))

    assert (report.no_longer_matched, report.emails_sent) == (1, 1)
    assert "no longer matches" in inbox.sent[0].subject.lower()
    assert (await _reload(sessionmaker, alert.id)).last_matched is False


@pytest.mark.asyncio
async def test_inactive_alerts_are_skipped(sessionmaker) -> None:
    """A paused alert is not a deleted one, and must not mail while paused."""
    await _make_user_with_alert(sessionmaker, active=False, last_matched=False)
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert report.checked == 0
    assert inbox.sent == []


# ─── idempotency ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_running_twice_sends_one_email(sessionmaker) -> None:
    """The property a cron misfire depends on."""
    _, _alert = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=NOT_MATCHING, baseline_score=NOT_MATCHING
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        first = await run_weekly(session, inbox, FixedScorer(MATCHING))
    async with sessionmaker() as session:
        second = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert first.emails_sent == 1
    assert (second.unchanged, second.emails_sent) == (1, 0)
    assert len(inbox.sent) == 1


@pytest.mark.asyncio
async def test_a_full_cycle_emails_once_each_way(sessionmaker) -> None:
    _, _alert = await _make_user_with_alert(sessionmaker)
    inbox = RecordingEmail()

    for scorer in (
        FixedScorer(NOT_MATCHING),  # baseline, silent
        FixedScorer(NOT_MATCHING),  # unchanged
        FixedScorer(MATCHING),  # → email 1
        FixedScorer(MATCHING),  # unchanged
        FixedScorer(NOT_MATCHING),  # → email 2
        FixedScorer(NOT_MATCHING),  # unchanged
    ):
        async with sessionmaker() as session:
            await run_weekly(session, inbox, scorer)

    assert [m.subject for m in inbox.sent] == [
        "Peru in April now matches your preferences",
        "Peru in April no longer matches your preferences",
    ]


# ─── the delta guard (HANDOFF open decision #3) ──────────────────────────


@pytest.mark.asyncio
async def test_a_transition_smaller_than_the_threshold_is_suppressed(
    sessionmaker, monkeypatch
) -> None:
    """Not reachable with today's quantised scores — see the setting's comment —
    so the threshold is raised here to exercise the branch that will matter the
    moment scoring becomes continuous."""
    monkeypatch.setattr(get_settings(), "alert_score_delta_points", 40)
    _, alert = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=60, baseline_score=60
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(75))

    assert (report.newly_matched, report.emails_sent) == (1, 0)
    assert report.suppressed_below_threshold == 1
    assert inbox.sent == []
    refreshed = await _reload(sessionmaker, alert.id)
    # State advanced; the baseline did not, so a later, larger move still fires.
    assert refreshed.last_matched is True
    assert refreshed.baseline_score == 60


@pytest.mark.asyncio
async def test_drift_is_measured_against_the_baseline_not_last_week(
    sessionmaker, monkeypatch
) -> None:
    """A place that climbs 25 → 60 → 75 → 90 and only then crosses the match
    line has moved 65 points since the last thing we told the user. Measured
    against *last week* it moved 15, and a 40-point threshold would have
    swallowed the email."""
    monkeypatch.setattr(get_settings(), "alert_score_delta_points", 40)
    _, alert = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=25, baseline_score=25
    )
    inbox = RecordingEmail()

    # Two quiet weeks: the score climbs but stays under the match line, so
    # there is no transition and nothing to suppress or send.
    for score in (60, 75):
        async with sessionmaker() as session:
            await run_weekly(session, inbox, FixedScorer(score, matches=False))
    assert inbox.sent == []
    assert (await _reload(sessionmaker, alert.id)).baseline_score == 25

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(90, matches=True))

    assert (report.emails_sent, report.suppressed_below_threshold) == (1, 0)
    assert len(inbox.sent) == 1


@pytest.mark.asyncio
async def test_an_alert_with_no_baseline_is_never_suppressed(
    sessionmaker, monkeypatch
) -> None:
    """Rows that predate migration 0008 have `last_matched` set and no score.
    Reading "unknown" as "no movement" would mute their first real transition."""
    monkeypatch.setattr(get_settings(), "alert_score_delta_points", 1000)
    _, _alert = await _make_user_with_alert(sessionmaker, last_matched=False)
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert (report.emails_sent, report.suppressed_below_threshold) == (1, 0)


# ─── unsubscribed users ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_unsubscribed_user_is_not_emailed(sessionmaker) -> None:
    user, alert = await _make_user_with_alert(
        sessionmaker,
        last_matched=False,
        last_score=NOT_MATCHING,
        baseline_score=NOT_MATCHING,
        opted_out_at=datetime.now(timezone.utc),
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert (report.newly_matched, report.emails_sent) == (1, 0)
    assert report.suppressed_unsubscribed == 1
    assert inbox.sent == []
    refreshed = await _reload(sessionmaker, alert.id)
    # Evaluation continues, so turning email back on does not release a
    # backlog of transitions that happened while they were opted out.
    assert refreshed.last_matched is True
    assert refreshed.baseline_score == NOT_MATCHING
    assert user.email  # the alert itself is untouched and still theirs


# ─── the email itself ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_every_email_carries_a_working_one_click_unsubscribe(
    sessionmaker,
) -> None:
    user, alert = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=NOT_MATCHING, baseline_score=NOT_MATCHING
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        await run_weekly(session, inbox, FixedScorer(MATCHING))

    message = inbox.sent[0]
    assert message.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    url = message.headers["List-Unsubscribe"].strip("<>")
    token = url.split("token=", 1)[1]
    parsed = read_unsubscribe_token(token)
    assert parsed.user_id == user.id
    assert parsed.alert_id == alert.id
    assert url in message.html and url in message.text


@pytest.mark.asyncio
async def test_the_email_reports_the_previous_run_s_score(sessionmaker) -> None:
    await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=25, baseline_score=25
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert "Previous run: 25/100" in inbox.sent[0].text
    assert "90" in inbox.sent[0].text


@pytest.mark.asyncio
async def test_no_recipient_address_reaches_the_log(sessionmaker, caplog) -> None:
    """Hard rule: redaction at log-line construction, not in a formatter."""
    user, _ = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=NOT_MATCHING, baseline_score=NOT_MATCHING
    )
    inbox = RecordingEmail()

    with caplog.at_level("DEBUG"):
        async with sessionmaker() as session:
            await run_weekly(session, inbox, FixedScorer(MATCHING))

    assert inbox.sent, "the test is meaningless if nothing was sent"
    assert user.email not in caplog.text
    assert user.email.split("@")[0] not in caplog.text
    # The line that names a recipient is there — redacted.
    assert "alerts.emailed" in caplog.text


# ─── failure handling ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_failed_send_is_retried_next_run(sessionmaker) -> None:
    """A transient provider error must not consume the transition. "Exactly
    once" has to mean at least once first."""
    _, alert = await _make_user_with_alert(
        sessionmaker, last_matched=False, last_score=NOT_MATCHING, baseline_score=NOT_MATCHING
    )

    async with sessionmaker() as session:
        report = await run_weekly(session, FailingEmail(), FixedScorer(MATCHING))
    assert (report.emails_sent, len(report.errors)) == (0, 1)

    refreshed = await _reload(sessionmaker, alert.id)
    assert refreshed.last_matched is False  # not advanced past the failure
    assert refreshed.last_checked_at is not None  # but the run is on record

    inbox = RecordingEmail()
    async with sessionmaker() as session:
        retry = await run_weekly(session, inbox, FixedScorer(MATCHING))
    assert retry.emails_sent == 1


@pytest.mark.asyncio
async def test_one_bad_send_does_not_abort_the_batch(sessionmaker) -> None:
    await _make_user_with_alert(sessionmaker, last_matched=False)
    await _make_user_with_alert(sessionmaker, last_matched=False)

    async with sessionmaker() as session:
        report = await run_weekly(session, FailingEmail(), FixedScorer(MATCHING))

    assert report.checked == 2
    assert report.newly_matched == 2
    assert len(report.errors) == 2


@pytest.mark.asyncio
async def test_scorer_failure_is_isolated_to_one_alert(sessionmaker) -> None:
    _, good = await _make_user_with_alert(sessionmaker, last_matched=False)
    _, bad = await _make_user_with_alert(sessionmaker, last_matched=False)

    class PartiallyBroken:
        def score(self, alert: Alert) -> AlertOutcome | None:
            if alert.id == bad.id:
                raise ValueError("no data")
            return outcome(MATCHING)

    inbox = RecordingEmail()
    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, PartiallyBroken())

    assert report.checked == 2
    assert len(report.errors) == 1
    assert report.emails_sent == 1

    assert (await _reload(sessionmaker, good.id)).last_matched is True
    bad_refreshed = await _reload(sessionmaker, bad.id)
    assert bad_refreshed.last_matched is False
    assert bad_refreshed.last_checked_at is not None


@pytest.mark.asyncio
async def test_no_data_leaves_the_alert_completely_alone(sessionmaker) -> None:
    """A country that dropped out of the published index must not read as
    "stopped matching" — that would mail every affected user about a missing
    file."""
    _, alert = await _make_user_with_alert(
        sessionmaker, last_matched=True, last_score=MATCHING, baseline_score=MATCHING
    )
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(None))

    assert (report.no_data, report.emails_sent) == (1, 0)
    refreshed = await _reload(sessionmaker, alert.id)
    assert refreshed.last_matched is True
    assert refreshed.last_score == MATCHING


@pytest.mark.asyncio
async def test_stub_scorer_never_emails_anyone(sessionmaker) -> None:
    _, alert = await _make_user_with_alert(sessionmaker, last_matched=True)
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, StubMatchScorer())

    assert isinstance(report, WeeklyReport)
    assert (report.emails_sent, report.no_data) == (0, 1)
    assert (await _reload(sessionmaker, alert.id)).last_matched is True


# ─── dry run and bookkeeping ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dry_run_writes_nothing(sessionmaker) -> None:
    """A dry run that advanced baselines would suppress the following week's
    real email, which is worse than not having a dry run."""
    _, alert = await _make_user_with_alert(sessionmaker)
    inbox = RecordingEmail()

    async with sessionmaker() as session:
        report = await run_weekly(session, inbox, FixedScorer(MATCHING), persist=False)

    assert report.baselines_recorded == 1
    refreshed = await _reload(sessionmaker, alert.id)
    assert refreshed.last_matched is None
    assert refreshed.last_score is None


@pytest.mark.asyncio
async def test_now_override_is_respected(sessionmaker) -> None:
    _, alert = await _make_user_with_alert(sessionmaker)
    fixed = datetime(2026, 6, 15, tzinfo=UTC)

    async with sessionmaker() as session:
        await run_weekly(session, RecordingEmail(), FixedScorer(MATCHING), now=fixed)

    refreshed = await _reload(sessionmaker, alert.id)
    assert refreshed.last_checked_at is not None
    # sqlite drops tz; compare naively.
    assert refreshed.last_checked_at.replace(tzinfo=None) == fixed.replace(tzinfo=None)


def test_match_scorer_protocol_is_duck_typed() -> None:
    scorer: MatchScorer = FixedScorer(MATCHING)
    assert scorer.score(Alert(user_id=uuid.uuid4())).score == MATCHING
