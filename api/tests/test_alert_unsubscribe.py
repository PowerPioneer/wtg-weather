"""Failure paths for the session-less unsubscribe.

Auth-adjacent, so the negative cases come first and there are more of them than
positive ones: a forged token, an expired one, one replayed after use, and one
whose alert was deleted between the send and the click.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from wtg_api.config import get_settings
from wtg_api.models import Alert, User
from wtg_api.services.alert_unsubscribe import (
    apply_unsubscribe,
    issue_unsubscribe_token,
    read_unsubscribe_token,
    unsubscribe_url,
)

URL = "/api/alerts/unsubscribe"


async def _user_with_alert(sessionmaker) -> tuple[User, Alert]:
    async with sessionmaker() as session:
        user = User(email=f"unsub-{uuid.uuid4().hex[:6]}@example.com")
        session.add(user)
        await session.flush()
        alert = Alert(user_id=user.id, country_iso2="PE", month=4, preferences={})
        session.add(alert)
        await session.commit()
        await session.refresh(user)
        await session.refresh(alert)
        return user, alert


async def _opted_out_at(sessionmaker, user_id: uuid.UUID) -> datetime | None:
    async with sessionmaker() as session:
        refreshed = await session.get(User, user_id)
        assert refreshed is not None
        return refreshed.alerts_email_opted_out_at


# ─── the token ───────────────────────────────────────────────────────────


def test_token_round_trips_user_and_alert() -> None:
    uid, aid = uuid.uuid4(), uuid.uuid4()
    parsed = read_unsubscribe_token(issue_unsubscribe_token(uid, aid))
    assert (parsed.user_id, parsed.alert_id, parsed.expired) == (uid, aid, False)


def test_forged_token_is_refused() -> None:
    good = issue_unsubscribe_token(uuid.uuid4())
    assert read_unsubscribe_token(good + "x").user_id is None
    assert read_unsubscribe_token("not-a-token").user_id is None
    assert read_unsubscribe_token("").user_id is None


def test_a_session_cookie_is_not_an_unsubscribe_token() -> None:
    """Different salt, same secret — the whole point of the dedicated salt."""
    from fastapi import Response

    from wtg_api.services.sessions import issue_session

    response = Response()
    issue_session(response, uuid.uuid4())
    cookie = response.headers["set-cookie"].split(";", 1)[0].split("=", 1)[1]
    assert read_unsubscribe_token(cookie).user_id is None


def test_an_invite_token_is_not_an_unsubscribe_token() -> None:
    from wtg_api.services.invites import issue_invite_token

    assert read_unsubscribe_token(issue_invite_token(uuid.uuid4())).user_id is None


def test_expired_token_is_told_apart_from_a_forged_one(monkeypatch) -> None:
    token = issue_unsubscribe_token(uuid.uuid4())
    monkeypatch.setattr(get_settings(), "alert_unsubscribe_ttl_seconds", -1)
    parsed = read_unsubscribe_token(token)
    assert parsed.user_id is None
    assert parsed.expired is True


def test_token_carries_no_email_address() -> None:
    """A token that verifies still cannot leak whose mailbox it was for."""
    token = issue_unsubscribe_token(uuid.uuid4())
    assert "@" not in token


def test_unsubscribe_url_points_at_the_public_api_origin(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "public_api_origin", "https://example.test/")
    url = unsubscribe_url("abc.def")
    assert url == "https://example.test/api/alerts/unsubscribe?token=abc.def"


# ─── the endpoint ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_confirms_without_changing_anything(
    client: AsyncClient, sessionmaker
) -> None:
    """A link scanner fetching every URL in the message must not opt anyone out."""
    user, alert = await _user_with_alert(sessionmaker)
    token = issue_unsubscribe_token(user.id, alert.id)

    res = await client.get(URL, params={"token": token})
    assert res.status_code == 200
    assert "unsubscribe" in res.text.lower()
    assert res.headers["content-type"].startswith("text/html")
    assert await _opted_out_at(sessionmaker, user.id) is None


@pytest.mark.asyncio
async def test_post_sets_the_opt_out(client: AsyncClient, sessionmaker) -> None:
    user, alert = await _user_with_alert(sessionmaker)
    token = issue_unsubscribe_token(user.id, alert.id)

    res = await client.post(URL, params={"token": token})
    assert res.status_code == 200
    assert "unsubscribed" in res.text.lower()
    assert await _opted_out_at(sessionmaker, user.id) is not None


@pytest.mark.asyncio
async def test_post_accepts_the_form_body_from_the_confirmation_page(
    client: AsyncClient, sessionmaker
) -> None:
    user, _ = await _user_with_alert(sessionmaker)
    token = issue_unsubscribe_token(user.id)

    res = await client.post(
        URL,
        content=f"token={token}",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 200
    assert await _opted_out_at(sessionmaker, user.id) is not None


@pytest.mark.asyncio
async def test_replay_is_a_no_op_and_keeps_the_first_timestamp(
    client: AsyncClient, sessionmaker
) -> None:
    """The signature stays valid until it expires, so a second press — by the
    user or by a mail client retrying — has to land on the same state."""
    user, _ = await _user_with_alert(sessionmaker)
    token = issue_unsubscribe_token(user.id)

    assert (await client.post(URL, params={"token": token})).status_code == 200
    first = await _opted_out_at(sessionmaker, user.id)
    assert first is not None

    assert (await client.post(URL, params={"token": token})).status_code == 200
    assert await _opted_out_at(sessionmaker, user.id) == first


@pytest.mark.asyncio
async def test_still_works_after_the_alert_was_deleted(
    client: AsyncClient, sessionmaker
) -> None:
    """The alert id is context, not authorisation. A link that breaks because
    the user tidied their account produces a spam complaint instead."""
    user, alert = await _user_with_alert(sessionmaker)
    token = issue_unsubscribe_token(user.id, alert.id)

    async with sessionmaker() as session:
        await session.delete(await session.get(Alert, alert.id))
        await session.commit()

    assert (await client.post(URL, params={"token": token})).status_code == 200
    assert await _opted_out_at(sessionmaker, user.id) is not None


@pytest.mark.asyncio
async def test_forged_token_refused_by_the_endpoint(client: AsyncClient) -> None:
    res = await client.post(URL, params={"token": "forged"})
    assert res.status_code == 400
    assert (await client.get(URL, params={"token": "forged"})).status_code == 400


@pytest.mark.asyncio
async def test_expired_token_refused_with_its_own_answer(
    client: AsyncClient, sessionmaker, monkeypatch
) -> None:
    user, _ = await _user_with_alert(sessionmaker)
    token = issue_unsubscribe_token(user.id)
    monkeypatch.setattr(get_settings(), "alert_unsubscribe_ttl_seconds", -1)

    res = await client.post(URL, params={"token": token})
    assert res.status_code == 410
    assert "expired" in res.text.lower()
    assert await _opted_out_at(sessionmaker, user.id) is None


@pytest.mark.asyncio
async def test_missing_token_is_refused(client: AsyncClient) -> None:
    assert (await client.post(URL)).status_code == 400
    # GET declares it required, so FastAPI answers before the handler.
    assert (await client.get(URL)).status_code == 422


@pytest.mark.asyncio
async def test_unknown_user_still_answers_success(client: AsyncClient) -> None:
    """Not an oracle for which accounts exist — see the handler's docstring."""
    res = await client.post(URL, params={"token": issue_unsubscribe_token(uuid.uuid4())})
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_the_page_carries_no_script_and_asks_not_to_be_indexed(
    client: AsyncClient, sessionmaker
) -> None:
    user, _ = await _user_with_alert(sessionmaker)
    res = await client.get(URL, params={"token": issue_unsubscribe_token(user.id)})
    assert "<script" not in res.text.lower()
    assert 'name="robots" content="noindex"' in res.text


@pytest.mark.asyncio
async def test_no_recipient_address_reaches_the_log(
    client: AsyncClient, sessionmaker, caplog
) -> None:
    user, _ = await _user_with_alert(sessionmaker)
    with caplog.at_level("DEBUG"):
        await client.post(URL, params={"token": issue_unsubscribe_token(user.id)})
    assert user.email not in caplog.text
    local = user.email.split("@")[0]
    assert local not in caplog.text


@pytest.mark.asyncio
async def test_apply_unsubscribe_reports_a_missing_user(sessionmaker) -> None:
    async with sessionmaker() as session:
        assert await apply_unsubscribe(session, uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_a_year_old_token_is_still_inside_the_window(sessionmaker) -> None:
    """The window exists so an archived email still works; check the default
    actually spans one."""
    ttl = get_settings().alert_unsubscribe_ttl_seconds
    assert timedelta(seconds=ttl) >= timedelta(days=365)
    # And that it is bounded at all — an unlimited bearer token is not the
    # trade being made here.
    assert timedelta(seconds=ttl) <= timedelta(days=400)
    assert datetime.now(timezone.utc)  # sanity: the module's clock is real
