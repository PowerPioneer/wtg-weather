import "@testing-library/jest-dom/vitest";

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
