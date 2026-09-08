import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout";
import { routableCountries } from "@/lib/country-routes";
import { getEntitlement, getSessionServer } from "@/lib/session";

import { MapExperience } from "./map-experience";

export const metadata: Metadata = {
  title: "Map · Where to Go for Great Weather",
  description:
    "Explore ten years of climate data and six-government safety advisories on an interactive world map.",
};

// Map bundle is heavy (~250KB gzipped). Keep the RSC light and let
// `MapExperience` — the Client Component — pull in MapLibre lazily.
export default async function MapPage() {
  const session = await getSessionServer();
  const entitlement = getEntitlement(session);
  // Which country pages exist. Resolved on the server because it comes from
  // the API's published index — passing the answer down keeps the climate
  // panel's "View country page" CTA honest without the client having to guess.
  const publishedCountrySlugs = (await routableCountries()).map((c) => c.slug);

  return (
    // `100dvh`, not `100vh`, and not a header constant subtracted from either.
    //
    // On a phone `100vh` is the *large* viewport — it includes the strip behind
    // the browser's collapsible toolbar — so a map sized to it is taller than
    // what you can see. The page then scrolls: the legend sits below the fold,
    // and scrolling to reach it pushes the Display/month/Prefs controls up
    // behind the header. `100dvh` tracks the toolbar, so the map is exactly the
    // space actually available.
    //
    // The header's height is measured rather than assumed. `--size-header` is a
    // fixed 56px, but below `sm` the header wraps the product name onto two
    // lines and is taller than that, so every `calc(100vh - 56px)` was wrong on
    // exactly the devices that could least afford it. A flex column makes the
    // browser do the subtraction.
    <div className="flex h-screen h-[100dvh] flex-col overflow-hidden">
      <PageHeader activePath="/map" />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<MapLoading />}>
          <MapExperience
            isPremium={entitlement.premium}
            publishedCountrySlugs={publishedCountrySlugs}
          />
        </Suspense>
      </main>
    </div>
  );
}

function MapLoading() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full items-center justify-center bg-surface-sunken"
    >
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em]">Loading map</span>
      </div>
    </div>
  );
}
