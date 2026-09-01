"""Scaleway Transactional Email adapter.

The contract this pins is a *request shape*, because that is the whole of what
the adapter does: Scaleway's schema differs from the other two providers in
four places at once (`to` is a list, the sender is an object, the send is
scoped to a `project_id`, and custom headers are `key`/`value` pairs rather
than Postmark's `Name`/`Value`), and every one of those is silent when wrong —
a mangled payload comes back as a 400 in production, not a red test.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
import pytest

from pydantic import ValidationError

from wtg_api.config import Settings, get_settings
from wtg_api.services.email import (
    ConsoleEmail,
    EmailMessage,
    ScalewayEmail,
    build_provider,
    redact_email,
)

SECRET = "scwsk_test_0123456789"
PROJECT = "11111111-2222-3333-4444-555555555555"
SENDER = "hello@wheretogoforgreatweather.com"


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Intercept the outbound request and hand back what we sent.

    `httpx.MockTransport` rather than a stubbed `send`, so the assertions run
    against a real serialised request — the JSON encoding and the header casing
    are part of what we are pinning.
    """
    sent: dict[str, Any] = {}
    status = {"code": 200}

    def handler(request: httpx.Request) -> httpx.Response:
        sent["url"] = str(request.url)
        sent["headers"] = dict(request.headers)
        sent["json"] = json.loads(request.content)
        return httpx.Response(status["code"], json={"emails": [{"status": "new"}]})

    real_client = httpx.AsyncClient

    def factory(**kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(**kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)
    sent["_status"] = status
    return sent


def _provider() -> ScalewayEmail:
    return ScalewayEmail(SECRET, PROJECT, SENDER)


async def test_send_targets_the_regional_endpoint_with_the_token(
    captured: dict[str, Any],
) -> None:
    await _provider().send(EmailMessage(to="ada@example.com", subject="Hi", text="body"))

    assert captured["url"] == (
        "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails"
    )
    # Scaleway authenticates with its own header, not `Authorization: Bearer`.
    assert captured["headers"]["x-auth-token"] == SECRET
    assert "authorization" not in captured["headers"]


async def test_region_is_configurable(captured: dict[str, Any]) -> None:
    await ScalewayEmail(SECRET, PROJECT, SENDER, region="nl-ams").send(
        EmailMessage(to="ada@example.com", subject="Hi", text="body")
    )
    assert "/regions/nl-ams/emails" in captured["url"]


async def test_payload_shape(captured: dict[str, Any]) -> None:
    await _provider().send(
        EmailMessage(
            to="ada@example.com",
            subject="Your sign-in link",
            text="plain",
            html="<p>rich</p>",
        )
    )

    assert captured["json"] == {
        "from": {"email": SENDER},
        # A list, even for one recipient — this is the field most likely to be
        # copied from the Postmark adapter, where it is a bare string.
        "to": [{"email": "ada@example.com"}],
        "subject": "Your sign-in link",
        "text": "plain",
        "html": "<p>rich</p>",
        "project_id": PROJECT,
    }


async def test_optional_fields_are_omitted_rather_than_null(
    captured: dict[str, Any],
) -> None:
    """A text-only message must not send `html: null`.

    Scaleway rejects a null body field rather than treating it as absent.
    """
    await _provider().send(EmailMessage(to="ada@example.com", subject="Hi", text="body"))

    assert "html" not in captured["json"]
    assert "additional_headers" not in captured["json"]


async def test_list_unsubscribe_headers_survive_as_pairs(
    captured: dict[str, Any],
) -> None:
    """The alert mail's bulk-sender headers are the reason `headers` exists.

    Gmail and Yahoo require one-click unsubscribe on bulk mail; a footer link
    does not satisfy them. If this mapping breaks, the alert run keeps
    succeeding and the reputation damage is invisible until delivery drops.
    """
    await _provider().send(
        EmailMessage(
            to="ada@example.com",
            subject="Your weather alert",
            text="body",
            headers={
                "List-Unsubscribe": "<https://example.com/u/tok>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        )
    )

    assert captured["json"]["additional_headers"] == [
        {"key": "List-Unsubscribe", "value": "<https://example.com/u/tok>"},
        {"key": "List-Unsubscribe-Post", "value": "List-Unsubscribe=One-Click"},
    ]


async def test_rejected_send_raises(captured: dict[str, Any]) -> None:
    """A revoked or wrong-scope key must fail loudly.

    Magic-link delivery is the auth path: swallowing this would lock every user
    out while the endpoint kept returning 200.
    """
    captured["_status"]["code"] = 401

    with pytest.raises(httpx.HTTPStatusError):
        await _provider().send(
            EmailMessage(to="ada@example.com", subject="Hi", text="body")
        )


async def test_recipient_is_never_logged_in_the_clear(
    captured: dict[str, Any], caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="wtg_api.services.email"):
        await _provider().send(
            EmailMessage(to="ada@example.com", subject="Hi", text="body")
        )

    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert "ada@example.com" not in logged
    assert redact_email("ada@example.com") in logged


def _settings(**overrides: Any) -> Any:
    return get_settings().model_copy(update=overrides)


def test_build_provider_selects_scaleway() -> None:
    provider = build_provider(
        _settings(
            email_provider="scaleway",
            scaleway_secret_key=SECRET,
            scaleway_project_id=PROJECT,
        )
    )
    assert isinstance(provider, ScalewayEmail)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"scaleway_secret_key": SECRET, "scaleway_project_id": ""},
         "SCALEWAY_PROJECT_ID"),
        ({"scaleway_secret_key": "", "scaleway_project_id": PROJECT},
         "SCALEWAY_SECRET_KEY"),
    ],
    ids=["no-project", "no-key"],
)
def test_build_provider_refuses_half_a_credential(
    overrides: dict[str, str], expected: str
) -> None:
    """Half a credential must raise, not quietly become console mode.

    `model_copy` skips validation, which is how this state is reachable at all
    — a booted app cannot get here because `Settings` rejects it first.
    """
    with pytest.raises(RuntimeError, match=expected):
        build_provider(_settings(email_provider="scaleway", **overrides))


def test_console_is_only_reachable_by_asking_for_it() -> None:
    assert isinstance(build_provider(_settings(email_provider="console")), ConsoleEmail)


@pytest.mark.parametrize(
    ("provider", "expected"),
    [
        ("scaleway", "SCALEWAY_SECRET_KEY, SCALEWAY_PROJECT_ID"),
        ("sendgrid", "SENDGRID_API_KEY"),
        ("postmark", "POSTMARK_TOKEN"),
    ],
)
def test_settings_refuse_to_validate_without_credentials(
    provider: str, expected: str
) -> None:
    """The real guard: the container must not boot at all.

    `create_app()` calls `get_settings()` at import, so this surfaces as
    uvicorn failing to start — loud, immediate, and before any user can request
    a magic link that would only have been written to the log.
    """
    with pytest.raises(ValidationError, match=expected):
        Settings(email_provider=provider)


def test_console_provider_needs_no_credentials() -> None:
    assert Settings(email_provider="console").missing_email_credentials() == []
