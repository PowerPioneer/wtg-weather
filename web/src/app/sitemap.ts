import type { MetadataRoute } from "next";

import { routableCountries } from "@/lib/country-routes";
import { SITE_URL } from "@/lib/env";
import { MONTH_SLUGS } from "@/lib/months";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Sitemap covering the SEO surface area: static marketing pages, the twelve
 * month-first landing pages, every country, and every (country × month)
 * combination. Admin-1 regions and trip-detail pages aren't listed — they're
 * either dynamic per-user or SSR with a `revalidate` that doesn't need
 * pre-declaration.
 *
 * The legal set (`/privacy`, `/terms`, `/refunds`, `/contact`) is deliberately
 * absent: it is linked from the footer of every page, so crawlers reach it
 * regardless, and it is not content anyone should be sent to from search.
 */

/**
 * Built per request, unlike the pages it lists.
 *
 * A prerendered sitemap is generated inside `docker build`, where the API is
 * not reachable and `routableCountries()` correctly returns nothing — so the
 * image shipped a sitemap listing three marketing URLs and no countries at
 * all. The pages themselves are fine, because they render on demand against a
 * live API; only this route bakes its whole content at build time, which makes
 * it the one route that must not.
 *
 * The cost is near zero: the underlying `/v1/countries` fetch carries its own
 * one-hour cache, so a request here assembles ~3,000 strings from a cached
 * list. Crawlers ask for it a few times a day.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls: Entry[] = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/map`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // The index every country page is one click from. Unlike the month-first
    // pages below it renders with nothing published (it says so), so it is
    // not gated on `countries.length`.
    {
      url: `${SITE_URL}/countries`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const countries = await routableCountries();

  // The month-first landing pages, gated on the same condition as the country
  // pages below: each one ranks the published index, so with nothing published
  // there is nothing for them to list and they raise rather than render an
  // empty ranking. Listing a URL that errors is worse than omitting it.
  if (countries.length > 0) {
    for (const month of MONTH_SLUGS) {
      urls.push({
        url: `${SITE_URL}/best-weather-in/${month}`,
        lastModified: now,
        changeFrequency: "monthly",
        // Above an individual country-month: these are the entry points for
        // the "where should I go in April" query, and every country-month page
        // is one click below them.
        priority: 0.7,
      });
    }
  }

  // Only countries the data path can actually answer for — a sitemap full of
  // 404s is worse than a short one.
  for (const country of countries) {
    urls.push({
      url: `${SITE_URL}/${country.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
    for (const month of MONTH_SLUGS) {
      urls.push({
        url: `${SITE_URL}/${country.slug}/${month}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return urls;
}
