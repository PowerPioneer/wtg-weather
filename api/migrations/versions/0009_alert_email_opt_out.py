"""alert email opt-out

One nullable timestamp on `users`, set by the one-click unsubscribe in an alert
email. NULL means subscribed, which is what every existing row is — so no
backfill, and no user is opted out by the act of deploying this.

Additive and nullable, per the expand-then-deploy rule in `infra/CLAUDE.md`: the
running old code neither selects nor writes it. Migrate before `up -d`.

Hand-reviewed. Autogenerate would emit the same `add_column`; it would not have
chosen a timestamp over a boolean, and the choice matters — "when did this
person opt out" is the question a deliverability complaint actually asks, and a
boolean cannot answer it.

Revision ID: 0009_alert_email_opt_out
Revises: 0008_alert_scores
Create Date: 2026-08-16 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_alert_email_opt_out"
down_revision: Union[str, None] = "0008_alert_scores"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("alerts_email_opted_out_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "alerts_email_opted_out_at")
