/**
 * The SSR data path, on the real API rather than the fixtures.
 *
 * RC-6 was a contract mismatch nobody noticed because `USE_MOCK_DATA` covered
 * it: the client called `/v1/countries/{slug}` and the API implemented
 * `/api/public/country/{iso2}`, returning a placeholder with `climate: null`.
 * The path is the thing under test here — a rename on either side is exactly
 * the failure that shipped last time.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  return import("./api-client");
}

/** A `fetch` stub that records the URL it was called with. */
function jsonOnce(body: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return status === 200
      ? Response.json(body)
      : new Response(JSON.stringify(body), { status });
  });
}

describe("getCountry", () => {
  it("calls the internal API at the path the router mounts", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    const fetchMock = jsonOnce({ slug: "georgia", name: "Georgia" });
    vi.stubGlobal("fetch", fetchMock);

    const { getCountry } = await load();
    const data = await getCountry("georgia");

    expect(data?.name).toBe("Georgia");
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toBe("http://api:8000/v1/countries/georgia");
  });

  it("returns null on 404 so the page can call notFound()", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    vi.stubGlobal("fetch", jsonOnce({ detail: "country not found" }, 404));
    const { getCountry } = await load();
    expect(await getCountry("atlantis")).toBeNull();
  });

  it("throws on anything else, rather than rendering an empty page", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    vi.stubGlobal("fetch", jsonOnce({ detail: "boom" }, 500));
    const { getCountry } = await load();
    await expect(getCountry("georgia")).rejects.toThrow(/failed: 500/);
  });

  it("escapes the slug it interpolates", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    const fetchMock = jsonOnce({}, 404);
    vi.stubGlobal("fetch", fetchMock);
    const { getCountry } = await load();
    await getCountry("../index");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "http://api:8000/v1/countries/..%2Findex",
    );
  });
});

describe("getRegion", () => {
  it("asks for the region endpoint and returns the pair", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    const fetchMock = jsonOnce({
      country: { slug: "peru", name: "Peru" },
      region: { name: "Cusco", slug: "cusco" },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getRegion } = await load();
    const pair = await getRegion("peru", "cusco");

    expect(pair?.region.name).toBe("Cusco");
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "http://api:8000/v1/countries/peru/regions/cusco",
    );
  });

  it("returns null on 404", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "0");
    vi.stubGlobal("fetch", jsonOnce({ detail: "region not found" }, 404));
    const { getRegion } = await load();
    expect(await getRegion("peru", "narnia")).toBeNull();
  });

  it("resolves out of the fixture country while mocks are on", async () => {
    vi.stubEnv("WTG_USE_MOCK_DATA", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getRegion } = await load();

    const pair = await getRegion("peru", "cusco");
    expect(pair?.region.name).toBe("Cusco");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
