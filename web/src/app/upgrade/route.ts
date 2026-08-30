/**
 * `/upgrade?plan=…` — the server-side half of the checkout handoff.
 *
 * Every upgrade CTA on the site is a real anchor pointing here, with a click
 * handler that takes over once React has hydrated (see `UpgradeButton`). Two
 * things fall out of that:
 *
 *   1. The buy button works with JavaScript off. The zero-JS rule in
 *      `web/CLAUDE.md` is aimed at the SEO surface, but a pricing page whose
 *      primary action is inert without JS is a worse failure than a country
 *      page that renders plainly.
 *   2. There is somewhere to come back to after signing in. The API will not
 *      issue a checkout URL without a session — it stamps `user_id` into
 *      `custom_data`, which is how the webhook knows whose subscription to
 *      activate — so an anonymous visitor has to sign in first, and the point
 *      they were sent away from has to be recoverable.
 *
 * A route handler rather than a page because both outcomes are redirects and
 * one of them sets a cookie, neither of which an RSC page can do.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  CHECKOUT_INTENT_COOKIE,
  CHECKOUT_INTENT_MAX_AGE,
  isPaddlePlan,
  serialiseIntent,
} from "@/lib/checkout-intent";
import { INTERNAL_API_URL } from "@/lib/env";

const SESSION_COOKIE = "wtg_session";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  const organizationId = url.searchParams.get("org") ?? undefined;

  if (!isPaddlePlan(plan)) {
    return NextResponse.redirect(new URL("/pricing", request.url), 303);
  }

  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url), 303);
    response.cookies.set(
      CHECKOUT_INTENT_COOKIE,
      serialiseIntent({ plan, organizationId }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        path: "/",
        maxAge: CHECKOUT_INTENT_MAX_AGE,
      },
    );
    return response;
  }

  const checkoutUrl = await mintCheckoutUrl(session, plan, organizationId);
  if (!checkoutUrl) {
    // Back where they came from with something to read. Never a blank page and
    // never a half-built Paddle URL — `lib/paddle.ts`'s contract is that this
    // side never constructs one, and that holds on the failure path too.
    return NextResponse.redirect(
      new URL("/pricing?checkout=error", request.url),
      303,
    );
  }
  return NextResponse.redirect(checkoutUrl, 303);
}

async function mintCheckoutUrl(
  session: string,
  plan: string,
  organizationId: string | undefined,
): Promise<string | null> {
  const res = await fetch(`${INTERNAL_API_URL}/api/paddle/checkout-url`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${session}`,
    },
    body: JSON.stringify({
      plan,
      organization_id: organizationId ?? null,
    }),
  }).catch(() => null);

  if (!res || !res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { checkout_url?: unknown }
    | null;
  // `checkout_url` is the transaction's hosted link — our own `/checkout/pay`
  // with `?_ptxn=` appended. It is nullable: Paddle only returns one for
  // automatically-collected transactions, and an account with no default
  // payment link set does not get one at all.
  return typeof body?.checkout_url === "string" ? body.checkout_url : null;
}
