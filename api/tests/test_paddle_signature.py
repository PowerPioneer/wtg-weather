from __future__ import annotations

import time

from wtg_api.services.paddle import signature_failure_reason, build_signature_header, verify_signature


def test_valid_signature() -> None:
    body = b'{"event_id":"evt_1"}'
    header = build_signature_header(body, "secret")
    assert verify_signature(body, header, "secret") is True


def test_bad_hmac_rejected() -> None:
    body = b'{"event_id":"evt_1"}'
    header = build_signature_header(body, "secret")
    # Flip last char of the h1 portion
    ts_part, h1_part = header.split(";")
    h1_value = h1_part.split("=", 1)[1]
    tampered_h1 = h1_value[:-1] + ("0" if h1_value[-1] != "0" else "1")
    tampered = f"{ts_part};h1={tampered_h1}"
    assert verify_signature(body, tampered, "secret") is False


def test_body_tampering_rejected() -> None:
    body = b'{"event_id":"evt_1"}'
    header = build_signature_header(body, "secret")
    assert verify_signature(body + b"tamper", header, "secret") is False


def test_old_timestamp_rejected() -> None:
    body = b'{"x":1}'
    past = int(time.time()) - 10 * 60
    header = build_signature_header(body, "secret", now=past)
    assert verify_signature(body, header, "secret", tolerance_seconds=5 * 60) is False


def test_missing_header_rejected() -> None:
    assert verify_signature(b"x", None, "secret") is False
    assert verify_signature(b"x", "", "secret") is False
    assert verify_signature(b"x", "garbage", "secret") is False
    assert verify_signature(b"x", "ts=abc;h1=def", "secret") is False


def test_failure_reason_tells_the_four_causes_apart() -> None:
    """A rejected webhook is an unactivated paid subscription.

    "bad signature" covers a wrong secret, a drifted clock, a replay and a
    malformed header — four different fixes. These tags are what make the log
    actionable; the 403 returned to the caller stays bare either way.
    """
    body = b'{"event_id":"evt_1"}'
    secret = "pdl_ntfset_realsecret"
    good = build_signature_header(body, secret)

    assert signature_failure_reason(body, good, "") == "no_secret_configured"
    assert signature_failure_reason(body, None, secret) == "no_signature_header"
    assert signature_failure_reason(body, "nonsense", secret) == "malformed_header"
    assert (
        signature_failure_reason(body, "ts=abc;h1=ff", secret)
        == "malformed_timestamp"
    )

    stale = build_signature_header(body, secret, now=1_000_000)
    assert signature_failure_reason(body, stale, secret, now=1_000_000 + 600).startswith(
        "stale_timestamp"
    )

    # The real incident: the notification destination's id pasted in place of
    # its signing secret. Every signature fails, the clock is fine, and the
    # tag has to say so or the cause is invisible.
    assert (
        signature_failure_reason(body, good, "ntfset_01m1abcdefghijklmnopqrstuv")
        == "hmac_mismatch secret_looks_like_a_destination_id=true"
    )
    assert signature_failure_reason(body, good, "pdl_ntfset_wrong") == "hmac_mismatch"
