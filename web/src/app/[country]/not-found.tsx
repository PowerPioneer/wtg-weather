import { NotFoundView, suggestedCountries } from "@/components/errors";

/**
 * 404 for the country segment: `/[country]`, `/[country]/[slug]` and
 * `/[country]/[slug]/[month]` all land here, because `notFound()` is caught by
 * the nearest boundary above the page that threw.
 *
 * Worth its own copy rather than falling through to the site-wide one. Every
 * URL that reaches this boundary was shaped like a country, a region or a
 * month — someone typed a real place name we have no series for, or followed a
 * link from before a data rebuild. Saying which of those happened is more use
 * than "page not found", and the suggestions are the obvious next click.
 */
export default async function CountryNotFound() {
  const suggestions = await suggestedCountries();
  return (
    <NotFoundView
      heading="No climate page for that place"
      message="That country, region or month isn't one we publish a page for. Country pages are built from the countries the pipeline has a complete ten-year series for, regions from the admin-1 boundaries inside them, and months from the twelve English month names — a mismatch in any of the three lands here."
      suggestions={suggestions}
      suggestionsLabel="Countries we do have"
    />
  );
}
