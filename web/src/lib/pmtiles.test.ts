import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A signed tile archive keeps one identity while its signature rotates. These
 * pin the two halves of that: the archive is registered once under its
 * query-less key, and its range requests follow whichever signed URL is current.
 */

const addProtocol = vi.fn();
vi.mock("maplibre-gl", () => ({ default: { addProtocol } }));

const { archiveKey, bindSignedArchive, SignedArchiveSource } = await import("./pmtiles");

afterEach(() => vi.unstubAllGlobals());

function rangeResponse(): Response {
  return new Response(new Uint8Array(4), {
    status: 206,
    headers: { "Content-Length": "4", "Content-Range": "bytes 0-3/100" },
  });
}

describe("archiveKey", () => {
  it("drops the signature, whichever scheme signed it", () => {
    expect(archiveKey("https://cdn.test/_tiles/free.pmtiles?token=HS256-x&expires=1")).toBe(
      "https://cdn.test/_tiles/free.pmtiles",
    );
    expect(archiveKey("https://cdn.test/_tiles/free.pmtiles?exp=1&sig=a")).toBe(
      "https://cdn.test/_tiles/free.pmtiles",
    );
  });
});

describe("SignedArchiveSource", () => {
  it("keeps its key and fetches from the current URL after a re-issue", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => rangeResponse());
    vi.stubGlobal("fetch", fetchSpy);

    const source = new SignedArchiveSource("https://cdn.test/a.pmtiles", "https://cdn.test/a.pmtiles?sig=1");
    await source.getBytes(0, 4);
    source.setUrl("https://cdn.test/a.pmtiles?sig=2");
    await source.getBytes(0, 4);

    expect(source.getKey()).toBe("https://cdn.test/a.pmtiles");
    expect(fetchSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://cdn.test/a.pmtiles?sig=1",
      "https://cdn.test/a.pmtiles?sig=2",
    ]);
  });
});

describe("bindSignedArchive", () => {
  it("registers the protocol once and re-points an archive it already knows", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => rangeResponse());
    vi.stubGlobal("fetch", fetchSpy);

    const first = bindSignedArchive("https://cdn.test/b.pmtiles?token=t1&expires=1");
    const second = bindSignedArchive("https://cdn.test/b.pmtiles?token=t2&expires=2");

    expect(first).toBe("https://cdn.test/b.pmtiles");
    expect(second).toBe(first);
    expect(addProtocol).toHaveBeenCalledTimes(1);
  });
});
