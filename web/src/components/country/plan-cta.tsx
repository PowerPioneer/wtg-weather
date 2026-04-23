import Link from "next/link";

/**
 * Bottom-of-page CTA band. Dark ink treatment matches the Final-design
 * reference so the page ends on a call-to-action rather than a footer.
 */
export function PlanCta({
  headline = "Plan a trip around the weather you actually like.",
  primaryHref = "/map",
  primaryLabel = "Open the map",
  secondaryHref = "/pricing",
  secondaryLabel = "Try Premium · €2.99",
}: {
  headline?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:px-12">
        <div className="flex flex-col items-start gap-6 rounded-md bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-12">
          <div className="max-w-[520px]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#E0C98A]">
              Start free
            </div>
            <p className="mt-2 font-display text-[28px] font-medium leading-[1.2] md:text-[32px]">
              {headline}
            </p>
            <p className="mt-2 text-[14px] text-[rgba(247,246,242,0.72)]">
              No card required. Upgrade to Premium whenever you want more depth.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={primaryHref}
              className="inline-flex items-center rounded-md bg-[#E0C98A] px-5 py-3 text-[14px] font-medium text-primary hover:brightness-105"
            >
              {primaryLabel}
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex items-center rounded-md border border-[rgba(255,255,255,0.2)] px-4 py-3 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
