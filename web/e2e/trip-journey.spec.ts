import { expect, test, type Page } from "@playwright/test";

import { STACK_ENABLED, waitForMagicLinkToken } from "./helpers/stack";

/**
 * WS-A's end-to-end journey, on real data:
 *
 *   sign in → create a trip from the map → see it in the account
 *   → open the public share link signed out
 *
 * This is the half of WS-A's e2e that `anonymous-gates.spec.ts` could not
 * cover. Every step here crosses a boundary that the rest of the suite stubs:
 * the magic link is sent by FastAPI and read out of its stdout, the trip is a
 * row in Postgres, and `/account`, `/trip/[id]` and `/trip/share/[token]` all
 * read that row from the Next *server*, where `page.route` cannot reach.
 *
 * ## Running it
 *
 * Opt-in, because the default suite has no stack behind it:
 *
 * ```bash
 * WTG_E2E_STACK=1 PLAYWRIGHT_BASE_URL=http://localhost pnpm -C web test:e2e trip-journey
 * ```
 *
 * What the stack must have:
 *
 *   - Caddy in front, so the browser's `/api/*` reaches the API on the same
 *     origin the pages are served from (`docker-compose.dev.yml` +
 *     `infra/caddy/Caddyfile.dev` do exactly this on `http://localhost`).
 *   - `EMAIL_PROVIDER=console` on the API. The sign-in link is scraped from its
 *     stdout; `helpers/stack.ts` says how to point that read somewhere else.
 *   - The API's country bundle mounted (`COUNTRY_DATA_DIR`) and `web` running
 *     with `WTG_USE_MOCK_DATA` **unset** — the trip page ranks destinations out
 *     of the published payload.
 *   - Tiles the browser can actually load: the map step clicks a real polygon,
 *     and MapLibre only has polygons if `GET /api/tiles/url`'s `CDN_URL` serves
 *     `free.pmtiles` to this origin with CORS. A dev stack needs `CDN_URL`
 *     pointed at something local; the default is the production CDN, which
 *     only answers to the v2 origin. The map step says so when it fails.
 *
 * Each run signs up a fresh address, so it leaves one user and one trip behind
 * in whatever database it ran against. That is fine for a dev stack and is the
 * reason this never runs against anything else.
 */

test.describe("WS-A · trip journey", () => {
  // One journey, one narrative: the anonymous share view is a second browser
  // context inside the same test rather than a second test, because it needs a
  // token that only the first half can produce.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(!STACK_ENABLED, "needs a real stack — see the header of this file");
    if (!process.env.PLAYWRIGHT_BASE_URL) {
      throw new Error(
        "WTG_E2E_STACK=1 but PLAYWRIGHT_BASE_URL is unset, so Playwright would " +
          "start its own `pnpm dev` with WTG_USE_MOCK_DATA=1 and no API. Point " +
          "it at the stack, e.g. PLAYWRIGHT_BASE_URL=http://localhost.",
      );
    }
  });

  test("sign in, save a trip from the map, find it in the account, share it", async ({
    page,
    browser,
  }) => {
    // A whole stack, a WebGL map and a magic link round-trip; the default 30s
    // is for a page, not for this.
    test.setTimeout(240_000);

    const email = `wtg-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

    // ── Sign in ────────────────────────────────────────────────────────
    //
    // The real flow, all of it: the form posts to FastAPI, FastAPI mails a
    // link, and the link is what mints the session. Nothing here sets a cookie
    // by hand.

    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(email);
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page).toHaveURL(/\/login\/sent/);

    const token = await waitForMagicLinkToken(email);

    // Only the token travels, not the URL around it: the API builds that URL
    // from `PUBLIC_WEB_ORIGIN`, which compose does not set, so it still says
    // `localhost:3000` while the stack answers somewhere else. The link a real
    // recipient clicks is this route with this token, which is the part under
    // test.
    await page.goto(`/login/verify?token=${encodeURIComponent(token)}`);

    // `/login/verify` takes the API's `Set-Cookie` and redirects here. Landing
    // on `/login?error=` instead means the verify hop failed.
    await expect(page).toHaveURL(/\/account$/);
    // The sidebar and the overview both print it; either one proves the session
    // belongs to the address the link was sent to.
    await expect(page.getByText(email).first()).toBeVisible();

    // A brand-new account has nothing in it, which is worth pinning: it is what
    // makes the assertion after the save mean something.
    await page.goto("/account?s=trips");
    await expect(page.getByText(/no saved trips yet/i)).toBeVisible();

    // ── Create a trip from the map ─────────────────────────────────────

    const place = await openClimatePanelFromMap(page);
    const expectedTitle = `${place} in April`;

    await page.getByTestId("save-trip").click();
    await page.waitForURL(/\/trip\/[0-9a-fA-F-]{36}$/);
    const tripPath = new URL(page.url()).pathname;

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(expectedTitle);
    // The owner's view, not the public one.
    await expect(page.getByText("Your trip", { exact: true })).toBeVisible();

    // ── See it in the account ──────────────────────────────────────────

    await page.goto("/account?s=trips");
    const card = page.getByRole("link", { name: new RegExp(escapeRegExp(expectedTitle)) });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", tripPath);

    // ── Share it ───────────────────────────────────────────────────────

    await page.goto(tripPath);
    await expect(page.getByText(/○ private/i)).toBeVisible();
    await page.getByRole("button", { name: /create share link/i }).click();

    const shareInput = page.getByLabel("Share link");
    await expect(shareInput).toBeVisible();
    // The value is absolute against `SITE_URL`, which on a dev stack is still
    // the production hostname. Only the path is ours to follow.
    const sharePath = new URL(await shareInput.inputValue()).pathname;
    expect(sharePath).toMatch(/^\/trip\/share\/.+/);

    // ── Open the share link signed out ─────────────────────────────────
    //
    // A second context, so there is no session cookie in play at all — the
    // token in the path is the entire authorisation, and that is the claim.

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    try {
      const response = await anonymousPage.goto(sharePath);
      expect(response?.status()).toBe(200);

      await expect(anonymousPage).toHaveURL(new RegExp(escapeRegExp(sharePath)));
      await expect(anonymousPage.getByRole("heading", { level: 1 })).toHaveText(
        expectedTitle,
      );
      await expect(anonymousPage.getByText(/shared trip/i).first()).toBeVisible();
      await expect(anonymousPage.getByText(/read-only/i).first()).toBeVisible();

      // No owner rail: nothing on this page may rename, re-share or delete.
      await expect(
        anonymousPage.getByRole("button", { name: /stop sharing|create share link/i }),
      ).toHaveCount(0);
      await expect(
        anonymousPage.getByRole("button", { name: /delete trip/i }),
      ).toHaveCount(0);

      // ── Revoking closes it again ─────────────────────────────────────
      //
      // "Stopping makes it stop working immediately" is a promise the rail
      // makes in so many words, and the same URL is the only way to check it.

      await page.getByRole("button", { name: /stop sharing/i }).click();
      await expect(page.getByText(/○ private/i)).toBeVisible();

      const revoked = await anonymousPage.goto(sharePath);
      expect(revoked?.status()).toBe(404);
      await expect(anonymousPage.getByText(expectedTitle)).toHaveCount(0);
    } finally {
      await anonymous.close();
    }
  });
});

/**
 * Click the map until a polygon opens the climate panel, and return the name
 * the panel gives it.
 *
 * The polygon is not pinned to a country on purpose. MapLibre renders into a
 * WebGL canvas that Playwright cannot introspect, so which feature sits under a
 * given pixel is a function of the tile vintage, the viewport and the camera —
 * pinning it would buy a hard-coded country and a spec that breaks on the next
 * boundary refresh. What the journey needs is *a* saveable feature, and the
 * panel's own heading says which one it found.
 *
 * The month is pinned instead, because the trip's title is built from it and
 * `useMapState` otherwise defaults to whatever month it is today.
 */
async function openClimatePanelFromMap(page: Page): Promise<string> {
  const tileFailures: string[] = [];
  page.on("requestfailed", (request) => {
    if (/\.pmtiles/.test(request.url())) {
      tileFailures.push(`${request.url()} — ${request.failure()?.errorText ?? "failed"}`);
    }
  });
  page.on("response", (response) => {
    if (/\.pmtiles/.test(response.url()) && response.status() >= 400) {
      tileFailures.push(`${response.url()} — HTTP ${response.status()}`);
    }
  });

  await page.goto("/map?month=4");

  const map = page.getByRole("application", { name: /climate map/i });
  await expect(map).toBeVisible();
  // The canvas only exists once MapLibre has constructed itself, which it does
  // only after `/api/tiles/url` answers.
  await expect(map.locator("canvas.maplibregl-canvas")).toBeVisible({ timeout: 30_000 });

  const box = await map.boundingBox();
  if (!box) throw new Error("the map region has no box to click in");

  const panel = page.getByTestId("climate-panel");
  const saveTrip = page.getByTestId("save-trip");

  // A spread of points rather than one: most of the world view is ocean, and
  // some polygons carry no ISO-2 code (Somaliland, Northern Cyprus, the Siachen
  // Glacier), which the panel opens for but cannot offer a trip on.
  for (const y of [0.3, 0.45, 0.6, 0.75]) {
    for (const x of [0.2, 0.35, 0.5, 0.62, 0.75]) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);

      // Ocean is most of the world view, and MapLibre only fires the click
      // handler over a fill layer — no panel means nothing was under the
      // pointer, so move on.
      const opened = await panel
        .waitFor({ state: "visible", timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) continue;

      // The save control is not part of that first paint: `SaveTripButton`
      // renders a disabled placeholder until `useSession` has answered, and
      // only then decides between the button and the sign-in link.
      const saveable = await saveTrip
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (saveable) {
        const heading = await panel.getByRole("heading", { level: 2 }).textContent();
        const place = heading?.trim();
        if (place) return place;
      }

      // A polygon with no country page or no ISO-2 code at all. Clear the panel
      // before the next click — on desktop it covers the right of the map.
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    }
  }

  throw new Error(
    [
      "Clicked across the map without hitting a saveable polygon.",
      tileFailures.length > 0
        ? `The tile archive did not load:\n  ${tileFailures.slice(0, 5).join("\n  ")}`
        : "The tile requests did not fail outright — check that free.pmtiles has features at this zoom.",
      "The map paints from PMTiles fetched from CDN_URL; a dev stack has to",
      "point that at a host this origin may read (CORS included), or the map",
      "renders empty and there is nothing to click.",
    ].join("\n"),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
