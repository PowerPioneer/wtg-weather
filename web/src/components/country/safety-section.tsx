import { SafetyPanel, type AdvisorySource as PanelAdvisorySource } from "@/components/safety";
import type { AdvisoryLevel, AdvisorySummary } from "@/lib/types";

const GOV_CODE: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "UK",
  Canada: "CA",
  Australia: "AU",
  Germany: "DE",
};

/**
 * Adapter between the API advisory shape (`AdvisorySummary`, full gov names,
 * `label` + `date`) and the UI shape (`SafetyPanel` expects the two-letter
 * `gov` code plus `summary` + `updated`). Kept here rather than inside the
 * panel itself so the panel can serve the map tooltip too.
 */
export function SafetySection({
  advisories,
  countryName,
}: {
  advisories: AdvisorySummary;
  countryName: string;
}) {
  const sources: readonly PanelAdvisorySource[] = advisories.sources.map((s) => ({
    gov: GOV_CODE[s.gov] ?? s.gov.slice(0, 2).toUpperCase(),
    level: s.level as AdvisoryLevel,
    summary: s.label,
    updated: s.date,
    url: s.url,
  }));

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Safety · five governments
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            What the five governments say about {countryName}
          </h2>
        </div>
        <SafetyPanel
          combined={advisories.combined.level as AdvisoryLevel}
          sources={sources}
          lastUpdated={advisories.lastUpdated}
        />
      </div>
    </section>
  );
}
