import type { Metadata } from "next";
import Link from "next/link";

import { PageFooter, PageHeader } from "@/components/layout";
import {
  PRICING_FAQ,
  PRICING_HERO,
  TRUST_SIGNALS,
  TierCard,
  consumerTiers,
} from "@/components/upgrade";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing · Atlas Weather",
  description:
    "Free forever for country-level climate and combined safety advisories. Consumer Premium at €2.99/mo unlocks district-level zoom, percentile bands, four extra variables, and PDF export.",
  alternates: { canonical: canonical("/pricing") },
};

// Monthly revalidation keeps copy churn in sync without rebuilding the site
// for every tweak. Pricing values themselves come from code, not CMS.
export const revalidate = 2592000;

type Search = { billing?: "monthly" | "yearly" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { billing: billingParam } = await searchParams;
  const billing: "monthly" | "yearly" = billingParam === "yearly" ? "yearly" : "monthly";
  const tiers = consumerTiers();

  return (
    <>
      <PageHeader activePath="/pricing" />
      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-12 md:py-20">
            <div className="max-w-[760px]">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {PRICING_HERO.eyebrow}
              </div>
              <h1 className="mt-2 font-display text-[56px] font-medium leading-[1.06] tracking-[-0.01em] text-text md:text-[72px]">
                {PRICING_HERO.headline}
              </h1>
              <p className="mt-5 text-[17px] leading-[1.6] text-text-muted">{PRICING_HERO.sub}</p>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="inline-flex items-center gap-0 rounded-full border border-border bg-surface p-1 font-sans">
                <Link
                  href="/pricing"
                  replace
                  className={
                    "rounded-full px-4 py-[7px] text-[13px] font-medium " +
                    (billing === "monthly" ? "bg-primary text-primary-foreground" : "text-text")
                  }
                >
                  Monthly
                </Link>
                <Link
                  href="/pricing?billing=yearly"
                  replace
                  className={
                    "rounded-full px-4 py-[7px] text-[13px] font-medium " +
                    (billing === "yearly" ? "bg-primary text-primary-foreground" : "text-text")
                  }
                >
                  Yearly
                  <span
                    className={
                      "ml-1.5 text-[10px] font-semibold " +
                      (billing === "yearly" ? "text-[#E0C98A]" : "text-accent")
                    }
                  >
                    −33%
                  </span>
                </Link>
              </div>
              <span className="font-mono text-[11.5px] text-text-muted">
                Paddle handles VAT, invoices, and refunds.
              </span>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {tiers.map((t) => (
                <TierCard key={t.id} tier={t} billing={billing} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-background">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <div className="mb-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                What you can trust
              </div>
              <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
                The boring reassurances
              </h2>
            </div>
            <ul className="grid gap-3 md:grid-cols-3">
              {TRUST_SIGNALS.map((s) => (
                <li key={s.title} className="rounded-md border border-border bg-surface p-5">
                  <div className="text-[13.5px] font-semibold text-text">{s.title}</div>
                  <p className="mt-1 text-[12.5px] leading-[1.5] text-text-muted">{s.sub}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
            <div className="mb-6">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Frequently asked
              </div>
              <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
                Before you decide
              </h2>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              {PRICING_FAQ.map((item, i) => (
                <details
                  key={item.q}
                  className={
                    "group bg-surface " +
                    (i === PRICING_FAQ.length - 1 ? "" : "border-b border-border")
                  }
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-[14.5px] font-medium text-text hover:bg-surface-2">
                    {item.q}
                    <span className="text-text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="max-w-[760px] px-5 pb-5 text-[13.5px] leading-[1.6] text-text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </>
  );
}
