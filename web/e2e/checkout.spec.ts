import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { STACK_ENABLED } from "./helpers/stack";

/**
 * Pricing page → sandbox checkout.
 *
 * Split in two on purpose.
 *
 * The first group runs against the default suite (`pnpm dev`, no API) and
 * checks the half that is genuinely the browser's: which plan the page asks
 * for, that the CTA is a real anchor at a real route, and that a refusal is
 * shown rather than swallowed. `page.route` intercepts the browser's own POST
 * to `/api/paddle/checkout-url`, which is exactly the call under test — no API
 * is faked into existence, and no assertion here depends on one.
 *
 * The second group needs a stack: `/upgrade` is a *server* route that reads the
 * session cookie and calls the API from the Next process, which `page.route`
 * cannot see. Rather than fake it and test the fake, it is skipped with a
 * reason unless `WTG_E2E_STACK=1`.
 *
 * Never live Paddle. The sandbox URL is asserted on shape; nothing in this file
 * opens it.
 */

const SANDBOX_CHECKOUT =
  "https://sandbox-checkout.paddle.com/checkout/custom?items[0][priceId]=pri_sandbox_consumer_premium";

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("pricing page checkout handoff", () => {
  test("asks for consumer_premium and follows the URL the API returns", async ({
    page,
  }) => {
    const requests: unknown[] = [];
    await page.route("**/api/paddle/checkout-url", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          checkout_url: SANDBOX_CHECKOUT,
          sandbox: true,
          plan: "consumer_premium",
        }),
      });
    });

    // Stop the browser actually leaving for Paddle — we assert on the
    // navigation attempt, and following it would take the test off-site.
    let navigatedTo: string | null = null;
    await page.route("https://sandbox-checkout.paddle.com/**", async (route) => {
      navigatedTo = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "ok" });
    });

    await page.goto("/pricing");

    const cta = page.getByTestId("upgrade-cta").first();
    await expect(cta).toBeVisible();
    // Progressive enhancement: a real destination before any JS runs.
    await expect(cta).toHaveAttribute("href", "/upgrade?plan=consumer_premium");

    await cta.click();

    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toEqual({
      plan: "consumer_premium",
      organization_id: null,
    });

    await expect.poll(() => navigatedTo).toContain("sandbox-checkout.paddle.com");
    // The price id came from the API. If the browser had built this URL it
    // would need the price id, which is exactly what it must never hold.
    expect(navigatedTo).toContain("pri_sandbox_consumer_premium");
  });

  test("sends a signed-out visitor to sign in, remembering the plan", async ({
    page,
  }) => {
    await page.route("**/api/paddle/checkout-url", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "not authenticated" }),
      }),
    );

    await page.goto("/pricing");
    await page.getByTestId("upgrade-cta").first().click();

    await page.waitForURL(/\/login/);
    // The plan travels in the `next` param so signing in resumes the purchase
    // rather than landing on a generic page.
    expect(decodeURIComponent(page.url())).toContain("/upgrade?plan=consumer_premium");
  });

  test("says so when checkout cannot be opened, and charges nothing", async ({
    page,
  }) => {
    await page.route("**/api/paddle/checkout-url", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/pricing");
    await page.getByTestId("upgrade-cta").first().click();

    // Scoped to the CTA's own alert: Next mounts a permanently-empty
    // `role="alert"` route announcer, so an unscoped query is ambiguous.
    await expect(
      page.locator("p[role=alert]", { hasText: /couldn't open checkout/i }),
    ).toBeVisible();
    // Still on pricing — no half-navigation to somewhere that looks like a
    // payment page.
    expect(page.url()).toContain("/pricing");
  });

  test("the cancel return page says plainly that nothing was charged", async ({
    page,
  }) => {
    await page.goto("/checkout/cancel");
    await expect(page.getByRole("heading", { name: /no payment was taken/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to pricing/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Same exclusion, and same reason, as `anonymous-gates.spec.ts`: axe
      // finds contrast failures in the Atlas palette itself (here the "−33%"
      // accent on the billing toggle), which predate this workstream and are
      // token decisions for the owner — an attempt to fix them was reverted in
      // 87943ce. Every other WCAG A/AA rule stays enforced, including over the
      // CTAs this workstream rewired.
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("the pricing page has no accessibility violations with the CTAs wired", async ({
    page,
  }) => {
    await page.goto("/pricing");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Same exclusion, and same reason, as `anonymous-gates.spec.ts`: axe
      // finds contrast failures in the Atlas palette itself (here the "−33%"
      // accent on the billing toggle), which predate this workstream and are
      // token decisions for the owner — an attempt to fix them was reverted in
      // 87943ce. Every other WCAG A/AA rule stays enforced, including over the
      // CTAs this workstream rewired.
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("checkout against a real stack", () => {
  test.skip(
    !STACK_ENABLED,
    "`/upgrade` is a server route that calls the API from the Next process — " +
      "page.route cannot intercept it, and faking it would test the fake. " +
      "Run with WTG_E2E_STACK=1 against `docker compose up`.",
  );

  test("the no-JS route redirects an anonymous visitor to sign in", async ({
    page,
  }) => {
    // The same journey the CTA takes with JS off. It must not 404 and must not
    // reach Paddle without a user, since the checkout has to carry `user_id`
    // for the webhook to know whose subscription to activate.
    const response = await page.goto("/upgrade?plan=consumer_premium");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unknown plan falls back to pricing rather than erroring", async ({
    page,
  }) => {
    await page.goto("/upgrade?plan=not_a_plan");
    await expect(page).toHaveURL(/\/pricing/);
  });
});
