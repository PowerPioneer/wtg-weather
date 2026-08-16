"use client";

/**
 * The clients table, with create and delete live.
 *
 * Rows come from the server render so the list is readable before hydration;
 * the form and the delete buttons are what JS adds.
 *
 * The columns are the ones a client record actually has. The fixture version
 * printed country, primary agent, "last active" and a tag per row — four
 * columns of invention on a table an agency would use to find a real person.
 * A client's trips are on its own page, where the trips themselves are.
 */

import Link from "next/link";
import { useState } from "react";

import {
  createClient,
  deleteClient,
  isUnauthorized,
  type ClientRecordSummary,
} from "@/lib/api-client";
import type { ClientSummary } from "@/lib/types";

import { EmptyState } from "./section-head";

export type AgencyClientsPanelProps = {
  orgId: string;
  initial: readonly ClientSummary[];
};

function toSummary(record: ClientRecordSummary): ClientSummary {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    trips: record.trips,
    createdAt: record.createdAt,
  };
}

export function AgencyClientsPanel({ orgId, initial }: AgencyClientsPanelProps) {
  const [clients, setClients] = useState<readonly ClientSummary[]>(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fail(err: unknown, fallback: string) {
    setError(isUnauthorized(err) ? "Your session expired. Sign in again." : fallback);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy("create");
    setError(null);
    try {
      const created = await createClient(orgId, { name: trimmed, email: email.trim() });
      setClients((rows) => [...rows, toSummary(created)]);
      setName("");
      setEmail("");
      setOpen(false);
    } catch (err) {
      fail(err, "Couldn't create that client. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(client: ClientSummary) {
    const warning =
      client.trips > 0
        ? `Delete ${client.name}? Their ${client.trips} assigned trip${client.trips === 1 ? "" : "s"} will stay, unassigned.`
        : `Delete ${client.name}?`;
    if (!window.confirm(warning)) return;
    setBusy(client.id);
    setError(null);
    try {
      await deleteClient(orgId, client.id);
      setClients((rows) => rows.filter((r) => r.id !== client.id));
    } catch (err) {
      fail(err, "Couldn't delete that client. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="mb-4">
        {open ? (
          <form
            onSubmit={submit}
            className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-4"
          >
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="client-name"
                className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle"
              >
                Client name
              </label>
              <input
                id="client-name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Westfield, M. &amp; A."
                className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[12.5px]"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="client-email"
                className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-subtle"
              >
                Email <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="them@example.com"
                className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[12.5px]"
              />
            </div>
            <button
              type="submit"
              disabled={busy === "create"}
              className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy === "create" ? "Saving…" : "Add client"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm border border-border bg-white px-3 py-2 text-[12.5px] text-text hover:bg-surface-2"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New client
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 font-mono text-[11.5px] text-destructive">
          {error}
        </p>
      )}

      {clients.length === 0 ? (
        <EmptyState
          title="No client records yet"
          body="A client is the person you're planning for. Create one, then file the trips you build against it — the notes and the assigned trips live together on their page."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse overflow-hidden rounded-md border border-border bg-surface text-left">
            <caption className="sr-only">Clients in this organisation</caption>
            <thead>
              <tr className="border-b border-border bg-[#FCFBF8] font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-subtle">
                <th scope="col" className="px-4 py-2 font-medium">
                  Client
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Email
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Trips
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border text-[12.5px] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/account/clients/${c.id}`}
                      className="font-display text-[16px] font-medium text-text hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-text-muted">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-text">{c.trips}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      disabled={busy === c.id}
                      aria-label={`Delete ${c.name}`}
                      className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:bg-surface-2 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
