/**
 * Registers the `pmtiles://` protocol on MapLibre, and gives each signed tile
 * archive a **stable** identity on it.
 *
 * Signed URLs (`…/free.pmtiles?token=…&expires=…`) are re-issued about a minute
 * before their 15-minute expiry. Naming the archive by its signed URL meant the
 * style had to be rebuilt with a new source on every re-issue, and pmtiles,
 * keying its cache by URL, refetched the header, the directories and every
 * visible tile — a periodic reload of the whole map, and a miss in the
 * browser's HTTP cache for each of those fetches, since a new URL is a new key.
 *
 * Instead each archive is registered once under its URL *without* the query
 * (`https://cdn…/_tiles/free.pmtiles`), and the style points at that. A
 * re-issued URL only swaps the URL the archive's fetches go to; MapLibre, the
 * style and pmtiles' caches never see a change. Idempotent throughout — safe to
 * call from React effects that re-run.
 */

import maplibregl from "maplibre-gl";
import { FetchSource, PMTiles, Protocol, type RangeResponse, type Source } from "pmtiles";

let protocol: Protocol | null = null;
const archives = new Map<string, SignedArchiveSource>();

export function registerPmtilesProtocol(): void {
  if (protocol) return;
  protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
}

/** The stable name of a signed archive URL: everything before the query. */
export function archiveKey(signedUrl: string): string {
  return signedUrl.split("?", 1)[0];
}

/**
 * A pmtiles source whose identity is fixed while its URL can change. Range
 * requests go to whichever signed URL is current when they are made.
 */
export class SignedArchiveSource implements Source {
  private readonly fetcher: FetchSource;

  constructor(
    private readonly key: string,
    signedUrl: string,
  ) {
    this.fetcher = new FetchSource(signedUrl);
  }

  getKey(): string {
    return this.key;
  }

  get url(): string {
    return this.fetcher.url;
  }

  setUrl(signedUrl: string): void {
    this.fetcher.url = signedUrl;
  }

  getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    return this.fetcher.getBytes(offset, length, signal, etag);
  }
}

/**
 * Point the archive behind `signedUrl` at that URL, registering it on first
 * sight, and return the stable key a style should name it by
 * (`pmtiles://${key}`).
 */
export function bindSignedArchive(signedUrl: string): string {
  registerPmtilesProtocol();
  const key = archiveKey(signedUrl);
  const existing = archives.get(key);
  if (existing) {
    existing.setUrl(signedUrl);
  } else {
    const source = new SignedArchiveSource(key, signedUrl);
    archives.set(key, source);
    protocol?.add(new PMTiles(source));
  }
  return key;
}
