import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internalHrefsInSource, routeExists } from "@/lib/app-routes";
import ContactPage, { metadata as contactMeta } from "./contact/page";
import PrivacyPage, { metadata as privacyMeta } from "./privacy/page";
import RefundsPage, { metadata as refundsMeta } from "./refunds/page";
import TermsPage, { metadata as termsMeta } from "./terms/page";

/**
 * The legal set: `/privacy`, `/terms`, `/refunds`, `/contact`.
 *
 * Two things are being protected here. One is that these pages exist at all,
 * which is the footer regression. The other is that they ship as *drafts*
 * until the owner signs them off — the draft notice says so on the page, and
 * any fact the repository cannot supply is a visible placeholder rather than
 * an invented one. The placeholders were all filled with proposed text on
 * 2026-10-25; the notice stays until the owner has reviewed that text.
 */

const PAGES = [
  { name: "privacy", dir: "privacy", Page: PrivacyPage, metadata: privacyMeta },
  { name: "terms", dir: "terms", Page: TermsPage, metadata: termsMeta },
  { name: "refunds", dir: "refunds", Page: RefundsPage, metadata: refundsMeta },
  { name: "contact", dir: "contact", Page: ContactPage, metadata: contactMeta },
] as const;

const LEGAL_DIR = join(process.cwd(), "src", "app", "(legal)");

function pageSource(dir: string): string {
  return readFileSync(join(LEGAL_DIR, dir, "page.tsx"), "utf8");
}

describe.each(PAGES)("$name page", ({ name, dir, Page, metadata }) => {
  it("renders as a server component with no client JS", () => {
    // The zero-JS rule in `web/CLAUDE.md`. These are the pages Paddle links to
    // from checkout and the ones a regulator reads with whatever browser they
    // have; none of them needs state.
    expect(pageSource(dir)).not.toMatch(/["']use client["']/);
  });

  it("declares a canonical URL and a title", () => {
    expect(metadata.alternates?.canonical).toBe(
      `https://v2.wheretogoforgreatweather.com/${name}`,
    );
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
  });

  it("carries the draft notice until the owner signs it off", () => {
    render(<Page />);
    expect(
      screen.getByText(/Draft — pending owner review\. Not yet in force\./),
    ).toBeInTheDocument();
  });

  it("shows any unsupplied fact as a visible [OWNER: …] placeholder", () => {
    const { container } = render(<Page />);
    const placeholders = [...container.querySelectorAll("mark")].map(
      (m) => m.textContent ?? "",
    );
    for (const text of placeholders) {
      expect(text).toMatch(/^\[OWNER: .+\]$/);
    }
  });

  it("has a table of contents whose anchors all exist", () => {
    const { container } = render(<Page />);
    const toc = screen.getByRole("navigation", { name: "On this page" });
    const anchors = [...within(toc).getAllByRole("link")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("#"));
    expect(anchors.length).toBeGreaterThan(2);
    for (const href of anchors) {
      expect(container.querySelector(`section${href}`)).not.toBeNull();
    }
  });

  it.each(internalHrefsInSource(pageSource(dir)))(
    "links %s, which resolves",
    (href) => {
      expect(routeExists(href)).toBe(true);
    },
  );
});

describe("privacy page — cookie and consent posture", () => {
  it("names every cookie the app actually sets", () => {
    render(<PrivacyPage />);
    // Verified against the code: `wtg_session` (api/services/sessions.py),
    // `wtg_oauth_state` (api/routers/auth.py), `wtg_checkout_intent`
    // (web/lib/checkout-intent.ts). A cookie added later without a line here
    // is a policy that has stopped describing the software.
    for (const cookie of ["wtg_session", "wtg_oauth_state", "wtg_checkout_intent"]) {
      expect(screen.getByText(cookie)).toBeInTheDocument();
    }
  });

  // With no PostHog key in the build, nothing loads PostHog, so the page must
  // not disclose post-login analytics or a processor that never sees any data.
  it("without a PostHog key: discloses cookieless analytics only", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Plausible/);
    expect(text).toMatch(/sets no cookies/);
    expect(text).toMatch(/no separate product analytics for signed-in users/);
    expect(text).toMatch(/no session\s+recording of any kind/);
    expect(text).not.toMatch(/PostHog/);
  });

  it("says local storage is not used", () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).toMatch(/Local storage is not used/);
  });

  it("lists the payment, email, analytics, backup and CDN processors", () => {
    render(<PrivacyPage />);
    for (const processor of [
      "Paddle",
      "Scaleway Transactional Email",
      "Backblaze B2",
      "bunny.net",
    ]) {
      expect(screen.getAllByText(processor).length).toBeGreaterThan(0);
    }
  });
});

describe("privacy page — with a PostHog key in the build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // The key is a build argument, so the page that discloses PostHog and the
  // bundle that loads it are built from the same value. This is the half of
  // that pairing the test above cannot see.
  it("discloses PostHog, its EU hosting, and that it stores nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.resetModules();
    const { default: Page } = await import("./privacy/page");
    const { container } = render(<Page />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/PostHog EU cloud/);
    expect(text).toMatch(/never loaded for\s+visitors who are not signed in/);
    expect(text).toMatch(/sets no cookies and writes nothing to your device/);
    expect(text).toMatch(/no\s+recording of your screen/);
    expect(text).not.toMatch(/no separate product analytics/);
  });
});

describe("terms page", () => {
  it("names Paddle as merchant of record", () => {
    const { container } = render(<TermsPage />);
    expect(container.textContent).toMatch(
      /Paddle is the Merchant of Record for all our orders/,
    );
  });

  it("carries the not-a-forecast, not-safety-advice disclaimer", () => {
    const { container } = render(<TermsPage />);
    expect(container.textContent).toMatch(/It is not a forecast, and it is not safety advice/);
    expect(container.textContent).toMatch(/ten-year monthly averages/);
  });

  it("attributes every upstream data source", () => {
    const { container } = render(<TermsPage />);
    const text = container.textContent ?? "";
    for (const source of ["ERA5", "Natural Earth", "geoBoundaries"]) {
      expect(text).toContain(source);
    }
    // Six governments are scraped (pipeline/sources/advisories/__init__.py),
    // even though the marketing copy elsewhere still says five.
    for (const gov of [
      "United States",
      "United Kingdom",
      "Canada",
      "Australia",
      "Germany",
      "Netherlands",
    ]) {
      expect(text).toContain(gov);
    }
  });
});

describe("refund policy", () => {
  it("states the 14-day, no-questions posture the pricing page promises", () => {
    const { container } = render(<RefundsPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/14 days, no questions asked/);
    expect(text).toMatch(/Paddle is the merchant of record/i);
  });

  // Paddle has no seller-configurable refund window: its own buyer-facing
  // policy refunds only what the law requires or what it grants at its
  // discretion. The unconditional 14 days is our promise, kept by refunding
  // from the dashboard ourselves — so the page must route requests to us and
  // must not say a request to Paddle is guaranteed the same outcome.
  it("routes refunds through us and says Paddle applies its own policy", () => {
    const { container } = render(<RefundsPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Ask us/);
    expect(text).toMatch(/its own refund policy/);
    expect(text).toMatch(/If Paddle declines a request/);
    expect(text).not.toMatch(/it ends up in the same place/);
  });
});
