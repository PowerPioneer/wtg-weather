/**
 * One hero photo per country: a recognisable tourist place, from Wikimedia
 * Commons, under a licence that allows reuse with attribution.
 *
 * `place-photos.json` is curated by hand, like the activities dataset: every
 * entry names its Commons file, author and licence as Commons states them, and
 * `place-photos.test.ts` refuses a licence outside {@link ALLOWED_LICENCES}.
 * The bytes live in `public/places/<iso2>.jpg`, fetched and sized by
 * `scripts/fetch_place_photos.py`, and are committed with the metadata so a
 * deploy needs no extra step.
 *
 * A country with no entry keeps the hero's original gradient panel. That is
 * the intended fallback, not a gap to paper over with a generic stock image:
 * a photo of somewhere else would be a claim about the wrong place.
 */

import data from "./place-photos.json";

export type PlacePhoto = {
  /** `File:…` on Wikimedia Commons. */
  file: string;
  /** Where the photo was taken, e.g. "Table Mountain, Cape Town". */
  place: string;
  /** What is visible, for screen readers. */
  alt: string;
  author: string;
  license: string;
  licenseUrl?: string;
  /** The Commons file page — the attribution link. */
  sourceUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  quality?: string;
};

/**
 * Free licences only, and only ones whose terms the hero's credit line meets:
 * author, licence and a link to the source. No NC (the site sells a
 * subscription), no ND (the hero crops), no GFDL-only (it wants the full
 * licence text reproduced).
 */
export const ALLOWED_LICENCES: readonly RegExp[] = [
  /^CC0( 1\.0)?$/,
  /^Public domain$/i,
  // A ported licence ("CC BY-SA 3.0 de") carries the same terms as its parent.
  /^CC BY( |-)(2\.0|2\.5|3\.0|4\.0)( [a-z]{2})?$/,
  /^CC BY-SA (2\.0|2\.5|3\.0|4\.0)( [a-z]{2})?$/,
];

const PHOTOS = data as Record<string, PlacePhoto>;

export function placePhoto(iso2: string): PlacePhoto | null {
  return PHOTOS[iso2.toUpperCase()] ?? null;
}

/** Served path of the sized JPEG, for `next/image` and the OG image. */
export function placePhotoPath(iso2: string): string {
  return `/places/${iso2.toLowerCase()}.jpg`;
}

export function allPlacePhotos(): Readonly<Record<string, PlacePhoto>> {
  return PHOTOS;
}

/** Public domain carries no licence to name; everything else does. */
export function isPublicDomain(photo: PlacePhoto): boolean {
  return /^(CC0|Public domain)/i.test(photo.license);
}
