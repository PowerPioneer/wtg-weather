"use client";

/**
 * The client note timeline, with adding and deleting live.
 *
 * Notes are attributed and dated by the API — the author is whoever was signed
 * in when the note was written, not a name typed into a field — so nothing
 * here can put words in a colleague's mouth. A note whose author has since
 * left the organisation keeps the note and loses the name, which is why
 * `author` is nullable.
 *
 * The fixture version of this rail carried a `kind` chip (call / email /
 * meeting / internal) that nothing recorded and nothing could set. It is gone
 * rather than reproduced as a picker with no meaning behind it.
 */

import { useState } from "react";

import { addClientNote, deleteClientNote, isUnauthorized } from "@/lib/api-client";
import type { ClientNote } from "@/lib/types";

export type ClientNotesProps = {
  orgId: string;
  clientId: string;
  initial: readonly ClientNote[];
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export function ClientNotes({ orgId, clientId, initial }: ClientNotesProps) {
  const [notes, setNotes] = useState<readonly ClientNote[]>(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fail(err: unknown, fallback: string) {
    setError(isUnauthorized(err) ? "Your session expired. Sign in again." : fallback);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy("add");
    setError(null);
    try {
      const created = await addClientNote(orgId, clientId, text);
      setNotes((rows) => [
        {
          id: created.id,
          author: created.author,
          when: created.createdAt,
          body: created.body,
        },
        ...rows,
      ]);
      setBody("");
    } catch (err) {
      fail(err, "Couldn't save that note. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(note: ClientNote) {
    if (!window.confirm("Delete this note?")) return;
    setBusy(note.id);
    setError(null);
    try {
      await deleteClientNote(orgId, clientId, note.id);
      setNotes((rows) => rows.filter((r) => r.id !== note.id));
    } catch (err) {
      // 403 here means somebody else wrote it — an owner may delete anyone's,
      // an agent only their own.
      fail(err, "That note isn't yours to delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="mb-4">
        <label htmlFor="client-note" className="sr-only">
          Add a note about this client
        </label>
        <textarea
          id="client-note"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you agree? Dates, constraints, who you spoke to."
          className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[12.5px] leading-[1.5]"
        />
        <button
          type="submit"
          disabled={busy === "add" || body.trim().length === 0}
          className="mt-2 rounded-sm bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy === "add" ? "Saving…" : "Add note"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mb-3 font-mono text-[11.5px] text-destructive">
          {error}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-[#FCFBF8] px-4 py-5 text-[12.5px] text-text-muted">
          No notes yet. Anything your team writes here is shared across the
          organisation.
        </p>
      ) : (
        <ul className="relative list-none pl-5">
          <li
            className="absolute bottom-1 left-1.5 top-1 w-px bg-border"
            aria-hidden="true"
          />
          {notes.map((note) => (
            <li key={note.id} className="relative mb-4">
              <span
                className="absolute left-[-14px] top-[10px] h-2.5 w-2.5 rounded-full border-2 border-accent bg-white"
                aria-hidden="true"
              />
              <div className="rounded-md border border-border bg-surface px-4 py-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="text-[12px] font-semibold text-text">
                    {note.author ?? "Former team member"}
                  </span>
                  <span className="font-mono text-[10.5px] text-text-subtle">
                    {formatWhen(note.when)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(note)}
                    disabled={busy === note.id}
                    className="ml-auto rounded-sm border border-border px-2 py-0.5 font-mono text-[10.5px] text-text-muted hover:bg-surface-2 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-[12.5px] leading-[1.6] text-text">
                  {note.body}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
