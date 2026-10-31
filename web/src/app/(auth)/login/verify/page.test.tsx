import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * The magic link's landing must not spend the link. Mail scanners GET every
 * link in a message before the recipient does; links are single-use, so a GET
 * that signed in would sign in the scanner. This page may only render a form.
 */

const redirect = vi.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { default: VerifyPage } = await import("./page");

describe("/login/verify", () => {
  it("renders a form that posts the token, and calls nothing itself", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(await VerifyPage({ searchParams: Promise.resolve({ token: "tok-123" }) }));

    const button = screen.getByRole("button", { name: /sign in/i });
    const form = button.closest("form");
    expect(form?.getAttribute("action")).toBe("/login/confirm");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.querySelector<HTMLInputElement>('input[name="token"]')?.value).toBe("tok-123");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sends a link with no token back to the login page", async () => {
    await expect(VerifyPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/login?error=missing",
    );
  });
});
