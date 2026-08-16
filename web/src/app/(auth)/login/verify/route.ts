/**
 * The other end of the magic link.
 *
 * `POST /api/auth/magic-link` mails a link to `{public_web_origin}/login/verify
 * ?token=…` — a **web** route, because Caddy sends everything but `/api/*` to
 * Next. That route did not exist, so every magic link ever sent landed on a
 * 404 and nobody could finish signing in. The API half was written and tested;
 * the two halves had simply never been joined.
 *
 * This is a route handler rather than a page so the token never reaches the
 * browser's JS and the session cookie is minted in a single server-side hop:
 * we hand the token to the API, take the `Set-Cookie` it answers with, and
 * redirect. A page would have to expose the token to a client component to do
 * the same call from the browser.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { CHECKOUT_INTENT_COOKIE, parseIntent } from "@/lib/checkout-intent";
import { INTERNAL_API_URL } from "@/lib/env";
import { checkoutPath } from "@/lib/paddle";

/** Where a successful sign-in lands when nothing else was asked for. */
const LANDING = "/account";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return fail(request, "missing");

  const verified = await fetch(
    `${INTERNAL_API_URL}/api/auth/verify?token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  ).catch(() => null);

  if (!verified) return fail(request, "unavailable");
  // The API answers 400 for a token that is invalid, already used, or past its
  // 15 minutes. It does not distinguish them, and neither should we: telling a
  // visitor which one it was tells an attacker the same thing.
  if (!verified.ok) return fail(request, "expired");

  const setCookie = verified.headers.get("set-cookie");
  if (!setCookie) return fail(request, "unavailable");

  // Someone who clicked Upgrade before signing in gets taken to checkout
  // rather than to their account, having been sent away mid-purchase. The
  // cookie holds a plan identifier, never a URL, so this cannot become an open
  // redirect — `lib/checkout-intent.ts` explains why that matters.
  const intent = parseIntent((await cookies()).get(CHECKOUT_INTENT_COOKIE)?.value);
  const landing = intent
    ? checkoutPath(intent.plan, intent.organizationId)
    : LANDING;

  const response = NextResponse.redirect(new URL(landing, request.url), 303);
  response.headers.append("set-cookie", setCookie);
  if (intent) response.cookies.delete(CHECKOUT_INTENT_COOKIE);
  return response;
}

function fail(request: Request, reason: string): Response {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url, 303);
}
