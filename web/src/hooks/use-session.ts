"use client";

/**
 * Client-side session + entitlement hooks.
 *
 * The server read is in `lib/session.ts`; this mirror exists for Client
 * Components that need `session.plan` or premium-gating outside an RSC.
 * Both paths ultimately read `/api/me` — the server via the docker network
 * and fetched cookies, the browser via same-origin `/api/me`.
 */

import { useEffect, useState } from "react";

import { fetchMe } from "@/lib/api-client";
import { getEntitlement } from "@/lib/session-user";
import type { Entitlement, SessionUser } from "@/lib/types";

export type SessionState = {
  session: SessionUser | null;
  loading: boolean;
};

export function useSession(initial: SessionUser | null = null): SessionState {
  const [session, setSession] = useState<SessionUser | null>(initial);
  const [loading, setLoading] = useState(initial === null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setSession(me);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}

export function usePremiumEntitlement(initial: SessionUser | null = null): Entitlement & {
  loading: boolean;
} {
  const { session, loading } = useSession(initial);
  // Same derivation the RSC path uses — `lib/session-user.ts` owns it, so the
  // map's premium gate and the account page's cannot drift apart.
  return { ...getEntitlement(session), loading };
}
