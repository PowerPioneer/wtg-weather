/**
 * Session and entitlement helpers.
 *
 * FastAPI owns auth (magic link + OAuth, HttpOnly session cookie). Here we
 * just read the cookie, either resolve it against the mock fixtures (dev)
 * or forward it to `/api/me` (prod, Phase 5.5 wires the real call).
 *
 * RSC-only. The client-side mirror lives in `hooks/use-session.ts`.
 */

import "server-only";
import { cookies } from "next/headers";

import { INTERNAL_API_URL, USE_MOCK_DATA } from "./env";
import { findSession } from "./mock-data";
import type { Entitlement, SessionUser } from "./types";

/** Dev-only cookie the preview UI sets to swap between free/premium/agency. */
const MOCK_COOKIE = "wtg_mock_session";
/** Real session cookie, signed by `itsdangerous` on the API side. */
const SESSION_COOKIE = "wtg_session";

export async function getSessionServer(): Promise<SessionUser | null> {
  const c = await cookies();

  if (USE_MOCK_DATA) {
    const key = c.get(MOCK_COOKIE)?.value ?? "premium";
    return findSession(key);
  }

  const session = c.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  const res = await fetch(`${INTERNAL_API_URL}/api/me`, {
    headers: { cookie: `${SESSION_COOKIE}=${session}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as SessionUser;
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

export function getEntitlement(session: SessionUser | null): Entitlement {
  if (!session) return { premium: false, agency: false };
  const agency = session.plan.startsWith("agency_");
  const premium = session.plan !== "free";
  return { premium, agency, seatCap: session.org?.seatCap };
}
