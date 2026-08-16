/**
 * Server-side session read.
 *
 * FastAPI owns auth (magic link + OAuth, HttpOnly session cookie). Here we
 * read the cookie and either resolve it against the mock fixtures (dev) or
 * forward it to `/api/me`.
 *
 * RSC-only — the client-side mirror is `hooks/use-session.ts`. Both parse the
 * response with `parseSessionUser` and gate on `getEntitlement`, which live in
 * `lib/session-user.ts` precisely so there is one of each. `getEntitlement` is
 * re-exported here so RSC callers keep importing the session module.
 */

import "server-only";
import { cookies } from "next/headers";

import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import { findSession } from "./mock-data";
import { parseSessionUser } from "./session-user";
import type { SessionUser } from "./types";

export {
  displayName,
  firstName,
  getEntitlement,
  isAgencyWorkspace,
  monthYear,
  planLabel,
} from "./session-user";

/** Dev-only cookie the preview UI sets to swap between free/premium/agency. */
const MOCK_COOKIE = "wtg_mock_session";
/** Real session cookie, signed by `itsdangerous` on the API side. */
const SESSION_COOKIE = "wtg_session";

export async function getSessionServer(): Promise<SessionUser | null> {
  const c = await cookies();

  if (USE_MOCK_DATA) {
    // No cookie means nobody is signed in, and `getEntitlement(null)` resolves
    // that to the free tier. This used to default to the "premium" persona, so
    // every anonymous visitor of a mock-backed build was served the paid tier —
    // including in production, where `USE_MOCK_DATA` was on by default. Setting
    // the cookie is how the preview UI switches personas deliberately.
    const key = c.get(MOCK_COOKIE)?.value;
    return key ? findSession(key) : null;
  }

  const session = c.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await fetch(`${INTERNAL_API_URL}/api/me`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return parseSessionUser(await res.json());
}

export type ServerOnboardingState = {
  kind: "consumer" | "agency" | null;
  step: number;
  completed: boolean;
  data: Record<string, unknown>;
};

/**
 * Server-side fetch of the onboarding record. Returns null when the user is
 * signed out or the API rejects the session — callers should treat that as
 * "redirect to /login".
 */
export async function getOnboardingServer(): Promise<ServerOnboardingState | null> {
  const c = await cookies();

  if (USE_MOCK_DATA) {
    return { kind: null, step: 0, completed: false, data: {} };
  }

  const session = c.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await fetch(`${INTERNAL_API_URL}/api/onboarding`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as ServerOnboardingState;
}
