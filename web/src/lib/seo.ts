/**
 * SEO helpers for SSR pages. Every country/month page emits canonical + OG +
 * `TouristTrip` JSON-LD; these helpers keep the wording consistent so we
 * don't drift between `app/[country]/page.tsx` and `app/[country]/[month]/page.tsx`.
 *
 * Titles stay under ~60 chars to avoid search snippet truncation.
 */

import type { Metadata } from "next";
import { SITE_URL } from "./env";
import { regionSlug } from "./regions";
import type { CountryData, MonthDetail, RegionRow } from "./types";

export function canonical(path: string): string {
  const slash = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${slash}`;
}

/**
 * OG images are generated per-route via `opengraph-image.tsx` files
 * (Next.js convention). The framework auto-injects them into page metadata
 * — do not set `openGraph.images` manually here.
 */

export function countryMetadata(country: CountryData): Metadata {
  const title = `${country.name} — weather, regions, safety · Atlas Weather`;
  const description = `A month-by-month climate guide for ${country.name}: temperature, rainfall, sunshine, wind, and travel-advisory levels from five governments, based on 10 years of ERA5 data.`;
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
  const description = `${country.name} in ${monthName}: temperature, rainfall, sunshine, and regional climate scores, with the latest travel-advisory levels from five governments.`;
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
  return JSON.stringify({
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
  const slug = regionSlug(region.name);
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
  const slug = regionSlug(region.name);
  const title = `${region.name} in ${monthName} — weather & safety · Atlas Weather`;
  const description = `${region.name}, ${country.name} in ${monthName}: regional temperature, match score vs. the country average, and the latest travel-advisory levels from five governments.`;
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
  const slug = regionSlug(region.name);
  return JSON.stringify({
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
  const slug = regionSlug(region.name);
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: `${region.name} in ${monthName}`,
    description: `Weather and safety information for visiting ${region.name}, ${country.name} in ${monthName}.`,
    touristType: ["Trekking", "Cultural", "Photography"],
    url: canonical(`/${country.slug}/${slug}/${monthSlug}`),
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}

/** `TouristTrip` JSON-LD for month pages. */
export function monthJsonLd(detail: MonthDetail): string {
  const { country, monthName } = detail;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: `${country.name} in ${monthName}`,
    description: `Weather, regional scores, and safety information for visiting ${country.name} in ${monthName}.`,
    touristType: ["Trekking", "Cultural", "Photography"],
    url: canonical(`/${country.slug}/${detail.month}`),
    provider: { "@type": "Organization", name: "Atlas Weather" },
  });
}
