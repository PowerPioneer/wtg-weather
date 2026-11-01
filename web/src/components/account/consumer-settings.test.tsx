import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConsumerAccount, SessionUser } from "@/lib/types";

import { ConsumerSettings } from "./consumer-sections";

/**
 * Account settings used to carry four controls that did nothing — Change
 * email, Connect Google, a language picker and Delete my account — and a
 * "Verified · Last magic link sent today" line printed to everybody. Every
 * control left must do something: submit a form, follow a link, or change a
 * setting.
 */

const session: SessionUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "traveller@example.com",
  name: null,
  plan: "consumer_premium",
  role: null,
  createdAt: null,
  org: null,
};

const account: ConsumerAccount = { trips: [], favourites: [], alerts: [] };

function renderSettings() {
  return render(<ConsumerSettings session={session} account={account} />);
}

describe("ConsumerSettings", () => {
  it("offers no button that does nothing", () => {
    const { container } = renderSettings();
    for (const button of container.querySelectorAll("button")) {
      const inForm = button.closest("form") !== null && button.type === "submit";
      const wired = button.getAttribute("aria-pressed") !== null || button.getAttribute("role") === "radio";
      expect(inForm || wired, `dead button: ${button.textContent}`).toBe(true);
    }
  });

  it("routes deletion and email changes to the address /privacy promises", () => {
    renderSettings();
    const del = screen.getByRole("link", { name: /delete/i });
    expect(del.getAttribute("href")).toBe(
      "mailto:powerpioneer@pm.me?subject=Delete%20my%20account",
    );
    const change = screen.getByRole("link", { name: /change it/i });
    expect(change.getAttribute("href")).toMatch(/^mailto:powerpioneer@pm\.me\?subject=/);
  });

  it("drops the language picker and the invented verification line", () => {
    renderSettings();
    expect(screen.queryByText(/language/i)).toBeNull();
    expect(screen.queryByText(/last magic link sent/i)).toBeNull();
    expect(screen.queryByText(/connected as/i)).toBeNull();
  });

  it("keeps sign out everywhere as a real form post", () => {
    renderSettings();
    const button = screen.getByRole("button", { name: /sign out everywhere/i });
    const form = button.closest("form");
    expect(form?.getAttribute("action")).toBe("/signout");
    expect(form?.querySelector<HTMLInputElement>('input[name="scope"]')?.value).toBe("all");
  });
});
