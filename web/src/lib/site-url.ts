import { SITE_URL } from "./env";

/**
 * An absolute URL on the public site, for redirects issued by route handlers.
 *
 * Never build one from `request.url`. Behind Caddy, the request a route
 * handler sees is addressed to the container's own bind address, so
 * `new URL("/account", request.url)` produces `https://0.0.0.0:3000/account` —
 * a Location header no browser can follow (ERR_ADDRESS_INVALID). `/upgrade`
 * shipped that way and was fixed in September; `/login/verify`, `/signout` and
 * `/invite/accept` kept the pattern and broke every magic-link sign-in and
 * every sign-out the moment real users arrived. `site-url.test.ts` scans the
 * route handlers so it cannot come back.
 */
export function siteUrl(path: string): URL {
  return new URL(path, SITE_URL);
}
