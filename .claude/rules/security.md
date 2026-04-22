# Security

- Secrets live in `.env`; never commit. Use `.env.example` as the reference.
- Never read `.env`. The `Read` permission for it is denied in `.claude/settings.json`.
- Auth / payments / tile-signing changes require a security-impact note in the commit body.
- PII redaction at log-line construction — never log raw email or IP.
- Tile URLs are HMAC-signed with a 15-minute lifetime; the secret lives in `TILE_SIGNING_SECRET`.
- Postgres / Redis / GlitchTip / Plausible ports are never exposed to the host network.
