import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `/privacy` makes three claims about PostHog that only this component can
 * keep: it stores nothing on the device, it never records the screen, and it
 * talks to the EU cloud. A claim in a privacy policy should be enforced by the
 * software, so each one is pinned here against the options `init` receives.
 */

const init = vi.fn();
const identify = vi.fn();

vi.mock("posthog-js", () => ({
  default: { init, identify, reset: vi.fn() },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  init.mockReset();
  identify.mockReset();
});

async function renderWithKey() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.resetModules();
  const { PostHogProvider } = await import("./posthog-provider");
  render(<PostHogProvider user={{ id: "u_1", plan: "free", role: null }} />);
  await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
  return init.mock.calls[0] as [string, Record<string, unknown>];
}

describe("PostHogProvider", () => {
  it("keeps identifiers in memory: no cookie, no localStorage", async () => {
    const [, options] = await renderWithKey();
    expect(options.persistence).toBe("memory");
  });

  it("disables session recording in code", async () => {
    const [, options] = await renderWithKey();
    expect(options.disable_session_recording).toBe(true);
  });

  it("records client-side navigations as pageviews, not only full loads", async () => {
    const [, options] = await renderWithKey();
    expect(options.capture_pageview).toBe("history_change");
  });

  it("defaults to the EU cloud", async () => {
    const [, options] = await renderWithKey();
    expect(options.api_host).toBe("https://eu.i.posthog.com");
  });

  it("identifies by account id, never by email", async () => {
    await renderWithKey();
    await waitFor(() => expect(identify).toHaveBeenCalled());
    const [distinctId, props] = identify.mock.calls[0] as [string, object];
    expect(distinctId).toBe("u_1");
    expect(JSON.stringify(props)).not.toMatch(/@/);
  });

  it("loads nothing without a key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.resetModules();
    const { PostHogProvider } = await import("./posthog-provider");
    render(<PostHogProvider user={{ id: "u_1", plan: "free", role: null }} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(init).not.toHaveBeenCalled();
  });
});
