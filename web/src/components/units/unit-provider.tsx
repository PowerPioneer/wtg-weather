"use client";

/**
 * Site-wide metric/imperial preference.
 *
 * The awkward constraint this works around: country and month pages are
 * statically generated, one HTML document per page for every visitor, and
 * `web/CLAUDE.md` forbids reading cookies or headers in the root layout
 * because a dynamic API there opts the whole app out of static generation. So
 * the server cannot know which unit to render, and the answer has to arrive
 * after hydration.
 *
 * Which means the value has to be readable by client JS, and an HttpOnly
 * cookie — what the preferences rule asks for — is by definition not. The
 * cookie here is therefore readable, carries one of two words, and is
 * documented as the exception in `lib/units.ts`. For signed-in users it is
 * mirrored into their account record so the choice still follows them to
 * another device; the cookie is what makes it survive on this one.
 *
 * Precedence, highest first:
 *   1. `?unit=` in the URL — a shared map link shows what its sender saw
 *   2. the cookie — what this browser last chose
 *   3. metric — what the server rendered, so first paint never flickers
 *
 * Every consumer renders metric on the server and on the first client render,
 * then re-renders once this resolves. That is a deliberate one-frame swap
 * rather than a hydration mismatch: React sees identical output on both sides,
 * and the effect below is what changes it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_UNIT,
  UNIT_COOKIE,
  UNIT_COOKIE_MAX_AGE,
  parseUnitSystem,
  type UnitSystem,
} from "@/lib/units";

export type UnitContextValue = {
  unit: UnitSystem;
  setUnit: (next: UnitSystem) => void;
  /** Adopt a unit from the user's stored record; see below. */
  adoptUnit: (next: UnitSystem) => void;
  /**
   * Whether this browser had already stated a preference when the page
   * loaded. A signed-in user's stored unit is applied only when it had not:
   * the cookie is this device's most recent statement, and another device's
   * record should not override it.
   */
  fromThisBrowser: boolean;
  /**
   * False until the browser preference has been read. Controls that would
   * otherwise flash the wrong state on mount can wait for it; readouts do not
   * need to, because metric is a correct answer rather than a placeholder.
   */
  ready: boolean;
};

const UnitContext = createContext<UnitContextValue>({
  unit: DEFAULT_UNIT,
  setUnit: () => {},
  adoptUnit: () => {},
  fromThisBrowser: false,
  ready: false,
});

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function writeCookie(value: UnitSystem): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${UNIT_COOKIE}=${value}; Path=/; Max-Age=${UNIT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Where a fresh page load should get its unit from. Exported for the tests. */
export function resolveInitialUnit(
  search: string,
  cookie: string | null,
): UnitSystem {
  const fromUrl = parseUnitSystem(new URLSearchParams(search).get("unit"));
  if (fromUrl) return fromUrl;
  return parseUnitSystem(cookie) ?? DEFAULT_UNIT;
}

export function UnitProvider({ children }: { children: ReactNode }) {
  /**
   * One state object rather than three pieces of state, because they are one
   * fact — "what this browser turned out to want" — resolved together on
   * mount. Three `setState` calls in a row would also be three chances for the
   * lint rule below to be argued with individually.
   */
  const [resolved, setResolved] = useState<{
    unit: UnitSystem;
    fromThisBrowser: boolean;
    ready: boolean;
  }>({ unit: DEFAULT_UNIT, fromThisBrowser: false, ready: false });

  useEffect(() => {
    const cookie = readCookie(UNIT_COOKIE);
    const next = resolveInitialUnit(window.location.search, cookie);
    // Reading the browser's own state on mount is exactly what an effect is
    // for: the server cannot know the answer, and the first client render
    // deliberately matches the server's (metric) so hydration sees identical
    // output on both sides. The one re-render this causes is the swap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved({
      unit: next,
      fromThisBrowser: cookie != null || next !== DEFAULT_UNIT,
      ready: true,
    });
    // A `?unit=` link is a choice too — persist it so the rest of the site
    // agrees with the page the visitor arrived on.
    if (next !== DEFAULT_UNIT) writeCookie(next);
  }, []);

  const setUnit = useCallback((next: UnitSystem) => {
    setResolved((prev) => ({ ...prev, unit: next, fromThisBrowser: true }));
    writeCookie(next);
  }, []);

  /**
   * Apply a unit that came from somewhere other than this browser — the
   * signed-in user's stored record. It writes the cookie so the rest of the
   * site agrees, but does not claim this browser stated it.
   */
  const adoptUnit = useCallback((next: UnitSystem) => {
    setResolved((prev) => ({ ...prev, unit: next }));
    writeCookie(next);
  }, []);

  const value = useMemo(
    () => ({ ...resolved, setUnit, adoptUnit }),
    [resolved, setUnit, adoptUnit],
  );

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

/**
 * The current unit. Safe outside a provider — it answers `metric`, which is
 * what the server rendered — so a component can be dropped into a test or a
 * storybook without one.
 */
export function useUnit(): UnitContextValue {
  return useContext(UnitContext);
}
