import { SafetyBadge } from "@/components/safety";
import type { RegionRow } from "@/lib/types";

const LEVEL_BORDER = {
  2: "border-advisory-caution/40",
  3: "border-advisory-reconsider/40",
  4: "border-advisory-dnt/40",
} as const;

/**
 * A carve-out that applies to one region rather than the whole country.
 *
 * Only rendered when the region's level is *worse* than its country's — the
 * pipeline omits the field otherwise, because the country-wide safety panel
 * further down the same page already states that level.
 *
 * The wording is careful about a real limitation. Governments name the
 * affected areas in prose ("some areas within the regions of Ayacucho, Cusco,
 * Huancavelica"), and the finest boundary the pipeline can attach that to is
 * the whole admin-1 unit. So this says the advisory applies *within* the
 * region, not to all of it.
 */
export function RegionAdvisoryNotice({
  region,
  countryName,
}: {
  region: RegionRow;
  countryName: string;
}) {
  const advisory = region.advisory;
  if (!advisory) return null;

  return (
    <aside
      className={`mx-auto mt-6 flex w-full max-w-[1280px] items-start gap-4 rounded-lg border bg-surface px-5 py-4 md:px-6 ${
        LEVEL_BORDER[advisory.level as 2 | 3 | 4] ?? "border-border"
      }`}
    >
      <SafetyBadge level={advisory.level} size="md" />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
          Travel advisory · {advisory.code}
        </p>
        <p className="mt-1 max-w-[720px] text-[15px] leading-snug text-text">
          <span className="font-medium">
            {region.name} carries a higher advisory than the rest of {countryName}
          </span>{" "}
          — level {advisory.level}, &ldquo;{advisory.label}&rdquo;. Governments
          describe the affected areas in prose, so this may apply to part of{" "}
          {region.name} rather than all of it. The sources below say where.
        </p>
      </div>
    </aside>
  );
}
