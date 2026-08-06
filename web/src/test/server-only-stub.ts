/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * `server-only` exists to make a build fail when an RSC-only module is pulled
 * into a client bundle. Vitest is neither, and the real package throws on
 * import outside a React Server Component, so `lib/session.ts` could not be
 * unit-tested at all without this. Aliased in `vitest.config.ts`.
 */

export {};
