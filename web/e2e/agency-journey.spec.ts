import { createHmac } from "node:crypto";

import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

import {
  STACK_ENABLED,
  waitForInviteToken,
  waitForMagicLinkToken,
} from "./helpers/stack";

/**
 * WS-C's end-to-end journey:
 *
 *   owner signs in → creates the organisation → invites an agent →
 *   the agent accepts the emailed link → creates a client →
 *   assigns a trip to that client → the owner sees it on the client's page
 *
 * Every step crosses a boundary the rest of the suite stubs. Both sign-ins are
 * real magic links scraped from the API's stdout; the invitation is a real
 * one-time token that arrives the same way; the organisation, the membership,
 * the client and the trip are rows in Postgres; and `/account`,
 * `/account/clients/[id]` and `/trip/[id]` all read them from the Next
 * *server*, where `page.route` cannot reach. Faking any of it would test the
 * fake — and the specific thing under test here is the join between halves
 * that were written separately, which is exactly what a fake papers over.
 *
 * ## Running it
 *
 * Opt-in, because the default suite has no stack behind it:
 *
 * ```bash
 * WTG_E2E_STACK=1 PLAYWRIGHT_BASE_URL=http://localhost pnpm -C web test:e2e agency-journey
 * ```
 *
 * Same stack requirements as `trip-journey.spec.ts` — Caddy in front,
 * `EMAIL_PROVIDER=console` on the API, `WTG_USE_MOCK_DATA` unset on the web —
 * minus the tiles, because nothing here touches the map.
 *
 * Each run leaves two users, an organisation, a client and a trip behind in
 * whatever database it ran against. That is fine for a dev stack and is the
 * reason this never runs against anything else.
 *
 * ## The seat cap, and the one step that is not a click
 *
 * A brand-new organisation is on the free plan with one seat, which the owner
 * occupies — so the journey meets the cap before it can invite anybody. That
 * is asserted (the UI offers the upgrade path, not an error), and then the
 * plan has to actually move.
 *
 * It moves the way production moves it: a **signed Paddle webhook**. Not a
 * back door, not a test-only endpoint — the same request Paddle sends, through
 * the same HMAC check, which is why it needs the notification secret in
 * `WTG_E2E_PADDLE_WEBHOOK_SECRET`. Without that secret this spec skips rather
 * than pretending; a forged body is refused with 403 and would be a
 * confusingly-failing test rather than a passing lie.
 *
 * Driving a sandbox *checkout* to the same end is WS-B's spec, and would put a
 * hosted payment page in the middle of this one.
 */

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /send magic link/i }).click();
  await expect(page).toHaveURL(/\/login\/sent/);

  const token = await waitForMagicLinkToken(email);
  // Only the token travels, not the URL around it: the API builds that from
  // `PUBLIC_WEB_ORIGIN`, which a dev stack does not set.
  await page.goto(`/login/verify?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/account$/);
}

/**
 * Send the `subscription.created` event Paddle would send for an agency
 * checkout, signed with the stack's notification secret.
 *
 * The signature scheme is `services/paddle.py`'s: `ts=<unix>;h1=<hex>` where
 * the HMAC is SHA-256 over `"<ts>:" + rawBody`. Reproduced here rather than
 * imported because it lives on the other side of the repo, and the point of
 * this call is to exercise the real verification path — including the 403 a
 * wrong secret earns, which surfaces as a plain assertion failure below.
 */
async function activateAgencyPlan(
  request: APIRequestContext,
  organizationId: string,
): Promise<void> {
  const secret = process.env.WTG_E2E_PADDLE_WEBHOOK_SECRET;
  test.skip(
    !secret,
    "WTG_E2E_PADDLE_WEBHOOK_SECRET is unset, so the agency plan cannot be " +
      "activated the way Paddle activates it. Set it to the stack's " +
      "PADDLE_WEBHOOK_SECRET and re-run; the seat-cap and invite halves of " +
      "this journey need a plan with more than one seat.",
  );

  const body = JSON.stringify({
    event_id: `evt_e2e_${Date.now()}`,
    event_type: "subscription.created",
    data: {
      id: `sub_e2e_${Date.now()}`,
      custom_data: { organization_id: organizationId, plan: "agency_pro" },
      items: [],
    },
  });
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", secret!)
    .update(`${ts}:${body}`)
    .digest("hex");

  const res = await request.post("/api/webhooks/paddle", {
    data: body,
    headers: {
      "Content-Type": "application/json",
      "Paddle-Signature": `ts=${ts};h1=${h1}`,
    },
    failOnStatusCode: false,
  });
  // 403 means the secret is wrong, which is worth saying plainly — it is the
  // difference between "your env is misconfigured" and "the feature broke".
  expect(
    res.status(),
    "the webhook was refused; check WTG_E2E_PADDLE_WEBHOOK_SECRET matches the stack",
  ).toBe(200);
}

function address(role: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `wtg-e2e-${role}-${unique}@example.com`;
}

test.describe("WS-C · agency journey", () => {
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

  test("owner invites an agent, who accepts, creates a client and assigns a trip", async ({
    page,
    browser,
  }) => {
    // Two magic-link round trips, an invitation round trip and a whole stack.
    test.setTimeout(240_000);

    const ownerEmail = address("owner");
    const agentEmail = address("agent");
    const orgName = `Cordillera ${Date.now()}`;
    const clientName = `Westfield ${Date.now()}`;

    // ── The owner signs in and creates the organisation ────────────────
    //
    // `?kind=agency` is the only route into the agency wizard for a new
    // account: the choice used to be inferred from an agency plan, and an
    // agency plan needs an organisation that only this wizard creates.

    await signIn(page, ownerEmail);

    await page.goto("/onboarding?kind=agency");
    await page.getByLabel(/agency name/i).fill(orgName);
    await page.getByLabel(/base region/i).fill("Lima, PE");
    await page.getByRole("button", { name: /continue/i }).click();

    // The org exists from here on, on the free plan, with the owner in its one
    // seat. The account shell switches on that membership, not on the plan.
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible();

    // ── The free plan's one seat is the cap ───────────────────────────
    //
    // The owner occupies it, so there is nothing to invite into and the panel
    // offers the upgrade path rather than an error.

    await page.goto("/account?s=team");
    await expect(page.getByTestId("seat-cap-upgrade")).toBeVisible();
    await expect(page.getByTestId("upgrade-cta")).toHaveAttribute(
      "data-plan",
      "agency_pro",
    );

    // Move the plan the way Paddle moves it. `organizationId` is read off the
    // page rather than guessed: the upgrade CTA carries it, because that is
    // the org a checkout would attach seats to.
    const orgId = new URL(
      (await page.getByTestId("upgrade-cta").getAttribute("href")) ?? "",
      "http://localhost",
    ).searchParams.get("org");
    expect(orgId).toBeTruthy();
    await activateAgencyPlan(page.request, orgId!);

    // ── Invite the agent ──────────────────────────────────────────────

    await page.reload();
    await page.getByLabel("Invite by email").fill(agentEmail);
    await page.getByRole("button", { name: "Send invitation" }).click();

    await expect(
      page.getByRole("button", {
        name: `Revoke the invitation to ${agentEmail}`,
      }),
    ).toBeVisible();
    // The token is in the mailbox and nowhere else — not in the response, not
    // on the page.
    await expect(page.getByText(/token/i)).toHaveCount(0);

    const inviteToken = await waitForInviteToken(agentEmail);

    // ── The agent accepts, in a browser with no session at all ────────

    const agentContext = await browser.newContext();
    const agentPage = await agentContext.newPage();
    try {
      await agentPage.goto(`/invite?token=${encodeURIComponent(inviteToken)}`);
      await expect(
        agentPage.getByRole("heading", { name: new RegExp(orgName) }),
      ).toBeVisible();
      await agentPage.getByRole("button", { name: /accept and sign in/i }).click();

      // Accepting *is* the sign-in: the API sets a session for the address the
      // invitation was mailed to.
      await expect(agentPage).toHaveURL(/\/account$/);
      await expect(agentPage.getByText(agentEmail).first()).toBeVisible();

      // An agent sees the clients and not the billing.
      await expect(
        agentPage.getByRole("link", { name: /^Clients/ }),
      ).toBeVisible();
      await expect(agentPage.getByRole("link", { name: /^Billing/ })).toHaveCount(0);
      await agentPage.goto("/account?s=billing");
      await expect(agentPage.getByRole("heading", { name: orgName })).toBeVisible();

      // ── The agent creates a client ──────────────────────────────────

      await agentPage.goto("/account?s=clients");
      await agentPage.getByRole("button", { name: "+ New client" }).click();
      await agentPage.getByLabel("Client name").fill(clientName);
      await agentPage.getByRole("button", { name: "Add client" }).click();

      const clientLink = agentPage.getByRole("link", { name: clientName });
      await expect(clientLink).toBeVisible();
      const clientPath = new URL(
        (await clientLink.getAttribute("href")) ?? "",
        "http://localhost",
      ).pathname;

      // ── …and assigns a trip to them ─────────────────────────────────
      //
      // Created through the API rather than the map: this journey is about the
      // assignment, and `trip-journey.spec.ts` already drives a save from the
      // map end to end.

      const created = await agentPage.request.post("/api/trips", {
        data: { title: "Peru in April", country_iso2: "PE", month: 4 },
      });
      expect(created.status()).toBe(201);
      const tripId = (await created.json()).id as string;

      await agentPage.goto(`/trip/${tripId}`);
      await agentPage.getByLabel("Client").selectOption({ label: clientName });
      await expect(agentPage.getByText(/it shows on their page now/i)).toBeVisible();

      // ── The owner sees it on the client's page ──────────────────────
      //
      // A different person, in a different browser context: the client record
      // and the trip belong to the organisation, not to whoever made them.

      await page.goto(`${clientPath}?tab=trips`);
      const row = page.getByRole("row", { name: /Peru in April/ });
      await expect(row).toBeVisible();
      await expect(row).toContainText(agentEmail);
      await expect(row).toContainText("April");
    } finally {
      await agentContext.close();
    }
  });
});
