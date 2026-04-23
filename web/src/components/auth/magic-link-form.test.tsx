import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MagicLinkForm } from "./magic-link-form";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  pushMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MagicLinkForm", () => {
  it("posts the email to /api/auth/magic-link and redirects on success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<MagicLinkForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "maya@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/magic-link",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: "maya@example.com" });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login/sent?email=maya%40example.com");
    });
  });

  it("shows an error on 422 and does not redirect", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 422 }));
    render(<MagicLinkForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "bad");
    await userEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/doesn't look right/i);
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders a Google OAuth link that hits the API directly", () => {
    render(<MagicLinkForm />);
    const link = screen.getByRole("link", { name: /continue with google/i });
    expect(link).toHaveAttribute("href", "/api/auth/google");
  });
});
