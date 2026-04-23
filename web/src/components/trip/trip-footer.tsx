import type { TripData } from "@/lib/types";

/**
 * PDF-style attribution footer. Rendered below the page but above the global
 * site footer. Gives public viewers the provenance of the shared snapshot.
 */
export function TripFooter({ trip }: { trip: TripData }) {
  const agency = trip.owner.kind === "agency" ? trip.owner.agency : null;

  return (
    <div className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-6 font-mono text-[11.5px] text-text-muted md:px-12">
        <div>
          {agency && (
            <strong className="font-sans font-semibold text-text">{agency}</strong>
          )}
          {agency && " · "}
          prepared {trip.updatedAt} · trip {trip.id}
        </div>
        <div>Climate · ERA5 reanalysis 2014–2024 · Safety · 5-government rolling consensus</div>
        <div>Atlas Weather</div>
      </div>
    </div>
  );
}
