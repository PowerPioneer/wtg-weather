import type { MetadataRoute } from "next";

import { routableCountries } from "@/lib/country-routes";
import { SITE_URL } from "@/lib/env";
import { MONTH_SLUGS } from "@/lib/months";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Sitemap covering the SEO surface area: static marketing pages, every
 * country, and every (country × month) combination. Admin-1 regions and
 * trip-detail pages aren't listed — they're either dynamic per-user or
 * SSR with a `revalidate` that doesn't need pre-declaration.
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
  ];

  // Only countries the data path can actually answer for — a sitemap full of
  // 404s is worse than a short one.
  for (const country of await routableCountries()) {
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
