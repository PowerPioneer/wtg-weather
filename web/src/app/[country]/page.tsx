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
import { COUNTRIES } from "@/lib/countries";
import { countryJsonLd, countryMetadata } from "@/lib/seo";

export const revalidate = 2592000;
export const dynamicParams = false;

export async function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.slug }));
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
