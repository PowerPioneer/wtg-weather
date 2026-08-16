import { SafetyPanel, type AdvisorySource as PanelAdvisorySource } from "@/components/safety";
import { advisoryFreshness } from "@/lib/advisory-freshness";
import type { AdvisoryLevel, AdvisorySummary } from "@/lib/types";

const GOV_CODE: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "UK",
  Canada: "CA",
  Australia: "AU",
  Germany: "DE",
  // Six scrapers, not five. `slice(0, 2)` would have made this "NE".
  Netherlands: "NL",
};

/**
 * Adapter between the API advisory shape (`AdvisorySummary`, full gov names,
 * `label` + `date`) and the UI shape (`SafetyPanel` expects the two-letter
 * `gov` code plus `summary` + `updated`). Kept here rather than inside the
 * panel itself so the panel can serve the map tooltip too.
 *
 * `advisories` is optional because a country no government has published
 * anything about genuinely has none — the pipeline omits the property rather
 * than asserting "normal precautions" on nobody's authority, and the map
 * paints such a country grey. This says the same thing in words.
 */
export function SafetySection({
  advisories,
  countryName,
  now,
}: {
  advisories?: AdvisorySummary;
  countryName: string;
  /**
   * Injected in tests. In production this is the build/revalidate time of a
   * statically generated page, so the freshness verdict is "as of when this
   * page was rendered" — which is why the copy dates the check rather than
   * counting days since it.
   */
  now?: Date;
}) {
  if (!advisories) {
    return (
      <section className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Safety
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            No advisory on file for {countryName}
          </h2>
          <p className="mt-2 max-w-[680px] text-[14px] text-text-muted">
            None of the six governments we track publishes a country-wide
            advisory for {countryName}. That is not the same as a clean bill of
            health — check your own government&rsquo;s guidance before you
            travel.
          </p>
        </div>
      </section>
    );
  }

  const sources: readonly PanelAdvisorySource[] = advisories.sources.map((s) => ({
    gov: GOV_CODE[s.gov] ?? s.gov.slice(0, 2).toUpperCase(),
    level: s.level as AdvisoryLevel,
    summary: s.label,
    updated: s.date,
    checked: s.checked,
    url: s.url,
  }));

  const freshness = advisoryFreshness(advisories, now);
  const count = sources.length;

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="mb-6">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Safety · {count} government{count === 1 ? "" : "s"}
          </div>
          <h2 className="mt-1 font-display text-[28px] font-medium leading-[1.2] text-text">
            What {count === 1 ? "one government says" : "the governments say"} about{" "}
            {countryName}
          </h2>
        </div>
        <SafetyPanel
          combined={advisories.combined.level as AdvisoryLevel}
          sources={sources}
          lastUpdated={advisories.lastUpdated}
          stale={freshness.stale}
          lastChecked={freshness.lastChecked}
        />
        {advisories.regionalMax != null ? (
          <p className="mt-4 max-w-[680px] rounded-md border border-dashed border-border bg-surface p-4 text-[13px] leading-snug text-text-muted">
            <span className="font-medium text-text">
              Parts of {countryName} carry a higher advisory
            </span>{" "}
            — up to level {advisories.regionalMax}
            {advisories.regionalMaxLabel ? `, "${advisories.regionalMaxLabel}"` : ""}. The
            governments concerned name a region rather than a boundary, so the
            carve-out is not drawn on the map and is not reflected in the
            combined level above. Follow the source links for where it applies.
          </p>
        ) : null}
      </div>
    </section>
  );
}
