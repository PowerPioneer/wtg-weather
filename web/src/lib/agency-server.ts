/**
 * The agency surfaces' data, read server-side.
 *
 * These are still fixture-backed — putting them on the API is WS-C, which owns
 * org lifecycle, seats, invites and clients CRUD. What this module does *now*
 * is make the fixtures opt-in, which they were not.
 *
 * `/account`'s agency branch called `findAgencyAccount(org.id)` and
 * `/account/clients/[id]` called `findClientRecord(id)` directly, with no
 * `WTG_USE_MOCK_DATA` gate. The account branch was harmless by luck — no real
 * org id is `org_cordillera`, so it fell through to the empty account — but the
 * client page was not: `findClientRecord` is keyed by the *URL*, not by the
 * caller's org, so any agency-entitled user in production could open
 * `/account/clients/cli_westfield_8421` and read a fabricated client's name,
 * email, phone number and advisor notes. That is the same defect the fixture
 * trip had (`mock-data.ts`, "Trip fixtures — deliberately gone"), one surface
 * further along.
 *
 * With the flag off there is now no agency fixture reachable at all: the
 * dashboard renders its empty states and the client page 404s. Both readers are
 * async so WS-C can replace the bodies with `/api/orgs/*` calls without
 * touching either page.
 */

import "server-only";

import { USE_MOCK_DATA } from "./env";
import {
  EMPTY_AGENCY_ACCOUNT,
  findAgencyAccount,
  findClientRecord,
} from "./mock-data";
import type { AgencyAccount, ClientRecord } from "./types";

/**
 * The org's dashboard data — team, clients, activity, invoices.
 *
 * Never null: an agency user with no data is an empty dashboard, not an error.
 * Under the flag an unknown org id is empty for the same reason.
 */
export async function getAgencyAccount(orgId: string): Promise<AgencyAccount> {
  if (!USE_MOCK_DATA) return EMPTY_AGENCY_ACCOUNT;
  return findAgencyAccount(orgId) ?? EMPTY_AGENCY_ACCOUNT;
}

/**
 * One client record by id. Null means "not found", which the page turns into a
 * 404 — and with the flag off that is every id, because no real client records
 * exist yet.
 *
 * Note this takes no org: the fixture lookup never scoped by one. WS-C must
 * scope the real read to the caller's org, or the id becomes the grant.
 */
export async function getClientRecord(id: string): Promise<ClientRecord | null> {
  if (!USE_MOCK_DATA) return null;
  return findClientRecord(id);
}
