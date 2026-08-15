import { FavouriteButton } from "@/components/favourite/favourite-button";
import type { CountryData } from "@/lib/types";

/**
 * Country hero. Editorial, serif-heavy treatment so the page feels like a
 * guide rather than a dashboard. The numeric metadata (capital, area, TZ)
 * lives in a mono caption underneath so reader instincts match how we
 * weight "narrative" vs. "fact".
 *
 * Capital, timezone and area are optional: Natural Earth is the source of
 * record for the boundary vintage and it has no capital for a handful of
 * territories. A missing row is dropped rather than rendered as an em dash —
 * an empty definition list entry reads as a data bug, and a placeholder reads
 * as a fact.
 */
export function CountryHero({ country }: { country: CountryData }) {
  const facts: { label: string; value: string }[] = [
    { label: "Region", value: country.region },
  ];
  if (country.capital) facts.unshift({ label: "Capital", value: country.capital });
  if (country.tz) facts.push({ label: "TZ", value: country.tz });
  if (country.area) facts.push({ label: "Area", value: country.area });

  return (
    <section className="relative overflow-hidden border-b border-border bg-surface">
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-[1.15fr_1fr] md:px-12 md:py-16">
        <div className="flex flex-col justify-center gap-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            When to go · Climate guide
          </div>
          <h1 className="font-display text-[72px] font-medium leading-[1.02] tracking-[-0.02em] text-text md:text-[88px]">
            {country.name}
            <span className="block text-[40px] italic text-[#8A4A1E] md:text-[52px]">when to go</span>
          </h1>
          <p className="max-w-[560px] font-display text-[17px] leading-[1.55] text-text-muted">
            {country.summary}
          </p>
          <dl className="grid max-w-[520px] grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px] text-text-muted">
            {facts.map((fact) => (
              <div key={fact.label} className="flex gap-2">
                <dt className="text-text-subtle">{fact.label}</dt>
                <dd className="text-text">{fact.value}</dd>
              </div>
            ))}
          </dl>
          {/*
            The one client island on this page. The document is statically
            generated and shared by every visitor, so whether *you* have starred
            this country cannot be in the markup — it resolves after hydration.
            With JS off the button is absent and nothing else changes.
          */}
          <FavouriteButton
            countryIso2={country.iso2}
            name={country.name}
            className="self-start"
          />
        </div>
        <div
          className="relative hidden min-h-[380px] overflow-hidden rounded-md border border-border md:block"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 30% 20%, rgba(224,201,138,0.45), transparent 60%), radial-gradient(120% 90% at 80% 80%, rgba(15,27,45,0.85), rgba(15,27,45,0.6) 55%, rgba(15,27,45,0.95)), linear-gradient(180deg, #0F1B2D 0%, #1C2A44 100%)",
            }}
          />
          <div className="absolute bottom-6 left-6 right-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#E0C98A]">
            {country.iso2} · {country.region}
          </div>
        </div>
      </div>
    </section>
  );
}
