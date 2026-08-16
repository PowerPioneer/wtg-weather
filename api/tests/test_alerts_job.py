"""The weekly job end to end, in the test harness.

`DEVELOPMENT_PLAN.md` WS-D asks for this against a dev stack. There is no docker
stack here, so the two halves the stack would have provided are replaced by the
things they actually are: the published bundle is a directory (`published_bundle`
builds one, and can republish it mid-test the way the yearly rebuild does), and
the email provider is a recorder, because `.claude/rules/testing.md` forbids a
live one anywhere.

What that leaves untested is the container plumbing — that
`python -m wtg_api.jobs.alerts_weekly` finds a database inside the compose
network. `infra/scripts/weekly-alerts.sh` is where that lives, and it is
verified by reading, not by running.

The acceptance criterion — *a seeded alert fires exactly once on a transition in
a staged run* — is `test_a_seeded_alert_fires_exactly_once_on_a_transition`.
"""

from __future__ import annotations

import uuid

import pytest

from wtg_api.models import Alert, User
from wtg_api.services import country_data
from wtg_api.services.alert_scoring import BundleMatchScorer
from wtg_api.services.alerts import run_weekly
from wtg_api.services.email import EmailMessage


class RecordingEmail:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.sent.append(message)


async def _seed(sessionmaker, **kwargs) -> tuple[User, Alert]:
    async with sessionmaker() as session:
        user = User(email=f"job-{uuid.uuid4().hex[:6]}@example.com")
        session.add(user)
        await session.flush()
        alert = Alert(
            user_id=user.id,
            country_iso2=kwargs.pop("country_iso2", "PE"),
            region_code=kwargs.pop("region_code", None),
            month=kwargs.pop("month", 4),
            preferences=kwargs.pop("preferences", {}),
            **kwargs,
        )
        session.add(alert)
        await session.commit()
        await session.refresh(user)
        await session.refresh(alert)
        return user, alert


async def _run(sessionmaker, inbox):
    """One invocation of the job's core, with a fresh scorer each time.

    Fresh because the real job is a process that starts, reads the bundle once
    and exits — a scorer reused across simulated weeks would cache an index the
    yearly rebuild has since replaced.
    """
    async with sessionmaker() as session:
        return await run_weekly(session, inbox, BundleMatchScorer())


# ─── the acceptance criterion ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_seeded_alert_fires_exactly_once_on_a_transition(
    sessionmaker, published_bundle
) -> None:
    # Week 0: April in Peru is cold and wet. Baseline, no email.
    published_bundle.publish(temp=5.0, rain_day=9.0, sun=2.0)
    user, alert = await _seed(sessionmaker)
    inbox = RecordingEmail()

    baseline = await _run(sessionmaker, inbox)
    assert (baseline.baselines_recorded, baseline.emails_sent) == (1, 0)

    # Week 1: nothing republished. Silent.
    assert (await _run(sessionmaker, inbox)).emails_sent == 0

    # Week 2: a rebuild lands and April now scores well. One email.
    published_bundle.publish(temp=22.0, rain_day=1.0, sun=7.0)
    transition = await _run(sessionmaker, inbox)
    assert (transition.newly_matched, transition.emails_sent) == (1, 1)

    # Weeks 3 and 4: the same data, and a cron misfire re-running the same week.
    assert (await _run(sessionmaker, inbox)).emails_sent == 0
    assert (await _run(sessionmaker, inbox)).emails_sent == 0

    assert len(inbox.sent) == 1, "exactly once"
    message = inbox.sent[0]
    assert message.to == user.email
    assert message.subject == "Peru in April now matches your preferences"
    assert "/peru/april" in message.html
    assert "List-Unsubscribe" in message.headers
    assert str(alert.id)  # the alert is still there, unmodified in shape


@pytest.mark.asyncio
async def test_the_other_direction_also_fires_once(
    sessionmaker, published_bundle
) -> None:
    published_bundle.publish(temp=22.0, rain_day=1.0, sun=7.0)
    await _seed(sessionmaker)
    inbox = RecordingEmail()

    await _run(sessionmaker, inbox)  # baseline: matching
    published_bundle.publish(temp=5.0, rain_day=9.0, sun=2.0)
    report = await _run(sessionmaker, inbox)
    assert (report.no_longer_matched, report.emails_sent) == (1, 1)
    assert await _run(sessionmaker, inbox) and len(inbox.sent) == 1
    assert inbox.sent[0].subject == "Peru in April no longer matches your preferences"


# ─── the shapes the bundle can be in ─────────────────────────────────────


@pytest.mark.asyncio
async def test_a_region_alert_follows_its_own_region(
    sessionmaker, published_bundle
) -> None:
    published_bundle.publish(
        temp=5.0,  # the country stays cold throughout
        rain_day=9.0,
        sun=2.0,
        regions=[published_bundle.region(code="PER-1234", temp=5.0, rain_day=9.0, sun=2.0)],
    )
    await _seed(sessionmaker, region_code="PER-1234")
    inbox = RecordingEmail()
    await _run(sessionmaker, inbox)

    published_bundle.publish(
        temp=5.0,
        rain_day=9.0,
        sun=2.0,
        regions=[published_bundle.region(code="PER-1234", temp=22.0, rain_day=1.0, sun=7.0)],
    )
    report = await _run(sessionmaker, inbox)

    assert report.emails_sent == 1
    assert inbox.sent[0].subject.startswith("Cusco, Peru in April")


@pytest.mark.asyncio
async def test_a_country_dropping_out_of_the_index_sends_nothing(
    sessionmaker, published_bundle
) -> None:
    """The failure mode this design exists to avoid: a publish that loses a
    country must not mail everyone watching it that it stopped matching."""
    published_bundle.publish(temp=22.0, rain_day=1.0, sun=7.0)
    await _seed(sessionmaker)
    inbox = RecordingEmail()
    await _run(sessionmaker, inbox)

    # Republish the bundle without Peru in it.
    published_bundle.publish(slug="chile", name="Chile", iso2="CL")
    (published_bundle.root / "countries" / "peru.json").unlink()
    (published_bundle.root / "index.json").write_text(
        '{"countries": [{"slug": "chile", "name": "Chile", "iso2": "CL", '
        '"region": "South America"}]}',
        encoding="utf-8",
    )
    country_data.reset_cache()

    report = await _run(sessionmaker, inbox)
    assert (report.no_data, report.emails_sent) == (1, 0)
    assert inbox.sent == []


@pytest.mark.asyncio
async def test_an_absent_bundle_is_fatal_rather_than_a_quiet_week(
    sessionmaker, tmp_path, monkeypatch
) -> None:
    """A missing mount must not look like "nothing changed" for every alert."""
    from wtg_api.config import get_settings

    await _seed(sessionmaker)
    monkeypatch.setattr(get_settings(), "country_data_dir", str(tmp_path / "absent"))
    country_data.reset_cache()

    with pytest.raises(country_data.CountryDataUnavailable):
        await _run(sessionmaker, RecordingEmail())
    country_data.reset_cache()


@pytest.mark.asyncio
async def test_two_users_watching_the_same_place_each_get_one(
    sessionmaker, published_bundle
) -> None:
    published_bundle.publish(temp=5.0, rain_day=9.0, sun=2.0)
    first, _ = await _seed(sessionmaker)
    second, _ = await _seed(sessionmaker)
    inbox = RecordingEmail()
    await _run(sessionmaker, inbox)

    published_bundle.publish(temp=22.0, rain_day=1.0, sun=7.0)
    report = await _run(sessionmaker, inbox)

    assert (report.checked, report.emails_sent) == (2, 2)
    assert {m.to for m in inbox.sent} == {first.email, second.email}
    # Each gets their own unsubscribe token; one must not silence the other.
    tokens = {m.headers["List-Unsubscribe"] for m in inbox.sent}
    assert len(tokens) == 2


@pytest.mark.asyncio
async def test_a_users_own_preferences_decide_their_email(
    sessionmaker, published_bundle
) -> None:
    """Two alerts, same place and month, different preferences: only the one
    whose question the data now answers gets mail."""
    published_bundle.publish(temp=5.0, rain_day=1.0, sun=7.0)
    default_user, _ = await _seed(sessionmaker)
    cold_user, _ = await _seed(sessionmaker, preferences={"tempMin": 0, "tempMax": 10})
    inbox = RecordingEmail()

    baseline = await _run(sessionmaker, inbox)
    assert baseline.baselines_recorded == 2

    # 22 °C: inside the default band, outside the cold traveller's.
    published_bundle.publish(temp=22.0, rain_day=1.0, sun=7.0)
    report = await _run(sessionmaker, inbox)

    assert report.emails_sent == 2
    by_recipient = {m.to: m.subject for m in inbox.sent}
    assert "now matches" in by_recipient[default_user.email]
    assert "no longer matches" in by_recipient[cold_user.email]
