/**
 * The other end of the magic link — the button on `/login/verify` posts here.
 *
 * `POST /api/auth/magic-link` mails a link to `{public_web_origin}/login/verify
 * ?token=…` — a **web** route, because Caddy sends everything but `/api/*` to
 * Next. That page only renders a "Sign in" button; this handler is what spends
 * the link, because links are single-use and mail scanners open every link in
 * a message (see `verify/page.tsx`). Scanners do not submit forms.
 *
 * A route handler so the token never reaches the browser's JS and the session
 * cookie is minted in a single server-side hop: we hand the token to the API,
 * take the `Set-Cookie` it answers with, and redirect.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { CHECKOUT_INTENT_COOKIE, parseIntent } from "@/lib/checkout-intent";
import { INTERNAL_API_URL, SITE_URL } from "@/lib/env";
import { checkoutPath } from "@/lib/paddle";
import { siteUrl } from "@/lib/site-url";

/** Where a successful sign-in lands when nothing else was asked for. */
const LANDING = "/account";

export async function POST(request: Request): Promise<Response> {
  if (isCrossSite(request)) return fail("missing");

  const form = await request.formData().catch(() => null);
  const raw = form?.get("token");
  const token = typeof raw === "string" ? raw : null;
  if (!token) return fail("missing");

  const verified = await fetch(
    `${INTERNAL_API_URL}/api/auth/verify?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).catch(() => null);

  if (!verified) return fail("unavailable");
  // The API answers 400 for a token that is invalid, already used, or past its
  // 15 minutes, and 422 for one too short to be a token at all. It does not
  // distinguish them, and neither should we: telling a visitor which one it
  // was tells an attacker the same thing.
  //
  // Anything else is the API failing, not the link — and must not say so. On
  // 2026-10-27 a full disk took Postgres down, every verify answered 500, and
  // visitors were told their minute-old link had expired.
  if (verified.status === 400 || verified.status === 422) return fail("expired");
  if (!verified.ok) return fail("unavailable");

  const setCookie = verified.headers.get("set-cookie");
  if (!setCookie) return fail("unavailable");

  // Someone who clicked Upgrade before signing in gets taken to checkout
  // rather than to their account, having been sent away mid-purchase. The
  // cookie holds a plan identifier, never a URL, so this cannot become an open
  // redirect — `lib/checkout-intent.ts` explains why that matters.
  const intent = parseIntent((await cookies()).get(CHECKOUT_INTENT_COOKIE)?.value);
  const landing = intent
    ? checkoutPath(intent.plan, intent.organizationId)
    : LANDING;

  const response = NextResponse.redirect(siteUrl(landing), 303);
  response.headers.append("set-cookie", setCookie);
  if (intent) response.cookies.delete(CHECKOUT_INTENT_COOKIE);
  return response;
}

/**
 * Login CSRF: another site must not be able to post *its* token here and sign
 * the visitor into the attacker's account. A browser names the origin of a
 * cross-site form post, and cannot be made to lie about the host it is posting
 * to — so the post is ours when the two agree.
 *
 * Compared by host, not against SITE_URL alone: SITE_URL defaults to the
 * production origin, so a dev server or an e2e stack would refuse its own form.
 * Hosts rather than origins because Caddy terminates TLS — Next sees `http`.
 * An absent or `"null"` Origin is let through: older browsers and strict
 * referrer policies withhold it, and the token itself is still the credential.
 */
function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true;
  }
  const ours = [
    new URL(SITE_URL).host,
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ];
  return !ours.includes(host);
}

function fail(reason: string): Response {
  const url = siteUrl("/login");
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url, 303);
}
