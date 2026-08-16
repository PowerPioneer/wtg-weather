import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { INTERNAL_API_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Join an organisation",
  robots: { index: false, follow: false },
};

/** Per-token, and it changes the moment the token is spent. */
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string | string[]; error?: string | string[] }>;

type Preview = {
  organizationName: string;
  email: string;
  role: string;
};

const ROLE_COPY: Record<string, string> = {
  owner: "an owner",
  admin: "an admin",
  agent: "an agent",
  member: "a member",
};

/**
 * Why an invitation could not be opened.
 *
 * Unlike `/login`, these *are* distinguished — and deliberately so. There the
 * vagueness protects against token guessing, because the visitor and the
 * attacker are the same shape. Here the recipient was mailed the link and the
 * useful answers differ: an expired invitation needs a fresh one from the
 * agency, a spent one means somebody already joined, and a link that does not
 * resolve at all gets the same nothing-to-see answer a guess would.
 */
const ERROR_COPY: Record<string, string> = {
  expired:
    "This invitation has expired. Ask whoever invited you to send a new one — links last seven days.",
  used: "This invitation has already been used. If that was you, sign in instead.",
  full: "This organisation has run out of seats since the invitation was sent. Ask them to free one up, or to move to a bigger plan.",
  unknown:
    "This invitation link isn't valid. Check you copied the whole link from the email, or ask for a new one.",
  unavailable: "We couldn't check that invitation just then. Try the link again.",
};

function one(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Look the invitation up **server-side**, without a session.
 *
 * `/api/invites/preview` answers only what the recipient already knows from
 * the email that carried the token — which organisation, which address, which
 * role — so nothing here can be used to enumerate anything. The token stays on
 * the server for the render and travels back only inside the form post.
 */
async function preview(token: string): Promise<Preview | { error: string }> {
  const res = await fetch(
    `${INTERNAL_API_URL}/api/invites/preview?token=${encodeURIComponent(token)}`,
    { cache: "no-store", headers: { accept: "application/json" } },
  ).catch(() => null);

  if (!res) return { error: "unavailable" };
  if (res.status === 409) return { error: "used" };
  if (res.status === 400) return { error: "expired" };
  if (!res.ok) return { error: "unknown" };

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return { error: "unavailable" };
  return {
    organizationName: String(raw.organization_name ?? ""),
    email: String(raw.email ?? ""),
    role: String(raw.role ?? "member"),
  };
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = one(params.token);
  const failedAlready = one(params.error);

  if (!token) return <Refused reason="unknown" />;

  const result = failedAlready
    ? { error: failedAlready }
    : await preview(token);

  if ("error" in result) return <Refused reason={result.error} />;

  return (
    <AuthCard
      title={`Join ${result.organizationName}`}
      subtitle={
        <>
          You&rsquo;ve been invited as {ROLE_COPY[result.role] ?? "a member"}, at{" "}
          <strong className="font-semibold text-text">{result.email}</strong>.
        </>
      }
    >
      {/*
        A plain form post, so accepting works with JavaScript off. The route
        handler behind it does the whole exchange server-side — the token goes
        to the API and the session cookie comes back — which also keeps the
        token out of the browser's JS entirely, the same reason
        `/login/verify` is a route handler.
      */}
      <form method="post" action="/invite/accept">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2.5 text-[13.5px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          Accept and sign in
        </button>
      </form>
      <p className="mt-4 text-[12px] leading-[1.55] text-text-muted">
        Accepting signs you in as {result.email} and takes the seat this
        invitation holds. The link works once.
      </p>
    </AuthCard>
  );
}

function Refused({ reason }: { reason: string }) {
  return (
    <AuthCard
      title="This invitation can't be opened"
      subtitle={ERROR_COPY[reason] ?? ERROR_COPY.unknown}
    >
      <Link
        href="/login"
        className="inline-block w-full rounded-md border border-border bg-white px-4 py-2.5 text-center text-[13.5px] font-medium text-text hover:bg-surface-2"
      >
        Sign in instead
      </Link>
    </AuthCard>
  );
}
