import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The resolver exists because the two things a map click knows about an
 * admin-1 polygon — its `adm1_code` and its name — are not the thing the page
 * is filed under. The pipeline de-duplicates region slugs, so a colliding pair
 * differ by a suffix carrying the code, and slugging the name in the browser
 * would send one of them to the other's page without any sign of it.
 */

const getCountry = vi.fn();
vi.mock("@/lib/api-client", () => ({ getCountry }));

// `redirect` throws a control-flow signal in Next; the test only needs to see
// where it was pointed.
class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`redirect:${location}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location);
  },
}));

const { GET } = await import("./route");

const GEORGIA = {
  slug: "georgia",
  name: "Georgia",
  regions: [
    { name: "Kakheti", slug: "kakheti", code: "GEO-1", score: 70, tl: [], rl: [], sl: [] },
    // The collision the pipeline suffixes: both names slug to "imereti".
    { name: "Imereti", slug: "imereti", code: "GEO-2", score: 68, tl: [], rl: [], sl: [] },
    { name: "Imeretí", slug: "imereti-geo-3", code: "GEO-3", score: 66, tl: [], rl: [], sl: [] },
  ],
};

async function resolve(code: string, search = ""): Promise<string> {
  const request = { nextUrl: new URL(`https://wtg.test/region/georgia/${code}${search}`) };
  try {
    await GET(request as never, {
      params: Promise.resolve({ country: "georgia", code }),
    });
  } catch (error) {
    if (error instanceof RedirectSignal) return error.location;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  getCountry.mockReset();
  getCountry.mockResolvedValue(GEORGIA);
});

describe("region resolver", () => {
  it("redirects a polygon id to that region's canonical page", async () => {
    expect(await resolve("GEO-1")).toBe("/georgia/kakheti");
  });

  it("keeps colliding names apart, which is the whole point", async () => {
    // Both slug to "imereti"; only the code says which one was clicked.
    expect(await resolve("GEO-2")).toBe("/georgia/imereti");
    expect(await resolve("GEO-3")).toBe("/georgia/imereti-geo-3");
  });

  it("falls back to the name while a bundle predates the published code", async () => {
    getCountry.mockResolvedValue({
      ...GEORGIA,
      regions: GEORGIA.regions.map((region) => {
        const { code, ...rest } = region;
        void code;
        return rest;
      }),
    });
    expect(await resolve("GEO-1", "?name=Kakheti")).toBe("/georgia/kakheti");
  });

  it("lands on the country page rather than a 404 when nothing resolves", async () => {
    expect(await resolve("GEO-404")).toBe("/georgia");
  });

  it("sends an unknown country back to the map", async () => {
    getCountry.mockResolvedValue(null);
    expect(await resolve("GEO-1")).toBe("/map");
  });
});
