/**
 * The session contract's parse and entitlement rules.
 *
 * Both halves of the app land here — `lib/session.ts` in RSC, `useSession` in
 * the browser — so this is the single place where "what does this plan unlock"
 * is answered. Every API plan value is enumerated below on purpose: a plan the
 * web fails to recognise must resolve to *free*, and the old
 * `plan !== "free"` test resolved every unrecognised string to premium.
 */

import { describe, expect, it } from "vitest";

import {
  displayName,
  firstName,
  getEntitlement,
  isAgencyWorkspace,
  monthYear,
  parseSessionUser,
  planLabel,
} from "./session-user";
import type { AccountPlan, SessionOrg, SessionUser } from "./types";

function me(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "usr-1",
    email: "sam@example.com",
    name: "Sam Patel",
    plan: "free",
    organization_id: null,
    is_premium: false,
    is_agency: false,
    role: null,
    created_at: "2026-03-04T09:12:00Z",
    organization: null,
    ...overrides,
  };
}

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "usr-1",
    email: "sam@example.com",
    name: "Sam Patel",
    plan: "free",
    role: null,
    createdAt: "2026-03-04T09:12:00Z",
    org: null,
    ...overrides,
  };
}

describe("parseSessionUser", () => {
  it("maps a full payload into camelCase", () => {
    expect(
      parseSessionUser(
        me({
          plan: "agency_pro",
          role: "agent",
          organization: {
            id: "org-1",
            name: "Cordillera Voyages",
            plan: "agency_pro",
            seat_cap: 10,
            seats_used: 7,
            created_at: "2024-02-19T11:05:00Z",
            is_personal: false,
          },
        }),
      ),
    ).toEqual({
      id: "usr-1",
      email: "sam@example.com",
      name: "Sam Patel",
      plan: "agency_pro",
      role: "agent",
      createdAt: "2026-03-04T09:12:00Z",
      org: {
        id: "org-1",
        name: "Cordillera Voyages",
        plan: "agency_pro",
        seatCap: 10,
        seatsUsed: 7,
        createdAt: "2024-02-19T11:05:00Z",
        isPersonal: false,
      },
    });
  });

  it("keeps a null name null rather than inventing one", () => {
    // Magic-link sign-up collects an address and nothing else, so this is the
    // common case, not an edge one. `session.name.split(" ")` used to throw.
    expect(parseSessionUser(me({ name: null }))?.name).toBeNull();
  });

  it.each([null, undefined, "", 42, [], { detail: "Not Found" }, { id: "x" }])(
    "returns null for a body that identifies nobody: %o",
    (body) => {
      expect(parseSessionUser(body)).toBeNull();
    },
  );

  it("downgrades an unrecognised plan to free", () => {
    // A plan the API adds later, or a value that arrives mangled, must not
    // land on the paid side of the gate.
    const parsed = parseSessionUser(me({ plan: "consumer_platinum" }));
    expect(parsed?.plan).toBe("free");
    expect(getEntitlement(parsed).premium).toBe(false);
  });

  it("downgrades the web's own retired shorthand to free", () => {
    // "premium" is what this codebase used to call `consumer_premium`. It is
    // not an API value, so seeing it means something is still speaking the old
    // vocabulary — which should be visible, not silently honoured.
    expect(parseSessionUser(me({ plan: "premium" }))?.plan).toBe("free");
  });

  it("drops an unrecognised role rather than guessing", () => {
    expect(parseSessionUser(me({ role: "superuser" }))?.role).toBeNull();
  });

  it("drops an organization with no id or name", () => {
    expect(
      parseSessionUser(me({ organization: { seat_cap: 10, seats_used: 7 } }))?.org,
    ).toBeNull();
  });

  it("defaults missing seat numbers to zero instead of NaN", () => {
    const parsed = parseSessionUser(
      me({ organization: { id: "org-1", name: "Org" } }),
    );
    expect(parsed?.org).toEqual({
      id: "org-1",
      name: "Org",
      plan: "free",
      seatCap: 0,
      seatsUsed: 0,
      createdAt: null,
      isPersonal: false,
    });
  });
});

describe("getEntitlement", () => {
  const expected: Record<AccountPlan, { premium: boolean; agency: boolean }> = {
    free: { premium: false, agency: false },
    consumer_premium: { premium: true, agency: false },
    agency_starter: { premium: true, agency: true },
    agency_pro: { premium: true, agency: true },
    agency_enterprise: { premium: true, agency: true },
  };

  it.each(Object.entries(expected))("resolves %s", (plan, gates) => {
    expect(getEntitlement(user({ plan: plan as AccountPlan }))).toMatchObject(gates);
  });

  it("gives an anonymous visitor nothing", () => {
    expect(getEntitlement(null)).toEqual({ premium: false, agency: false });
  });

  it("carries the seat cap through for the agency surfaces", () => {
    const session = user({
      plan: "agency_starter",
      org: {
        id: "org-1",
        name: "Org",
        plan: "agency_starter",
        seatCap: 3,
        seatsUsed: 2,
        createdAt: null,
        isPersonal: false,
      },
    });
    expect(getEntitlement(session).seatCap).toBe(3);
  });
});

describe("isAgencyWorkspace", () => {
  function org(overrides: Partial<SessionOrg> = {}): SessionOrg {
    return {
      id: "org-1",
      name: "Cordillera",
      plan: "agency_starter",
      seatCap: 3,
      seatsUsed: 1,
      createdAt: null,
      isPersonal: false,
      ...overrides,
    };
  }

  it("is false for an anonymous visitor and for a user with no org", () => {
    expect(isAgencyWorkspace(null)).toBe(false);
    expect(isAgencyWorkspace(user({ org: null }))).toBe(false);
  });

  it("is false for a consumer's personal organization", () => {
    // A wallet, not a workspace. This one is the reason the flag exists: a
    // premium consumer *does* have an org, and must not get a team page.
    const session = user({
      plan: "consumer_premium",
      org: org({ plan: "consumer_premium", isPersonal: true, seatCap: 1 }),
    });
    expect(isAgencyWorkspace(session)).toBe(false);
  });

  it("is true for an agency workspace that has not paid yet", () => {
    // The wizard creates the org before checkout, so it sits on the free plan
    // with one seat. Its dashboard is where the upgrade path lives — gating
    // the dashboard on the plan would hide the way to buy the plan.
    const session = user({ plan: "free", org: org({ plan: "free", seatCap: 1 }) });
    expect(isAgencyWorkspace(session)).toBe(true);
    // …and it is still not entitled to anything premium.
    expect(getEntitlement(session)).toMatchObject({ premium: false, agency: false });
  });

  it("is true for a paid agency", () => {
    expect(isAgencyWorkspace(user({ plan: "agency_pro", org: org({ plan: "agency_pro" }) }))).toBe(
      true,
    );
  });

  it("treats a payload with no is_personal field as a workspace only if it has an org", () => {
    // `parseSessionUser` defaults the flag to false, so an older payload reads
    // as a workspace. That is the safe direction: the shell shows a team page
    // to somebody with no team, rather than hiding an agency's.
    const parsed = parseSessionUser({
      id: "u1",
      email: "a@example.com",
      plan: "agency_pro",
      created_at: null,
      organization: { id: "o1", name: "Org", plan: "agency_pro", seat_cap: 3, seats_used: 1 },
    });
    expect(parsed?.org?.isPersonal).toBe(false);
    expect(isAgencyWorkspace(parsed)).toBe(true);
  });
});

describe("display helpers", () => {
  it("falls back to the email when there is no name", () => {
    expect(displayName(user({ name: null }))).toBe("sam@example.com");
    expect(firstName(user({ name: null }))).toBe("sam@example.com");
    expect(firstName(user({ name: "Sam Patel" }))).toBe("Sam");
  });

  it("labels every plan", () => {
    expect(planLabel("consumer_premium")).toBe("Premium");
    expect(planLabel("agency_pro")).toBe("Agency · Pro");
  });

  it("formats an account age in UTC, not the renderer's zone", () => {
    // Server and browser render this same string; a local-time formatter would
    // hydrate to a different month for anyone west of UTC on the 1st.
    expect(monthYear("2026-03-01T00:30:00Z")).toBe("Mar 2026");
    expect(monthYear(null)).toBeNull();
    expect(monthYear("not a date")).toBeNull();
  });
});
