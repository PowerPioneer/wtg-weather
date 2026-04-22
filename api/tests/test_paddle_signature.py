from __future__ import annotations

import time

from wtg_api.services.paddle import build_signature_header, verify_signature


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
