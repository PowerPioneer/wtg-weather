import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { getSessionServer } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Atlas Weather with a one-time email link. No passwords, no cards on file.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  email?: string | string[];
  error?: string | string[];
}>;

/**
 * Why a sign-in attempt bounced back here. Deliberately vague about *which*
 * way a token failed — invalid, already used and expired are one message,
 * because distinguishing them for the visitor distinguishes them for anyone
 * guessing tokens.
 */
const ERROR_COPY: Record<string, string> = {
  expired: "That sign-in link is no longer valid. Links last 15 minutes and work once — request a new one below.",
  missing: "That sign-in link was incomplete. Request a new one below.",
  unavailable: "We couldn't complete sign-in just then. Try requesting a new link.",
};

/**
 * `/login` — magic-link form plus Google OAuth handoff. Renders as a Server
 * Component; the form itself is a Client Component for the submit handler.
 *
 * If the caller already has a valid session cookie there's nothing to do here
 * — bounce them to the map. `getSessionServer()` honours the mock-session
 * cookie in dev.
 */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSessionServer();
  if (session) redirect("/");

  const params = await searchParams;
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;
  const defaultEmail = typeof raw === "string" ? raw : "";
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = errorKey ? ERROR_COPY[errorKey] : undefined;

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-5">
      {/*
        No "create an account" link, because there is no such flow: the magic
        link creates the user on first use (`magic_link_verify` in the API).
        The link that used to sit here pointed at `/signup`, which is not a
        route — a dead end on the one page every signed-out visitor reaches.
      */}
      <div className="text-right text-[12.5px] text-text-muted">
        New here? The same link signs you in and creates your free account.
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-border bg-[#FCFBF8] px-4 py-3 text-[13px] leading-[1.5] text-text"
        >
          {error}
        </div>
      )}
      <AuthCard
        title="Welcome back"
        subtitle="We'll send a one-time sign-in link to your email. No passwords — ever."
      >
        <MagicLinkForm defaultEmail={defaultEmail} />
      </AuthCard>
    </div>
  );
}
