import Link from "next/link";
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

type SearchParams = Promise<{ email?: string | string[] }>;

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

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-5">
      <div className="text-right text-[12.5px] text-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="ml-1 font-medium text-text-link hover:underline">
          Create free
        </Link>
      </div>
      <AuthCard
        title="Welcome back"
        subtitle="We'll send a one-time sign-in link to your email. No passwords — ever."
      >
        <MagicLinkForm defaultEmail={defaultEmail} />
      </AuthCard>
    </div>
  );
}
