"use client";

/**
 * One place, favourited or not.
 *
 * The API has no "is this favourited" endpoint — only the user's whole list —
 * so the list is fetched once per page load and shared by every button on it.
 * The country page has one; the map's climate panel mounts a fresh one on each
 * feature click, and without the cache a user clicking around the map would
 * re-fetch their favourites on every polygon.
 *
 * The cache is a promise, not a value, so two buttons mounting in the same
 * tick share a single request rather than racing. It is cleared on every
 * mutation: a stale list is what makes a star flip back on the next render.
 */

import { useCallback, useEffect, useState } from "react";

import {
  createFavourite,
  deleteFavourite,
  isUnauthorized,
  listFavourites,
  type FavouriteRecord,
} from "@/lib/api-client";

let cached: Promise<FavouriteRecord[]> | null = null;

function loadFavourites(): Promise<FavouriteRecord[]> {
  cached ??= listFavourites().catch((error: unknown) => {
    // Don't cache a failure — the next button to mount should try again.
    cached = null;
    throw error;
  });
  return cached;
}

/** Called after every mutation, and by tests between cases. */
export function invalidateFavourites(): void {
  cached = null;
}

export type FavouriteTarget = {
  countryIso2: string;
  /** `adm1_code` for a region; omitted for a whole country. */
  regionCode?: string | null;
};

export type FavouriteState = {
  /** Null until the list resolves — the button stays neutral rather than guessing. */
  favourited: boolean | null;
  /** The user is not signed in, so there is nothing to read or write. */
  anonymous: boolean;
  pending: boolean;
  error: string | null;
  toggle: () => void;
};

/**
 * What the list said about one place. Keyed, so a hook whose target changed
 * (the map panel, re-pointed at a new polygon) reports "not yet" rather than
 * the previous polygon's answer while the new one loads.
 */
type Resolved = {
  key: string;
  row: FavouriteRecord | null;
  anonymous: boolean;
};

function keyOf(countryIso2: string, regionCode: string | null): string {
  return `${countryIso2.toUpperCase()}:${regionCode ?? ""}`;
}

function findRow(
  rows: readonly FavouriteRecord[],
  countryIso2: string,
  regionCode: string | null,
): FavouriteRecord | null {
  const key = keyOf(countryIso2, regionCode);
  return rows.find((r) => keyOf(r.countryIso2, r.regionCode) === key) ?? null;
}

export function useFavourite(target: FavouriteTarget): FavouriteState {
  const countryIso2 = target.countryIso2;
  const regionCode = target.regionCode ?? null;
  const key = keyOf(countryIso2, regionCode);

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFavourites()
      .then((rows) => {
        if (cancelled) return;
        setResolved({
          key: keyOf(countryIso2, regionCode),
          row: findRow(rows, countryIso2, regionCode),
          anonymous: false,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          setResolved({ key: keyOf(countryIso2, regionCode), row: null, anonymous: true });
          return;
        }
        // Leave it unresolved: an unreadable list means we cannot say whether
        // this place is favourited, and a hollow star would be a claim.
        setError("Couldn't load your favourites.");
      });
    return () => {
      cancelled = true;
    };
  }, [countryIso2, regionCode]);

  // Anything the previous target resolved to is not an answer about this one.
  const current = resolved?.key === key ? resolved : null;

  const toggle = useCallback(() => {
    if (pending || current === null || current.anonymous) return;
    const previous = current.row;
    setPending(true);
    setError(null);
    // Optimistic: a star that waits for a round trip feels broken. The
    // placeholder id is never sent anywhere — the reload below replaces it.
    setResolved({
      key,
      row: previous ? null : { id: "", countryIso2, regionCode },
      anonymous: false,
    });

    const work = previous
      ? deleteFavourite(previous.id)
      : createFavourite({ countryIso2, regionCode }).then(() => undefined);

    work
      .then(() => {
        invalidateFavourites();
        return loadFavourites();
      })
      .then((rows) => {
        setResolved({
          key,
          row: findRow(rows, countryIso2, regionCode),
          anonymous: false,
        });
      })
      .catch((err: unknown) => {
        if (isUnauthorized(err)) {
          setResolved({ key, row: null, anonymous: true });
          return;
        }
        setResolved({ key, row: previous, anonymous: false });
        setError("Couldn't save that. Try again.");
      })
      .finally(() => setPending(false));
  }, [countryIso2, current, key, pending, regionCode]);

  return {
    favourited: current && !current.anonymous ? current.row !== null : null,
    anonymous: current?.anonymous ?? false,
    pending,
    error,
    toggle,
  };
}
