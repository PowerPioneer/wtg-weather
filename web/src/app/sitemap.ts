import type { MetadataRoute } from "next";

import { COUNTRIES } from "@/lib/countries";
import { SITE_URL } from "@/lib/env";
import { MONTH_SLUGS } from "@/lib/months";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Sitemap covering the SEO surface area: static marketing pages, every
 * country, and every (country × month) combination. Admin-1 regions and
 * trip-detail pages aren't listed — they're either dynamic per-user or
 * SSR with a `revalidate` that doesn't need pre-declaration.
 */
export default function sitemap(): MetadataRoute.Sitemap {
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

  for (const country of COUNTRIES) {
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
