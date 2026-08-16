"""The token-facing half of agency invitations: preview and accept.

**Security implication — this is an authentication path.** Accepting an
invitation issues a session for the address the invitation was mailed to,
exactly as clicking a magic link does, and for the same reason: possession of
the token proves control of that mailbox. Consequences that follow, and that
the code below is arranged around:

- The session issued is for the **invitation's** email, never for whoever
  happens to be signed in. A forwarded link therefore cannot attach the seat to
  the wrong person; it signs the opener in as the invitee or not at all.
- Single use. `accepted_at` is set in the same transaction as the membership,
  so a replayed token meets 409 rather than a second seat.
- Revoked and unknown invitations answer alike (404). A revoked link must look
  like it never existed.
- The seat cap is re-checked here, not just at invite time: a plan can be
  downgraded between sending and accepting, and the cap that matters is the one
  in force when the seat is actually taken.
- Nothing in a response echoes the token, and no log line carries the
  invitee's address unredacted.

Separate module from `routers/orgs.py` because everything there is behind
`current_user` and everything here is deliberately not.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import db_session
from wtg_api.models import Invitation, Membership, Organization, User
from wtg_api.schemas import (
    InvitationAcceptRequest,
    InvitationAccepted,
    InvitationPreview,
)
from wtg_api.services.email import redact_email
from wtg_api.services.invites import read_invite_token, seat_usage
from wtg_api.services.sessions import issue_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/invites", tags=["invites"])

EXPIRED_DETAIL = "invitation expired"
SPENT_DETAIL = "invitation already accepted"
SEAT_CAP_DETAIL = "seat cap reached"


def _as_utc(value: datetime) -> datetime:
    """Timestamps come back naive from SQLite and aware from Postgres.

    Comparing the two raises, so normalise before every expiry check rather
    than at one call site and not the next.
    """
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _resolve(session: AsyncSession, token: str) -> Invitation:
    """Token → live invitation, or the right refusal.

    Ordering matters: a bad signature and an unknown id both answer 404 before
    anything is read, so this endpoint cannot be used to probe which
    invitation ids exist.
    """
    parsed = read_invite_token(token)
    if parsed.expired:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, EXPIRED_DETAIL)
    if parsed.invitation_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invitation not found")
    invitation = await session.get(Invitation, parsed.invitation_id)
    if invitation is None or invitation.revoked_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invitation not found")
    if invitation.accepted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, SPENT_DETAIL)
    if _as_utc(invitation.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, EXPIRED_DETAIL)
    return invitation


@router.get("/preview", response_model=InvitationPreview)
async def preview_invitation(
    token: str = Query(..., min_length=10),
    session: AsyncSession = Depends(db_session),
) -> InvitationPreview:
    """What the accept page shows before anything is spent.

    Answered without a session, so it says only what the recipient already
    knows from the email: which organization, which address, which role. No
    member list, no org id, no counts.
    """
    invitation = await _resolve(session, token)
    org = await session.get(Organization, invitation.organization_id)
    if org is None:  # pragma: no cover — FK guarantees it
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invitation not found")
    return InvitationPreview(
        organization_name=org.name,
        email=invitation.email,
        role=invitation.role,
        expires_at=_as_utc(invitation.expires_at),
    )


@router.post("/accept", response_model=InvitationAccepted)
async def accept_invitation(
    payload: InvitationAcceptRequest,
    response: Response,
    session: AsyncSession = Depends(db_session),
) -> InvitationAccepted:
    invitation = await _resolve(session, payload.token)
    org = await session.get(Organization, invitation.organization_id)
    if org is None:  # pragma: no cover — FK guarantees it
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invitation not found")

    usage = await seat_usage(session, org.id, org.seat_cap)
    # Against `members`, not `used`: this invitation is one of the pending
    # seats being counted, and it is about to become a membership.
    if usage.members >= org.seat_cap:
        raise HTTPException(status.HTTP_409_CONFLICT, SEAT_CAP_DETAIL)

    user = (
        await session.execute(select(User).where(User.email == invitation.email))
    ).scalar_one_or_none()
    if user is None:
        # First sight of this person. Creating the row here is safe in a way it
        # was not when an owner could do it directly: we are acting on a token
        # that was delivered to this address and has just been opened.
        user = User(email=invitation.email)
        session.add(user)
        await session.flush()

    existing = (
        await session.execute(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.organization_id == org.id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        session.add(
            Membership(user_id=user.id, organization_id=org.id, role=invitation.role)
        )

    invitation.accepted_at = datetime.now(timezone.utc)
    invitation.accepted_user_id = user.id
    await session.commit()

    issue_session(response, user.id)
    logger.info(
        "invite.accepted to=%s org=%s role=%s",
        redact_email(invitation.email),
        org.name,
        invitation.role.value,
    )
    return InvitationAccepted(
        organization_id=org.id,
        organization_name=org.name,
        role=invitation.role,
    )
