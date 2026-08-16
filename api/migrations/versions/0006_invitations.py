"""invitations

A new table, nothing touched on the existing ones — additive per the
expand-then-deploy rule in `infra/CLAUDE.md`. The currently-running code neither
reads nor writes it, so this is safe to apply before the new image is up, which
is the order the deploy sequence requires.

`invitations.role` reuses the `role` enum type created in `0002_core_schema`
rather than declaring a second one; `create_type=False` is what stops Postgres
trying to `CREATE TYPE role` again. Hand-checked — autogenerate does not notice
enum reuse and would have emitted the duplicate.

Revision ID: 0006_invitations
Revises: 0005_organization_personal_user
Create Date: 2026-08-16 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_invitations"
down_revision: Union[str, None] = "0005_organization_personal_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ROLE_VALUES = ("owner", "admin", "agent", "member")


def _role_enum() -> sa.Enum:
    if op.get_bind().dialect.name == "postgresql":
        return postgresql.ENUM(*ROLE_VALUES, name="role", create_type=False)
    return sa.Enum(*ROLE_VALUES, name="role")


def upgrade() -> None:
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", _role_enum(), nullable=False),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=True),
        # The row's own expiry, checked independently of the signed token's
        # `max_age`, so shortening the TTL in config reaches links already sent.
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        # Single use, and revocation, are database facts: a signature stays
        # valid until it expires, so without these a forwarded link would keep
        # working after the seat was taken or withdrawn.
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_user_id", sa.Uuid(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["accepted_user_id"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_invitations_organization_id", "invitations", ["organization_id"]
    )
    # Not unique: an address can hold one live invitation per org and any
    # number of spent ones, and "one pending" is a predicate the router
    # applies rather than something a plain unique index can express.
    op.create_index("ix_invitations_email", "invitations", ["email"])


def downgrade() -> None:
    op.drop_index("ix_invitations_email", table_name="invitations")
    op.drop_index("ix_invitations_organization_id", table_name="invitations")
    op.drop_table("invitations")
