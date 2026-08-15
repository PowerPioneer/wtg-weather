import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * What a signed-out visitor meets at each of WS-A's new controls.
 *
 * This is the half of the "sign in → create trip → see it in account → open
 * the share link signed out" journey that runs without a database. The other
 * half needs the API and Postgres — `page.route` can intercept the browser's
 * `/api/*` calls, but `/account` and `/trip/[id]` read the API **server-side**
 * from the Next process, which Playwright cannot reach. Faking those would
 * test the fake. See the note at the bottom of this file.
 *
 * The rule under test is one rule: no control on this site may look like it
 * works and silently do nothing. Every one of them either acts or says why it
 * cannot.
 */

/**
 * Sign-out is the default here, but be explicit: a leftover session cookie
 * from another spec would make every assertion below vacuous.
 */
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("/account sends a signed-out visitor to sign in, not to an empty account", async ({
  page,
}) => {
  // It used to redirect to `/signin`, which is not a route.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("the login page offers no dead 'create an account' link", async ({ page }) => {
  // There is no separate sign-up flow — the magic link creates the user on
  // first use — and the link that used to say otherwise pointed at `/signup`.
  await page.goto("/login");
  await expect(page.locator('a[href="/signup"]')).toHaveCount(0);
  await expect(page.getByText(/same link signs you in and creates/i)).toBeVisible();
});

test("an expired magic link explains itself instead of 404ing", async ({ page }) => {
  // `/login/verify` did not exist at all, so every magic link ever sent landed
  // on a 404. With no API reachable the verify hop fails, which is the
  // "unavailable" branch — the point is that it lands on the login page with
  // an explanation rather than a dead end.
  const response = await page.goto("/login/verify?token=definitely-not-valid");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByRole("alert")).toContainText(/sign-in link|complete sign-in/i);
});

test("a share link that does not resolve shows no trip", async ({ page }) => {
  // Against a stack this is a 404 — the API answers 404 for a revoked token
  // and for one that never existed alike. With no API reachable it is a 500
  // instead, which is also correct: "the backend is down" is not "this trip
  // does not exist". Either way the page must not render a trip, which is the
  // part that matters and the part that holds in both environments.
  const response = await page.goto("/trip/share/not-a-real-token-0000000000");
  expect(response?.status()).toBeGreaterThanOrEqual(400);
  await expect(page.getByText(/shared trip/i)).toHaveCount(0);
});

test("country page: favouriting asks for sign-in", async ({ page }) => {
  await page.route("**/api/favourites**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );

  await page.goto("/peru");
  const prompt = page.getByTestId("favourite-signin");
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveAttribute("href", "/login");
});

test("month page: saving a trip and setting an alert both ask for sign-in", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );

  await page.goto("/peru/april");

  const saveTrip = page.getByTestId("save-trip-signin");
  await expect(saveTrip).toBeVisible();
  await expect(saveTrip).toHaveAttribute("href", "/login");

  const alert = page.getByTestId("alert-signin");
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute("href", "/login");

  // Neither is a button that would post and be refused.
  await expect(page.getByTestId("save-trip")).toHaveCount(0);
  await expect(page.getByTestId("alert-create")).toHaveCount(0);
});

test("a free signed-in user is offered the upgrade, not a button that 403s", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        email: "sam@example.com",
        name: "Sam Patel",
        plan: "free",
        organization_id: null,
        is_premium: false,
        is_agency: false,
        role: null,
        created_at: "2026-03-04T09:12:00Z",
        organization: null,
      }),
    }),
  );

  await page.goto("/peru/april");

  const upgrade = page.getByTestId("alert-upgrade");
  await expect(upgrade).toBeVisible();
  await expect(upgrade).toContainText("Alerts are a Premium feature.");
  await expect(upgrade.getByRole("link")).toHaveAttribute("href", "/pricing");

  // A free user can still save a trip — that is not the gated feature.
  await expect(page.getByTestId("save-trip")).toBeVisible();
});

test("the month page still renders with JavaScript disabled", async ({ browser }) => {
  // The SEO surface is the business (`web/CLAUDE.md`). The controls added in
  // WS-A are progressive enhancement: they must be absent without JS, and
  // nothing else may change.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/peru/april");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/regional/i).first()).toBeVisible();
  await expect(page.getByTestId("save-trip")).toHaveCount(0);
  await expect(page.getByTestId("save-trip-signin")).toHaveCount(0);

  await context.close();
});

test("the new anonymous surfaces have no accessibility violations", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/favourites**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );

  for (const path of ["/peru", "/peru/april", "/login"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // `color-contrast` is disabled here deliberately, and it is not a pass.
      // Axe finds serious contrast failures across the Atlas palette itself —
      // the score badge's `text-text-inverse` on `bg-score-acceptable`, the
      // chart legend's muted text, `text-accent` on `bg-background` — on pages
      // that predate this workstream. Those are token decisions, and
      // `web/CLAUDE.md` says to flag a design/a11y conflict rather than
      // silently deviate from `web/design/tokens.md`. Raised with the owner;
      // every other WCAG A/AA rule stays enforced here, including on the
      // controls this workstream added.
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations, `${path} has a11y violations`).toEqual([]);
  }
});

/*
 * Still to write, and honestly blocked rather than forgotten:
 *
 *   sign in → create trip from map → see it in account → open the share link
 *   signed out
 *
 * needs a running API and Postgres. The web reads `/api/trips`, `/api/me` and
 * `/api/alerts` from the Next server for `/account`, `/trip/[id]` and
 * `/trip/share/[token]`, so `page.route` — which only sees the browser's own
 * requests — cannot stand in for them. Running it means pointing
 * `PLAYWRIGHT_BASE_URL` at a stack with a seeded database, which the config
 * already supports.
 */
