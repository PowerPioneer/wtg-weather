"""Paddle webhook signature verification.

Paddle sends a `Paddle-Signature` header of the form
`ts=<unix>;h1=<hex-hmac>`. The HMAC is HMAC_SHA256 over `f"{ts}:{raw_body}"`
with the notification secret. We require `ts` to be within a 5-minute window
to limit replay risk (idempotency is additionally enforced by event_id).
"""

from __future__ import annotations

import hashlib
import hmac
import time


def _parse_header(header: str) -> tuple[str | None, str | None]:
    ts: str | None = None
    h1: str | None = None
    for part in header.split(";"):
        key, _, value = part.strip().partition("=")
        if key == "ts":
            ts = value
        elif key == "h1":
            h1 = value
    return ts, h1


def verify_signature(
    raw_body: bytes,
    signature_header: str | None,
    secret: str,
    tolerance_seconds: int = 5 * 60,
    now: int | None = None,
) -> bool:
    if not signature_header or not secret:
        return False
    ts, h1 = _parse_header(signature_header)
    if not ts or not h1:
        return False
    try:
        ts_int = int(ts)
    except ValueError:
        return False
    if now is None:
        now = int(time.time())
    if abs(now - ts_int) > tolerance_seconds:
        return False
    payload = f"{ts}:".encode("utf-8") + raw_body
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, h1)


def build_signature_header(raw_body: bytes, secret: str, now: int | None = None) -> str:
    """Helper for tests: produce a valid `Paddle-Signature` header."""
    if now is None:
        now = int(time.time())
    payload = f"{now}:".encode("utf-8") + raw_body
    h1 = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"ts={now};h1={h1}"
