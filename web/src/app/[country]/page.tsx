import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BestMonths,
  ClimateGrid,
  CountryHero,
  MonthAccordion,
  PlanCta,
  RegionsGrid,
  RelatedCountries,
  SafetySection,
} from "@/components/country";
import { PageFooter, PageHeader } from "@/components/layout";
import { getCountry } from "@/lib/api-client";
import { routableCountries } from "@/lib/country-routes";
import { countryJsonLd, countryMetadata } from "@/lib/seo";

export const revalidate = 2592000;

/**
 * On, because `generateStaticParams` can legitimately come back empty: the
 * image is built inside `docker build`, off the compose network, where the API
 * cannot be reached (see `routableCountries`). With `dynamicParams = false`
 * that would 404 every country page. An unknown slug still 404s — `getCountry`
 * returns `null` and this page calls `notFound()` — it just does so at request
 * time rather than as a page baked into the build.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  const countries = await routableCountries();
  return countries.map((c) => ({ country: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country } = await params;
  const data = await getCountry(country);
  if (!data) return { title: "Country not found" };
  return countryMetadata(data);
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const data = await getCountry(country);
  if (!data) notFound();

  return (
    <>
      <PageHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1280px] px-6 pt-6 md:px-12">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-text-muted">
            <Link href="/" className="hover:text-text">Home</Link>
            <span aria-hidden="true">·</span>
            <span>Countries</span>
            <span aria-hidden="true">·</span>
            <span>{data.region}</span>
            <span aria-hidden="true">·</span>
            <span className="text-text">{data.name}</span>
          </nav>
        </div>

        <CountryHero country={data} />
        <BestMonths country={data} />
        <ClimateGrid country={data} />
        <RegionsGrid country={data} />
        <SafetySection advisories={data.advisories} countryName={data.name} />
        <MonthAccordion country={data} />
        <RelatedCountries country={data} />
        <PlanCta
          headline={`Plan a trip to ${data.name}.`}
          primaryHref={`/map?country=${data.slug}`}
        />
      </main>
      <PageFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: countryJsonLd(data) }}
      />
    </>
  );
}
