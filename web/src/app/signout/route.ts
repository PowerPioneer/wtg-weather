/**
 * Sign out.
 *
 * The account sidebar linked to `/signout`, which was not a route — signing
 * out 404'd. It is a POST rather than a link because it changes state, and a
 * GET would let any page log the user out with an `<img src>`.
 *
 * The cookie is cleared by asking the API to clear it and forwarding its
 * `Set-Cookie` verbatim, rather than by expiring a cookie of our own: the
 * attributes (`HttpOnly`, `Secure`, `SameSite`, path, domain) have to match
 * the ones `issue_session` set or the browser keeps the original, and the API
 * is the only place that knows them.
 *
 * Zero-JS: the sidebar posts a plain form and the 303 lands the browser on the
 * home page.
 */

import { NextResponse } from "next/server";

import { INTERNAL_API_URL } from "@/lib/env";

const SESSION_COOKIE = "wtg_session";

export async function POST(request: Request): Promise<Response> {
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));

  const home = new URL("/", request.url);
  // 303 so the browser follows with GET rather than re-POSTing.
  const response = NextResponse.redirect(home, 303);

  if (!session) return response;

  const cleared = await fetch(`${INTERNAL_API_URL}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: session },
    cache: "no-store",
  }).catch(() => null);

  const setCookie = cleared?.headers.get("set-cookie");
  if (setCookie) {
    response.headers.append("set-cookie", setCookie);
  } else {
    // The API was unreachable, or answered without clearing. Expiring our copy
    // is worse than nothing only if it silently fails, and it does not: the
    // session stays valid server-side but the browser stops sending it.
    response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  }
  return response;
}
