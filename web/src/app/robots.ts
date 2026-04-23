import type { MetadataRoute } from "next";

import { APP_ENV, SITE_URL } from "@/lib/env";

/**
 * `robots.txt` generator. Staging (`v2.` subdomain, APP_ENV=staging) is
 * deliberately blocked so SEO duplicates don't leak before cutover. Prod
 * allows crawling and links to the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const allowIndexing = APP_ENV === "prod";
  return {
    rules: allowIndexing
      ? [
          {
            userAgent: "*",
            allow: "/",
            disallow: ["/api/", "/debug/", "/account/", "/onboarding/", "/login/"],
          },
        ]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
