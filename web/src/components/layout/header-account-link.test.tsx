/**
 * The header's account CTA.
 *
 * The bug this component exists to fix: `PageHeader` hardcoded a "Sign in"
 * link, so a signed-in visitor saw "Sign in" on every page and following it
 * bounced them to `/` (because `/login` redirects when a session exists). The
 * session was fine; the header simply never asked.
 *
 * What is worth pinning is the loading render. It must be the signed-out
 * label, because that is what the Server Component emits and what a no-JS
 * visitor keeps — render nothing, or render "Account" optimistically, and
 * either hydration mismatches or the nav flickers on every page load.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/types";

import { HeaderAccountLink } from "./header-account-link";

const useSession = vi.fn();

vi.mock("@/hooks/use-session", () => ({
  useSession: () => useSession(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const USER = { id: "u_1", email: "traveller@example.com", plan: "free" } as SessionUser;

describe("HeaderAccountLink", () => {
  it("shows Sign in to an anonymous visitor", async () => {
    useSession.mockReturnValue({ session: null, loading: false });
    render(<HeaderAccountLink />);
    const link = await screen.findByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows Account once a session resolves", async () => {
    useSession.mockReturnValue({ session: USER, loading: false });
    render(<HeaderAccountLink />);
    const link = await screen.findByRole("link", { name: "Account" });
    expect(link).toHaveAttribute("href", "/account");
  });

  it("renders the signed-out label while the session is still loading", () => {
    // Not a placeholder and not nothing: this is the SSR output, so it has to
    // match or hydration warns and the nav shifts.
    useSession.mockReturnValue({ session: null, loading: true });
    render(<HeaderAccountLink />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("does not flash Account before loading finishes", async () => {
    // A session that arrives late must not have been rendered early.
    useSession.mockReturnValue({ session: USER, loading: true });
    const { rerender } = render(<HeaderAccountLink />);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();

    useSession.mockReturnValue({ session: USER, loading: false });
    rerender(<HeaderAccountLink />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Account" })).toBeInTheDocument();
    });
  });

  it("passes its class through so each nav keeps its own styling", () => {
    useSession.mockReturnValue({ session: null, loading: false });
    render(<HeaderAccountLink className="rounded-md border" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass(
      "rounded-md",
      "border",
    );
  });
});
