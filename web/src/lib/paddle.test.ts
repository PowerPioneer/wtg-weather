import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CheckoutAlreadySubscribed,
  requestCheckout,
  requestPlanChange,
} from "./paddle";

/**
 * The two requests the browser makes to start paying. Both carry a plan and an
 * organization id and nothing else — the price and `custom_data` are the
 * API's — and an organization that already pays is told apart from a failure,
 * because the answer to it is a plan change, not an apology.
 */

const fetchMock = vi.fn();

function respond(status: number, body: unknown): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("requestCheckout", () => {
  it("turns 409 already_subscribed into its own error", async () => {
    respond(409, { detail: { code: "already_subscribed", message: "x" } });
    await expect(
      requestCheckout({ plan: "agency_pro", organizationId: "org-1" }),
    ).rejects.toBeInstanceOf(CheckoutAlreadySubscribed);
  });

  it("keeps any other 409 an ordinary failure", async () => {
    respond(409, { detail: "something else" });
    const failure = requestCheckout({ plan: "agency_pro", organizationId: "org-1" });
    await expect(failure).rejects.toThrow("failed: 409");
    await expect(failure).rejects.not.toBeInstanceOf(CheckoutAlreadySubscribed);
  });
});

describe("requestPlanChange", () => {
  it("names the plan and organization, nothing else", async () => {
    respond(200, { plan: "agency_pro", billed: "immediately" });
    const change = await requestPlanChange({ plan: "agency_pro", organizationId: "org-1" });

    expect(change).toEqual({ plan: "agency_pro", billed: "immediately" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/paddle/change-plan");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      plan: "agency_pro",
      organization_id: "org-1",
    });
  });

  it("throws on a refusal", async () => {
    respond(502, { detail: "could not change the plan right now" });
    await expect(
      requestPlanChange({ plan: "agency_pro", organizationId: "org-1" }),
    ).rejects.toThrow("failed: 502");
  });
});
