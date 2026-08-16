/**
 * Which sections an account shell offers, by role.
 *
 * One list, because two surfaces render it: `/account` and
 * `/account/clients/[id]`, and a sidebar that offers Billing on one and not
 * the other is how a user learns to distrust the navigation.
 *
 * The role line is the same one the API draws in
 * `services.billing.billable_organization`: an agency's billing is the owner's
 * and the admin's, never the agent's — `GET /api/billing` reports that agent's
 * *personal* plan (usually nothing) and `POST /api/billing/portal` answers 404
 * for them. Offering them a Billing tab would mean offering a tab that shows
 * them a stranger's plan or an error. Not linking it is not the enforcement,
 * though; the API is. This just stops the UI advertising a door that is shut.
 *
 * Activity and Invoices are absent for a different reason: nothing records
 * either. See `components/account/agency-sections.tsx`.
 */

import type { AccountRole } from "./types";

export type SectionSpec = {
  id: string;
  label: string;
  count?: number;
  short?: string;
};

/** Roles that may see and change what the organization pays. */
export function canManageBilling(role: AccountRole | null): boolean {
  return role === "owner" || role === "admin";
}

export const AGENCY_SECTION_IDS = [
  "overview",
  "clients",
  "team",
  "branding",
  "billing",
] as const;

export type AgencySectionId = (typeof AGENCY_SECTION_IDS)[number];

export function agencySections(
  role: AccountRole | null,
  counts: { clients: number; team: number },
): readonly SectionSpec[] {
  const sections: SectionSpec[] = [
    { id: "overview", label: "Overview" },
    { id: "clients", label: "Clients", count: counts.clients },
    { id: "team", label: "Team", count: counts.team },
    { id: "branding", label: "Branding", short: "Soon" },
  ];
  if (canManageBilling(role)) sections.push({ id: "billing", label: "Billing" });
  return sections;
}

/**
 * Resolve the `?s=` param against the sections this caller may actually see.
 *
 * An agent who deep-links to `?s=billing` lands on the overview rather than an
 * empty panel — the same answer an unknown value gets, because from their side
 * the section does not exist.
 */
export function resolveAgencySection(
  param: string | undefined,
  role: AccountRole | null,
): AgencySectionId {
  const wanted = AGENCY_SECTION_IDS.find((id) => id === param);
  if (!wanted) return "overview";
  if (wanted === "billing" && !canManageBilling(role)) return "overview";
  return wanted;
}
