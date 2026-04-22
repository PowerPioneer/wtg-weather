from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wtg_api.deps import current_user, db_session
from wtg_api.models import Alert, Client, Favourite, Membership, Trip, User
from wtg_api.schemas import (
    AlertCreate,
    AlertRead,
    FavouriteCreate,
    FavouriteRead,
    TripCreate,
    TripRead,
    TripUpdate,
)

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
    session: AsyncSession = Depends(db_session),
) -> Alert:
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
