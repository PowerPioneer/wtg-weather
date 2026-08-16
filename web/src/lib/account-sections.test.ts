/**
 * Which sections each role is offered.
 *
 * WS-C item 5. The line is the API's: an agency's billing belongs to its owner
 * and admins, and `services.billing.billable_organization` falls an agent back
 * to their *personal* organization — so an agent who reached the Billing tab
 * would see either their own (usually absent) plan or a 404 from the portal.
 * `test_billing.py::test_agent_of_an_agency_gets_no_portal` pins that side.
 *
 * These pin ours: we do not advertise the door, and we do not let `?s=billing`
 * open it either — a deep link from a colleague's shared URL is the obvious
 * way somebody arrives there without clicking.
 */

import { describe, expect, it } from "vitest";

import {
  agencySections,
  canManageBilling,
  resolveAgencySection,
} from "./account-sections";

const COUNTS = { clients: 4, team: 3 };

describe("agencySections", () => {
  it.each(["owner", "admin"] as const)("offers billing to an %s", (role) => {
    expect(agencySections(role, COUNTS).map((s) => s.id)).toEqual([
      "overview",
      "clients",
      "team",
      "branding",
      "billing",
    ]);
  });

  it.each(["agent", "member", null] as const)(
    "does not offer billing to %s",
    (role) => {
      const ids = agencySections(role, COUNTS).map((s) => s.id);
      expect(ids).not.toContain("billing");
      // They keep everything else — an agent's job is the clients.
      expect(ids).toEqual(["overview", "clients", "team", "branding"]);
    },
  );

  it("carries the counts the sidebar prints", () => {
    const sections = agencySections("owner", COUNTS);
    expect(sections.find((s) => s.id === "clients")?.count).toBe(4);
    expect(sections.find((s) => s.id === "team")?.count).toBe(3);
  });
});

describe("resolveAgencySection", () => {
  it("sends an agent who deep-links to billing back to the overview", () => {
    expect(resolveAgencySection("billing", "agent")).toBe("overview");
    expect(resolveAgencySection("billing", "member")).toBe("overview");
    expect(resolveAgencySection("billing", null)).toBe("overview");
  });

  it("lets an owner and an admin through", () => {
    expect(resolveAgencySection("billing", "owner")).toBe("billing");
    expect(resolveAgencySection("billing", "admin")).toBe("billing");
  });

  it("treats an unknown section like a missing one", () => {
    expect(resolveAgencySection("activity", "owner")).toBe("overview");
    expect(resolveAgencySection(undefined, "owner")).toBe("overview");
    expect(resolveAgencySection("", "owner")).toBe("overview");
  });

  it("passes the sections everyone shares", () => {
    for (const id of ["clients", "team", "branding"] as const) {
      expect(resolveAgencySection(id, "agent")).toBe(id);
    }
  });
});

describe("canManageBilling", () => {
  it("is owner and admin only, and never defaults open", () => {
    expect(canManageBilling("owner")).toBe(true);
    expect(canManageBilling("admin")).toBe(true);
    expect(canManageBilling("agent")).toBe(false);
    expect(canManageBilling("member")).toBe(false);
    expect(canManageBilling(null)).toBe(false);
  });
});
