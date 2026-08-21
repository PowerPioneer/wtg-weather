/**
 * SEO helpers for SSR pages. Every country/month page emits canonical + OG +
 * `TouristTrip` JSON-LD; these helpers keep the wording consistent so we
 * don't drift between `app/[country]/page.tsx` and `app/[country]/[month]/page.tsx`.
 *
 * Titles stay under ~60 chars to avoid search snippet truncation.
 */

import type { Metadata } from "next";
import { SITE_URL } from "./env";
import { regionHref } from "./regions";
import type { CountryData, MonthDetail, RegionRow } from "./types";

export function canonical(path: string): string {
  const slash = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${slash}`;
}

/**
 * Serialise a JSON-LD payload for embedding in a `<script>` element.
 *
 * Every one of these strings is handed to `dangerouslySetInnerHTML`, and
 * `JSON.stringify` does not escape `<`. A payload string containing
 * `</script>` — a country summary, a region name, anything the pipeline
 * generates from upstream data — therefore closes the script element early and
 * the remainder of the JSON lands in the document as markup. `<` is a
 * valid JSON escape that parses back to `<`, so consumers see the original
 * text and the browser never sees a tag.
 *
 * Every `*JsonLd` function below goes through here. None of them should call
 * `JSON.stringify` directly.
 */
function jsonLd(payload: unknown): string {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

/**
 * OG images are generated per-route via `opengraph-image.tsx` files
 * (Next.js convention). The framework auto-injects them into page metadata
 * — do not set `openGraph.images` manually here.
 */

export function countryMetadata(country: CountryData): Metadata {
  const title = `${country.name} — weather, regions, safety · Atlas Weather`;
  const description = `A month-by-month climate guide for ${country.name}: temperature, rainfall, sunshine, wind, and travel-advisory levels from six governments, based on 10 years of ERA5 data.`;
  const url = canonical(`/${country.slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Atlas Weather",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function monthMetadata(detail: MonthDetail): Metadata {
  const { country, monthName } = detail;
  const title = `${country.name} in ${monthName} — weather & safety · Atlas Weather`;
  const description = `${country.name} in ${monthName}: temperature, rainfall, sunshine, and regional climate scores, with the latest travel-advisory levels from six governments.`;
  const path = `/${country.slug}/${detail.month}`;
  const url = canonical(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Atlas Weather",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * `TouristDestination` JSON-LD for country pages. Embed via
 * `<script type="application/ld+json" dangerouslySetInnerHTML={...}>`.
 */
export function countryJsonLd(country: CountryData): string {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: country.name,
    description: country.summary,
    url: canonical(`/${country.slug}`),
    touristType: ["Trekking", "Cultural", "Photography", "Beach", "Urban"],
    address: { "@type": "PostalAddress", addressCountry: country.name },
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}

export function regionMetadata(country: CountryData, region: RegionRow): Metadata {
  const slug = regionHref(region);
  const title = `${region.name}, ${country.name} — weather by month · Atlas Weather`;
  const description = `Month-by-month climate for ${region.name} (${country.name}): temperature trend across the year, best-months ranking, and the latest travel-advisory levels for ${country.name}.`;
  const path = `/${country.slug}/${slug}`;
  const url = canonical(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Atlas Weather",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function regionMonthMetadata(
  country: CountryData,
  region: RegionRow,
  monthSlug: string,
  monthName: string,
): Metadata {
  const slug = regionHref(region);
  const title = `${region.name} in ${monthName} — weather & safety · Atlas Weather`;
  const description = `${region.name}, ${country.name} in ${monthName}: regional temperature, match score vs. the country average, and the latest travel-advisory levels from six governments.`;
  const path = `/${country.slug}/${slug}/${monthSlug}`;
  const url = canonical(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Atlas Weather",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/** `TouristDestination` JSON-LD for region pages — `containedInPlace` links to the country. */
export function regionJsonLd(country: CountryData, region: RegionRow): string {
  const slug = regionHref(region);
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: `${region.name}, ${country.name}`,
    description: `Month-by-month climate for ${region.name} in ${country.name}.`,
    url: canonical(`/${country.slug}/${slug}`),
    containedInPlace: {
      "@type": "Country",
      name: country.name,
      url: canonical(`/${country.slug}`),
    },
    touristType: ["Trekking", "Cultural", "Photography"],
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}

export function regionMonthJsonLd(
  country: CountryData,
  region: RegionRow,
  monthSlug: string,
  monthName: string,
): string {
  const slug = regionHref(region);
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: `${region.name} in ${monthName}`,
    description: `Weather and safety information for visiting ${region.name}, ${country.name} in ${monthName}.`,
    touristType: ["Trekking", "Cultural", "Photography"],
    url: canonical(`/${country.slug}/${slug}/${monthSlug}`),
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}

/**
 * Metadata for the month-first landing pages (`/best-weather-in/[month]`).
 *
 * These answer the query the country pages cannot: "where should I go in
 * April", asked before the visitor has a country in mind. Title stays short
 * enough not to truncate, and leads with the month because that is the word
 * that was searched for.
 */
export function monthLandingMetadata(
  monthSlug: string,
  monthName: string,
  count: number,
): Metadata {
  const title = `Best weather in ${monthName} — top destinations · Atlas Weather`;
  const description = `The ${count} countries with the best weather in ${monthName}, ranked from ten years of ERA5 data: temperature, rainfall and sunshine against a comfortable-travel profile, with travel-advisory levels from six governments.`;
  const url = canonical(`/best-weather-in/${monthSlug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Atlas Weather",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * `ItemList` JSON-LD for a month landing page.
 *
 * An ordered list is what the page actually is, and saying so is what lets a
 * search engine treat it as a ranking rather than as prose that happens to
 * contain country names. Each entry points at the country's page *for that
 * month*, which is the page the visitor wants next.
 */
export function monthLandingJsonLd(
  monthSlug: string,
  monthName: string,
  entries: readonly { slug: string; name: string; rank: number }[],
): string {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Best weather in ${monthName}`,
    description: `Countries ranked by how well their ${monthName} climate matches a comfortable-travel profile, from ten years of ERA5 data.`,
    url: canonical(`/best-weather-in/${monthSlug}`),
    numberOfItems: entries.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: entries.map((entry) => ({
      "@type": "ListItem",
      position: entry.rank,
      name: `${entry.name} in ${monthName}`,
      url: canonical(`/${entry.slug}/${monthSlug}`),
      item: {
        "@type": "TouristDestination",
        name: entry.name,
        url: canonical(`/${entry.slug}`),
      },
    })),
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}

/** `TouristTrip` JSON-LD for month pages. */
export function monthJsonLd(detail: MonthDetail): string {
  const { country, monthName } = detail;
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: `${country.name} in ${monthName}`,
    description: `Weather, regional scores, and safety information for visiting ${country.name} in ${monthName}.`,
    touristType: ["Trekking", "Cultural", "Photography"],
    url: canonical(`/${country.slug}/${detail.month}`),
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}
