/**
 * Provenance strip below the trip, above the site footer. Gives a recipient of
 * a shared link the sources behind what they are looking at.
 *
 * It used to print "prepared {date} · trip {id}" — the payload carries no
 * timestamp, and the id is not something a public viewer should be handed:
 * sharing grants a token, deliberately not an id.
 */
export function TripFooter({ monthName }: { monthName: string | null }) {
  return (
    <div className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-6 font-mono text-[11.5px] text-text-muted md:px-12">
        <div>
          {monthName
            ? `Scored for ${monthName} against the latest published climate data`
            : "Scored against the latest published climate data"}
        </div>
        <div>
          Climate · ERA5 10-year monthly means · Safety · highest of 5 government
          advisories
        </div>
        <div>Atlas Weather</div>
      </div>
    </div>
  );
}
