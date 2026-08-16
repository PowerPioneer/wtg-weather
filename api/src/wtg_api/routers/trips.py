from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import current_entitlement, current_user, db_session
from wtg_api.models import Alert, Client, Favourite, Membership, Trip, User
from wtg_api.services.entitlements import Entitlement
from wtg_api.schemas import (
    AlertCreate,
    AlertRead,
    AlertUpdate,
    FavouriteCreate,
    FavouriteRead,
    TripCreate,
    TripPublicRead,
    TripRead,
    TripShareRead,
    TripUpdate,
)

# 32 bytes of urandom, url-safe. Long enough that guessing is not a threat
# model, which matters because this token is the whole authorisation for the
# public view — there is no session behind it.
SHARE_TOKEN_BYTES = 32

router = APIRouter(prefix="/api", tags=["trips"])


# --- Trips ---


@router.get("/trips", response_model=list[TripRead])
async def list_trips(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[Trip]:
    result = await session.execute(select(Trip).where(Trip.owner_id == user.id))
    return list(result.scalars().all())


@router.post("/trips", response_model=TripRead, status_code=status.HTTP_201_CREATED)
async def create_trip(
    payload: TripCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Trip:
    if payload.client_id is not None:
        client = await session.get(Client, payload.client_id)
        if client is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "client not found")
        await _ensure_user_in_org(session, user, client.organization_id)

    trip = Trip(
        owner_id=user.id,
        client_id=payload.client_id,
        title=payload.title,
        country_iso2=payload.country_iso2,
        region_code=payload.region_code,
        month=payload.month,
        preferences=payload.preferences,
    )
    session.add(trip)
    await session.commit()
    await session.refresh(trip)
    return trip


@router.get("/trips/{trip_id}", response_model=TripRead)
async def get_trip(
    trip_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Trip:
    trip = await session.get(Trip, trip_id)
    if trip is None or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trip not found")
    return trip


@router.patch("/trips/{trip_id}", response_model=TripRead)
async def update_trip(
    trip_id: uuid.UUID,
    payload: TripUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Trip:
    trip = await session.get(Trip, trip_id)
    if trip is None or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trip not found")
    data = payload.model_dump(exclude_unset=True)
    # Assigning a trip to a client is a PATCH, and it went unchecked: `create`
    # verified that the caller belongs to the client's organization and this
    # path set the column straight from the body. An agent could therefore file
    # their trip against another agency's client — which is a write into that
    # agency's client page, from outside it.
    if "client_id" in data and data["client_id"] is not None:
        client = await session.get(Client, data["client_id"])
        if client is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "client not found")
        await _ensure_user_in_org(session, user, client.organization_id)
    for k, v in data.items():
        setattr(trip, k, v)
    await session.commit()
    await session.refresh(trip)
    return trip


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    trip = await session.get(Trip, trip_id)
    if trip is None or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trip not found")
    await session.delete(trip)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Trip sharing ---
#
# Three routes, one rule: the owner controls whether a link exists, and the
# link is the only thing an anonymous viewer needs. Declared after
# `/trips/{trip_id}` but they cannot collide with it — these carry an extra
# path segment.


@router.post("/trips/{trip_id}/share", response_model=TripShareRead)
async def share_trip(
    trip_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> TripShareRead:
    """Mint a share token, or return the existing one.

    Idempotent on purpose: pressing "share" twice should hand back the same
    link, not silently invalidate the one already sent. Rotation is a revoke
    followed by a share, which is the deliberate act it should be.
    """
    trip = await _owned_trip(session, trip_id, user)
    if trip.share_token is None:
        trip.share_token = secrets.token_urlsafe(SHARE_TOKEN_BYTES)
        await session.commit()
        await session.refresh(trip)
    return TripShareRead(share_token=trip.share_token)


@router.delete("/trips/{trip_id}/share", status_code=status.HTTP_204_NO_CONTENT)
async def unshare_trip(
    trip_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    trip = await _owned_trip(session, trip_id, user)
    trip.share_token = None
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/trips/shared/{token}", response_model=TripPublicRead)
async def read_shared_trip(
    token: str = Path(min_length=16, max_length=64),
    session: AsyncSession = Depends(db_session),
) -> TripPublicRead:
    """The public read-only view. No session required — the token is the grant.

    A revoked token is a 404, the same answer a never-existent one gets: the
    recipient of a withdrawn link learns that it does not work, not that it
    used to.
    """
    trip = (
        await session.execute(select(Trip).where(Trip.share_token == token))
    ).scalar_one_or_none()
    if trip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trip not found")
    return TripPublicRead(
        title=trip.title,
        country_iso2=trip.country_iso2,
        region_code=trip.region_code,
        month=trip.month,
        preferences=trip.preferences,
    )


async def _owned_trip(session: AsyncSession, trip_id: uuid.UUID, user: User) -> Trip:
    """The caller's trip, or 404. Not 403 — a trip they do not own should not
    be distinguishable from one that does not exist."""
    trip = await session.get(Trip, trip_id)
    if trip is None or trip.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trip not found")
    return trip


# --- Favourites ---


@router.get("/favourites", response_model=list[FavouriteRead])
async def list_favourites(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[Favourite]:
    result = await session.execute(select(Favourite).where(Favourite.user_id == user.id))
    return list(result.scalars().all())


@router.post(
    "/favourites", response_model=FavouriteRead, status_code=status.HTTP_201_CREATED
)
async def create_favourite(
    payload: FavouriteCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Favourite:
    fav = Favourite(
        user_id=user.id,
        country_iso2=payload.country_iso2.upper(),
        region_code=payload.region_code,
    )
    session.add(fav)
    await session.commit()
    await session.refresh(fav)
    return fav


@router.delete("/favourites/{fav_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favourite(
    fav_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    fav = await session.get(Favourite, fav_id)
    if fav is None or fav.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "favourite not found")
    await session.delete(fav)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Alerts ---


@router.get("/alerts", response_model=list[AlertRead])
async def list_alerts(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> list[Alert]:
    result = await session.execute(select(Alert).where(Alert.user_id == user.id))
    return list(result.scalars().all())


@router.post("/alerts", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate,
    user: User = Depends(current_user),
    entitlement: Entitlement = Depends(current_entitlement),
    session: AsyncSession = Depends(db_session),
) -> Alert:
    """Create an alert. Premium only.

    The pricing table sells "email alerts when a destination starts matching
    your preferences" as a Premium feature, and the web gates the button — but
    a gate that only exists in the UI is not a gate, and this endpoint is
    reachable directly. Enforced here so the tier boundary is where the money
    is, not where the button is.

    Reading, pausing and deleting stay open to everyone: a user who lapses
    keeps control of the alerts they already made rather than being locked out
    of turning them off.
    """
    if not entitlement.is_premium:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "alerts require a premium plan"
        )

    alert = Alert(
        user_id=user.id,
        country_iso2=payload.country_iso2.upper() if payload.country_iso2 else None,
        region_code=payload.region_code,
        month=payload.month,
        preferences=payload.preferences,
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}", response_model=AlertRead)
async def update_alert(
    alert_id: uuid.UUID,
    payload: AlertUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Alert:
    alert = await session.get(Alert, alert_id)
    if alert is None or alert.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "alert not found")
    data = payload.model_dump(exclude_unset=True)
    if "country_iso2" in data and data["country_iso2"] is not None:
        data["country_iso2"] = data["country_iso2"].upper()
    for k, v in data.items():
        setattr(alert, k, v)
    await session.commit()
    await session.refresh(alert)
    return alert


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: uuid.UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(db_session),
) -> Response:
    alert = await session.get(Alert, alert_id)
    if alert is None or alert.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "alert not found")
    await session.delete(alert)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _ensure_user_in_org(
    session: AsyncSession, user: User, organization_id: uuid.UUID
) -> None:
    m = await session.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.organization_id == organization_id,
        )
    )
    if m.scalar_one_or_none() is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a member of organization")
