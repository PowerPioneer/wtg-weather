import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Finish signing in",
  robots: { index: false, follow: false },
  // The token is in this page's URL. `same-origin` keeps it out of the Referer
  // of every third-party request the page makes, while still letting the form
  // below send a real `Origin` — `no-referrer` would turn that into "null".
  referrer: "same-origin",
};

type SearchParams = Promise<{ token?: string | string[] }>;

/**
 * Where the magic link in the email lands: one button, which spends the link.
 *
 * It used to spend it on arrival. That was harmless while a link could be used
 * any number of times, and stopped being harmless when links became single-use
 * (`api/routers/auth.py`): corporate mail scanners — Defender Safe Links,
 * Proofpoint, Mimecast — open every link in an incoming message before the
 * recipient sees it, so a GET that spent the link signed the *scanner* in and
 * left the person with "that link is no longer valid". Scanners fetch links;
 * they do not submit forms. So the GET only renders this page, and the POST
 * behind the button (`/login/confirm`) is what signs in.
 *
 * Zero-JS: a plain form with the token in a hidden field, the same server-side
 * hop as before once it is pressed.
 */
export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  if (!token) redirect("/login?error=missing");

  return (
    <AuthCard
      title="Finish signing in"
      subtitle="Press the button to sign in on this device. The link works once."
    >
      <form action="/login/confirm" method="post">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" size="lg" fullWidth iconAfter={<span aria-hidden>→</span>}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
