import { NotFoundView, suggestedCountries } from "@/components/errors";

/**
 * The site-wide 404.
 *
 * Async, and therefore fetching: the suggestions come from the published index
 * so that a page about a link that did not work does not offer more links that
 * do not work. `suggestedCountries` reads the index alone and degrades to an
 * empty list, so this renders with or without an API.
 */
export default async function NotFound() {
  const suggestions = await suggestedCountries();
  return (
    <NotFoundView
      heading="We don't have a page for that"
      message="The address you followed doesn't match anything on the site. It may have moved, or it may never have existed — the climate pages are generated from the countries the pipeline has a complete series for, and that set changes when the data is rebuilt."
      suggestions={suggestions}
    />
  );
}
