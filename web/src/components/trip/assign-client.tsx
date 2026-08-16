"use client";

/**
 * Filing a trip against a client, from the trip itself.
 *
 * This is the join WS-C item 3 asks for, and the trip is the right place for
 * it: the agent is looking at the thing being assigned, and the client page
 * then lists it without anybody having to go there and search.
 *
 * Only shown to a member of an agency organisation, and the picker only offers
 * that organisation's clients. The API re-checks anyway — `PATCH /api/trips`
 * verifies the caller belongs to the client's org before it will set the
 * column, which it did not do before WS-C — so this control is a convenience
 * over the boundary, never the boundary itself.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isUnauthorized, updateTrip } from "@/lib/api-client";
import type { ClientSummary } from "@/lib/types";

export type AssignClientProps = {
  tripId: string;
  /** The trip's current client, if any. */
  clientId: string | null;
  /** The caller's organisation's clients. Empty means there are none yet. */
  clients: readonly ClientSummary[];
};

const UNASSIGNED = "";

export function AssignClient({ tripId, clientId, clients }: AssignClientProps) {
  const router = useRouter();
  const [value, setValue] = useState(clientId ?? UNASSIGNED);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateTrip(tripId, { clientId: next === UNASSIGNED ? null : next });
      setSaved(true);
      // The client page reads its trips server-side; refresh so a return trip
      // there is not stale.
      router.refresh();
    } catch (err) {
      setValue(previous);
      setError(
        isUnauthorized(err)
          ? "Your session expired. Sign in again."
          : "Couldn't change the client on this trip. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <label
        htmlFor="assign-client"
        className="mb-1.5 block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle"
      >
        Client
      </label>
      {clients.length === 0 ? (
        <p className="text-[12.5px] leading-[1.5] text-text-muted">
          No client records yet. Create one under{" "}
          <Link href="/account?s=clients" className="text-accent hover:underline">
            Account → Clients
          </Link>{" "}
          and you can file this trip against it.
        </p>
      ) : (
        <>
          <select
            id="assign-client"
            value={value}
            disabled={busy}
            onChange={(e) => void change(e.target.value)}
            className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[12.5px] disabled:opacity-60"
          >
            <option value={UNASSIGNED}>Not assigned</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 font-mono text-[10.5px] text-text-subtle">
            {saved
              ? "Saved. It shows on their page now."
              : "Shows on the client's page, for anyone on your team."}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 font-mono text-[11.5px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
