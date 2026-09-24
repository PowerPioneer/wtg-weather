import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CountrySearchForm, PageFooter, PageHeader } from "@/components/layout";
import { routableCountries } from "@/lib/country-routes";
import { directHit, searchCountries } from "@/lib/country-search";

export const metadata: Metadata = {
  title: "Search",
  // A results page per query string is thin, near-duplicate content.
  robots: { index: false, follow: true },
};

/**
 * Where the header's country search lands. A server route, so it answers
 * with JS disabled: the header form is a plain GET to `/search?q=`.
 *
 * Matches against `routableCountries()`, never the registry — a registry
 * entry with no complete climate series has no page, and a search result that
 * 404s is worse than none. An unambiguous query skips the list and redirects
 * straight to the country.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const matches = query ? searchCountries(query, await routableCountries()) : [];
  const hit = directHit(query, matches);
  if (hit) redirect(`/${hit.slug}`);

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <h1 className="font-display text-[32px] font-medium leading-[1.15] tracking-[-0.01em] text-text md:text-[40px]">
              {query ? <>Countries matching “{query}”</> : "Find a country"}
            </h1>
            <div className="mt-6 max-w-[420px]">
              <CountrySearchForm defaultValue={query} autoFocus />
            </div>
          </div>
        </section>

        <section className="bg-background">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
            {matches.length > 0 ? (
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
                {matches.map((country) => (
                  <li key={country.slug}>
                    <Link
                      href={`/${country.slug}`}
                      className="block rounded py-1.5 text-[15px] text-text underline-offset-2 hover:text-text-link hover:underline"
                    >
                      {country.name}
                      <span className="ml-2 text-[13px] text-text-muted">
                        {country.region}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] leading-[1.6] text-text-muted">
                {query.length >= 2
                  ? "No country with a climate page matches that. "
                  : "Type at least two letters of a country’s name. "}
                Or browse{" "}
                <Link href="/countries" className="text-text-link underline underline-offset-2">
                  every country
                </Link>{" "}
                or{" "}
                <Link href="/map" className="text-text-link underline underline-offset-2">
                  the map
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </main>
      <PageFooter />
    </>
  );
}
