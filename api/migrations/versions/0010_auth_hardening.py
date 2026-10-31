"""auth hardening: single-use magic links, session revocation

Two additive changes, both for authentication:

- `magic_link_tokens` — one row per issued sign-in link, keyed by the token's
  `jti`. Verifying a link spends its row, so a link works once; the issuing
  endpoint counts recent rows per address and per client to rate-limit
  sign-in mail. Address and IP are stored only as keyed HMACs.
- `users.session_version` — copied into every session cookie and checked on
  every request, so "sign out everywhere" can revoke cookies that are
  otherwise stateless. `NOT NULL` with a server default of 0, which is also
  what a cookie minted before this migration is read as, so nobody is signed
  out by the act of deploying it.

Additive, per the expand-then-deploy rule in `infra/CLAUDE.md`: the running old
code neither selects the new table nor names the new column in a way that
breaks (the column has a server default). Migrate before `up -d`.

One behavioural edge at deploy time: links mailed by the old code carry no
`jti` and are refused by the new verify. They expire within fifteen minutes
anyway; anyone caught by it requests another.

Hand-reviewed.

Revision ID: 0010_auth_hardening
Revises: 0009_alert_email_opt_out
Create Date: 2026-10-31 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_auth_hardening"
down_revision: Union[str, None] = "0009_alert_email_opt_out"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "magic_link_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email_hash", sa.String(length=64), nullable=False),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_magic_link_tokens_email_hash", "magic_link_tokens", ["email_hash"]
    )
    op.create_index("ix_magic_link_tokens_ip_hash", "magic_link_tokens", ["ip_hash"])
    op.create_index(
        "ix_magic_link_tokens_created_at", "magic_link_tokens", ["created_at"]
    )

    op.add_column(
        "users",
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "session_version")
    op.drop_index("ix_magic_link_tokens_created_at", table_name="magic_link_tokens")
    op.drop_index("ix_magic_link_tokens_ip_hash", table_name="magic_link_tokens")
    op.drop_index("ix_magic_link_tokens_email_hash", table_name="magic_link_tokens")
    op.drop_table("magic_link_tokens")
