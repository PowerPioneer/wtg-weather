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
  if (!session) return { premium: false, agency: false, loading };
  const agency = session.plan.startsWith("agency_");
  const premium = session.plan !== "free";
  return { premium, agency, seatCap: session.org?.seatCap, loading };
}
