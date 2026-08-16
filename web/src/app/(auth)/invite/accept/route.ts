/**
 * `POST /invite/accept` — spend an invitation token.
 *
 * A route handler rather than a client call, for the same reasons
 * `/login/verify` is one: the token never reaches the browser's JavaScript,
 * the session cookie is minted in a single server-side hop, and the whole
 * thing works with JS off because the page behind it is a plain form post.
 *
 * Security note: this is an authentication path. The API issues a session for
 * the address the invitation was mailed to — not for whoever is signed in when
 * the link is opened — so this handler must not merge the answer with an
 * existing session or interpret the token itself. It forwards the token, takes
 * the `Set-Cookie` the API answers with, and redirects. Every refusal lands
 * back on `/invite` with a reason and *no* cookie touched.
 */

import { NextResponse } from "next/server";

import { INTERNAL_API_URL } from "@/lib/env";

/** Where a newly-joined agent lands: their organisation's account surface. */
const LANDING = "/account";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string" || token.length === 0) {
    return refuse(request, null, "unknown");
  }

  const accepted = await fetch(`${INTERNAL_API_URL}/api/invites/accept`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  }).catch(() => null);

  if (!accepted) return refuse(request, token, "unavailable");
  if (!accepted.ok) return refuse(request, token, await reasonFor(accepted));

  const setCookie = accepted.headers.get("set-cookie");
  // No cookie means no session, and sending them onward would land them at a
  // sign-in wall having just spent their one-time link.
  if (!setCookie) return refuse(request, token, "unavailable");

  const response = NextResponse.redirect(new URL(LANDING, request.url), 303);
  response.headers.append("set-cookie", setCookie);
  return response;
}

/**
 * The API's refusals, mapped to what the recipient can act on. 409 covers both
 * "already accepted" and "the organisation filled up since"; those read very
 * differently to the person holding the link — one is "you're already in", the
 * other is "ask them for a seat" — so the detail string decides between them.
 */
async function reasonFor(res: Response): Promise<string> {
  if (res.status === 400) return "expired";
  if (res.status === 404) return "unknown";
  if (res.status !== 409) return "unavailable";
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  return body?.detail === "seat cap reached" ? "full" : "used";
}

function refuse(request: Request, token: string | null, reason: string): Response {
  const url = new URL("/invite", request.url);
  if (token) url.searchParams.set("token", token);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url, 303);
}
