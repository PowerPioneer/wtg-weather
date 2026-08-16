"""alert score history

Two nullable integer columns on `alerts`, so the weekly job can say what a place
scored rather than only whether it matched.

Additive and nullable, per the expand-then-deploy rule in `infra/CLAUDE.md`: the
currently-running code neither selects nor writes them, and every existing row
starts NULL — which the job reads as "never scored", the same state a
brand-new alert is in. So a deploy that runs this before `up -d` leaves the old
container perfectly happy, and the first run after the new code lands treats
every pre-existing alert as already-baselined (`last_matched` is set) but with
no score baseline, which suppresses nothing and emails on the next real
transition.

Hand-reviewed: autogenerate would have produced the same two `add_column` calls,
but see the `alerts.last_matched` comment above about why neither gets a
default.

Revision ID: 0008_alert_scores
Revises: 0007_client_notes
Create Date: 2026-08-16 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_alert_scores"
down_revision: Union[str, None] = "0007_client_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No server default on either: 0 is a real score (the "avoid" bucket is 25,
    # but a default of 0 would still be a number the job could not tell from a
    # measurement). NULL is the only value that means "not yet observed", and
    # the job branches on exactly that.
    op.add_column("alerts", sa.Column("last_score", sa.Integer(), nullable=True))
    op.add_column("alerts", sa.Column("baseline_score", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("alerts", "baseline_score")
    op.drop_column("alerts", "last_score")
