"""personal organization owner on organizations

Entitlements resolve through memberships, so a plan can only ever live on an
organization. Agency plans already have one; a consumer who buys Premium had
nowhere to put it, which is why `subscription.created` for a consumer checkout
was a silent no-op. This column marks the single-seat organization that carries
one user's own subscription so the webhook can find it again rather than
creating a fresh one on every event.

Additive and nullable, per the expand-then-deploy rule in `infra/CLAUDE.md`:
the currently-running code neither reads nor writes it.

Revision ID: 0005_organization_personal_user
Revises: 0004_trip_share_token
Create Date: 2026-08-16 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_organization_personal_user"
down_revision: Union[str, None] = "0004_trip_share_token"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("personal_user_id", sa.Uuid(), nullable=True),
    )
    # Unique so a double-delivered webhook cannot mint a second personal org
    # for the same user and leave `resolve()` picking between them.
    op.create_unique_constraint(
        "uq_organizations_personal_user_id", "organizations", ["personal_user_id"]
    )
    op.create_foreign_key(
        "fk_organizations_personal_user_id_users",
        "organizations",
        "users",
        ["personal_user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_organizations_personal_user_id_users", "organizations", type_="foreignkey"
    )
    op.drop_constraint(
        "uq_organizations_personal_user_id", "organizations", type_="unique"
    )
    op.drop_column("organizations", "personal_user_id")
