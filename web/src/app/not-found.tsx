import { NotFoundView, suggestedCountries } from "@/components/errors";

/**
 * The site's 404 — and, as it turns out, the *only* one.
 *
 * A `not-found.tsx` inside `[country]/` is never reached on Next 16.2.4.
 * Verified against both `next dev` and `next start`: every `notFound()` thrown
 * by a country, region or month page renders this file, not the segment's,
 * with or without a `layout.tsx` in that segment to host the boundary. The
 * segment-scoped version was written first and deleted once measured, rather
 * than left in the tree looking like it did something.
 *
 * So the copy here serves both audiences at once, and the second is the
 * larger: `dynamicParams` is on everywhere, so any URL shaped like a country,
 * a region or a month reaches a page that then decides the slug is unknown.
 * Naming the three lookups that can miss is more use to that visitor than
 * "page not found".
 *
 * Async, and therefore fetching: the suggestions come from the published index
 * so that a page about a link that did not work does not offer more links that
 * do not work. `suggestedCountries` reads the index alone and degrades to an
 * empty list, so this renders with or without an API.
 *
 * ── How much of this is zero-JS, measured ────────────────────────────────
 *
 * Against `next build && next start`, two different things happen and only
 * one of them is what the rule wants:
 *
 *   - a genuinely unmatched path (`/a/b/c/d`) is server-rendered — the `<h1>`
 *     and the suggestion list are in the initial HTML, scripting off;
 *   - a `notFound()` thrown by a page that matched (`/not-a-real-country`
 *     hitting `/[country]`, an unknown month hitting `/best-weather-in/
 *     [month]`) returns a document whose body holds only scripts. The 404 is
 *     in the RSC flight payload and is rendered on the client.
 *
 * That second case is the common one here, because `dynamicParams` is on
 * everywhere. It is framework behaviour on Next 16.2.4, not something this
 * file controls: making the component synchronous changes nothing, which was
 * checked before concluding it. Search crawlers execute JavaScript and see
 * the right thing, and the status code — the part that governs indexing — is
 * a correct 404 either way; a reader with scripting off gets a blank page.
 *
 * Fixing it properly means not reaching `notFound()` at all: validating the
 * slug earlier (middleware, or a static route list) so the 404 comes from a
 * path Next server-renders. Flagged for the owner rather than done here.
 */
export default async function NotFound() {
  const suggestions = await suggestedCountries();
  return (
    <NotFoundView
      heading="We don't have a page for that"
      message="Nothing on the site matches that address. If you were after a country, a region or a month: country pages exist for the countries the pipeline has a complete ten-year series for, regions for the admin-1 areas inside them, and months for the twelve English month names — a mismatch in any of the three lands here. Otherwise the link has moved, or never existed."
      suggestions={suggestions}
    />
  );
}
