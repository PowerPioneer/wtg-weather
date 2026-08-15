import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Same rationale as the two browser-API stubs below: jsdom has no App Router,
// so any component reaching for `useRouter` throws the moment it renders —
// including components a test is not there to exercise, like the save-trip
// button inside the map's climate panel. A test that actually asserts on
// navigation mocks `next/navigation` itself, which takes precedence.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({
      push: () => {},
      replace: () => {},
      refresh: () => {},
      back: () => {},
      forward: () => {},
      prefetch: () => {},
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/",
  };
});

// jsdom implements no media queries at all, and components that branch on
// viewport (the map's mobile sheet vs. desktop modal) call `matchMedia` during
// their first effect. Stub it as "no query matches" — a test that cares about
// the mobile branch overrides `window.matchMedia` itself.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Same story for ResizeObserver: jsdom ships none, and the map's hover card
// observes its container so it can flip before running off the edge. Sizes are
// all 0 in jsdom, so the stub simply never reports a resize.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
