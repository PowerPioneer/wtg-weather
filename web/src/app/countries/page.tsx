import type { Metadata } from "next";
import Link from "next/link";

import { PageFooter, PageHeader } from "@/components/layout";
import type { CountryRef } from "@/lib/countries";
import { routableCountries } from "@/lib/country-routes";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  // The root layout templates this as "%s · Atlas Weather", so the suffix
  // is not repeated here.
  title: "Every country",
  description:
    "Ten years of ERA5 climate data and six-government travel advisories, for every country the pipeline has a complete series for. Browse by region, month by month.",
  alternates: { canonical: canonical("/countries") },
};

// Monthly, matching `/[country]`. The set only changes when the pipeline
// publishes a new bundle, which is a yearly climate rebuild.
export const revalidate = 2592000;

/**
 * The index the "Countries" nav item has always claimed to point at.
 *
 * It pointed at `/`, which lists eight *featured* countries — so the ~195
 * country pages had no internal link to them at all beyond that strip and the
 * sitemap. That is a navigation bug and an SEO one: a page a crawler reaches
 * only through a sitemap is a page competing without any internal link equity.
 *
 * Built from `routableCountries()` rather than the registry, for the reason
 * `country-routes.ts` gives at length: the registry is every ISO-2 code a
 * *polygon* can carry, which is a larger set than the countries with a
 * complete climate series. Linking a registry entry the API cannot answer for
 * would put a 404 in the site's own navigation.
 *
 * It degrades the same way the route tree does. `routableCountries()` returns
 * `[]` when the API is unreachable, so a `pnpm build` with no stack up renders
 * the empty state rather than failing — and because this page revalidates, the
 * first request after the API comes back fills it in.
 */
export default async function CountriesPage() {
  const countries = await routableCountries();
  const regions = groupByRegion(countries);

  return (
    <>
      <PageHeader activePath="/countries" />
      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12 md:py-16">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Every country · 10-year ERA5
            </div>
            <h1 className="mt-1 font-display text-[40px] font-medium leading-[1.1] tracking-[-0.01em] text-text md:text-[56px]">
              Browse the whole world.
            </h1>
            <p className="mt-4 max-w-[640px] text-[17px] leading-[1.6] text-text-muted">
              {countries.length > 0 ? (
                <>
                  {countries.length} countries with a complete climate series,
                  each with a month-by-month page and its own travel-advisory
                  panel. Pick one, or{" "}
                  <Link href="/map" className="text-text-link underline underline-offset-2">
                    start from the map
                  </Link>
                  .
                </>
              ) : (
                <>
                  The country index is being rebuilt. The{" "}
                  <Link href="/map" className="text-text-link underline underline-offset-2">
                    map
                  </Link>{" "}
                  is unaffected — it reads the tiles, not this list.
                </>
              )}
            </p>
          </div>
        </section>

        {regions.map(([region, entries]) => (
          <section key={region} className="border-b border-border bg-background">
            <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-12">
              <h2 className="mb-4 font-display text-[24px] font-medium leading-[1.2] text-text">
                {region}
                <span className="ml-3 font-mono text-[12px] font-normal text-text-muted">
                  {entries.length}
                </span>
              </h2>
              {/*
                A plain list of links, three or four to a row. No cards and no
                scores: a score needs a month to mean anything, and this page
                does not have one — the month-by-month answer is one click
                away on each country's own page.
              */}
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {entries.map((country) => (
                  <li key={country.slug}>
                    <Link
                      href={`/${country.slug}`}
                      className="block rounded py-1.5 text-[15px] text-text hover:text-text-link hover:underline underline-offset-2"
                    >
                      {country.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </main>
      <PageFooter />
    </>
  );
}

/**
 * Regions in a fixed order, countries A–Z inside each.
 *
 * `localeCompare` rather than `<` because the published names carry accents
 * (Åland, Côte d'Ivoire, Curaçao) and a codepoint sort files those after Z.
 */
function groupByRegion(
  countries: readonly CountryRef[],
): [string, CountryRef[]][] {
  const byRegion = new Map<string, CountryRef[]>();
  for (const country of countries) {
    const region = country.region || "Other";
    const bucket = byRegion.get(region);
    if (bucket) bucket.push(country);
    else byRegion.set(region, [country]);
  }
  for (const bucket of byRegion.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...byRegion.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
